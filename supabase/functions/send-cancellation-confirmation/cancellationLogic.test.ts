import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  processCancellation,
  renderCustomerEmail,
  renderInternalEmail,
  sendViaResend,
  fmtTimestamp,
  escapeHtml,
  COPY,
  type CancellationRow,
} from './cancellationLogic.ts'

const ID = '0b6f1c2e-3d4a-4b5c-8d9e-0f1a2b3c4d5e'
const CONFIG = {
  supabaseUrl: 'https://proj.supabase.co',
  serviceRole: 'srv-key',
  resendApiKey: 're_key',
  fromEmail: 'MOY IQ <hola@moyiq.app>',
  replyTo: 'support@moyiq.app',
  internalTo: ['support@moyiq.app', 'alert@example.com'],
}

function row(over: Partial<CancellationRow> = {}): CancellationRow {
  return {
    id: ID,
    created_at: '2026-10-08T14:05:00Z',
    lang: 'es',
    name: 'Ana Pérez',
    email: 'ana@example.com',
    plan: 'pro_yearly',
    contract_ref: 'FNOS-AAAA-BBBB-CCCC',
    kind: 'ordinary',
    reason: null,
    requested_date: null,
    user_agent: 'UA/1',
    customer_email_sent_at: null,
    internal_email_sent_at: null,
    ...over,
  }
}

const ok = (body: unknown = {}) => ({ ok: true, status: 200, json: async () => body, text: async () => '' })
const fail = (status: number) => ({ ok: false, status, json: async () => ({}), text: async () => 'err' })

// fetch mock que enruta por URL/método: GET de la fila, PATCH de claim/release, POST a Resend.
function router(opts: { row?: CancellationRow | null; claim?: boolean | boolean[]; resend?: any[] } = {}) {
  const claims = Array.isArray(opts.claim) ? [...opts.claim] : null
  const resend = opts.resend ? [...opts.resend] : null
  return vi.fn(async (url: string, init: any = {}) => {
    if (url.startsWith('https://api.resend.com')) return resend ? resend.shift() ?? ok() : ok()
    if ((init.method ?? 'GET') === 'GET') return ok(opts.row === null ? [] : [opts.row ?? row()])
    if (init.method === 'PATCH') {
      if (init.headers?.Prefer === 'return=representation') {
        const c = claims ? claims.shift() ?? true : opts.claim ?? true
        return ok(c ? [{ id: ID }] : [])
      }
      return ok()
    }
    throw new Error('unexpected ' + url)
  })
}

const resendCalls = (m: any) => m.mock.calls.filter((c: any[]) => c[0].startsWith('https://api.resend.com'))

afterEach(() => { vi.unstubAllGlobals() })

describe('renderCustomerEmail', () => {
  it('es: confirma recepción con contenido, timestamp UTC y referencia, sin exclamaciones', () => {
    const e = renderCustomerEmail(row())
    expect(e.subject).toBe(COPY.es.subject)
    expect(e.text).toContain('Recibimos tu declaración de cancelación el')
    expect(e.text).toContain('UTC')
    expect(e.text).toContain('Pro anual')
    expect(e.text).toContain('FNOS-AAAA-BBBB-CCCC')
    expect(e.text).toContain('En la próxima fecha posible')
    expect(e.text).toContain(ID)
    expect(e.text + e.subject).not.toMatch(/[!¡]/)
  })

  it('de: usa "Sie", hora de Berlín y el Vertragsende pedido', () => {
    const e = renderCustomerEmail(row({ lang: 'de', requested_date: '2026-12-31' }))
    expect(e.subject).toContain('Kündigung')
    expect(e.text).toContain('Ihre Kündigungserklärung ist am')
    expect(e.text).toMatch(/MESZ|MEZ/)
    expect(e.text).toContain('31. Dezember 2026')
    expect(e.text).not.toMatch(/\bdu\b|\bdein/i)
  })

  it('en y pt tienen su propio texto; idioma desconocido cae a español', () => {
    expect(renderCustomerEmail(row({ lang: 'en' })).subject).toBe(COPY.en.subject)
    expect(renderCustomerEmail(row({ lang: 'pt' })).subject).toBe(COPY.pt.subject)
    expect(renderCustomerEmail(row({ lang: 'fr' })).subject).toBe(COPY.es.subject)
    expect(renderCustomerEmail(row({ lang: null })).subject).toBe(COPY.es.subject)
  })

  it('el motivo solo aparece en la extraordinaria', () => {
    expect(renderCustomerEmail(row({ reason: 'x-motivo' })).text).not.toContain('x-motivo')
    const e = renderCustomerEmail(row({ kind: 'extraordinary', reason: 'x-motivo' }))
    expect(e.text).toContain('x-motivo')
    expect(e.text).toContain('Extraordinaria')
  })

  it('escapa HTML de los datos del usuario', () => {
    const e = renderCustomerEmail(row({ name: '<script>alert(1)</script>' }))
    expect(e.html).not.toContain('<script>')
    expect(e.html).toContain('&lt;script&gt;')
  })

  it('los 4 idiomas tienen las mismas claves de plan y etiquetas', () => {
    const keys = (o: object) => Object.keys(o).sort().join()
    for (const l of ['en', 'pt', 'de'] as const) {
      expect(keys(COPY[l].plan)).toBe(keys(COPY.es.plan))
      expect(keys(COPY[l].labels)).toBe(keys(COPY.es.labels))
    }
  })
})

describe('renderInternalEmail', () => {
  it('va en español con todos los datos, user agent e id; marca la extraordinaria en el asunto', () => {
    const e = renderInternalEmail(row({ lang: 'de', kind: 'extraordinary', reason: 'Grund' }))
    expect(e.subject).toMatch(/^\[Extraordinaria\] Cancelación recibida — Ana Pérez/)
    expect(e.text).toContain('UA/1')
    expect(e.text).toContain(ID)
    expect(e.text).toContain('Idioma del cliente: de')
  })
})

describe('fmtTimestamp / escapeHtml', () => {
  it('devuelve el input si no es una fecha válida', () => {
    expect(fmtTimestamp('nope', 'es')).toBe('nope')
  })
  it('escapa comillas y ampersand', () => {
    expect(escapeHtml(`a&"'`)).toBe('a&amp;&quot;&#39;')
  })
})

describe('sendViaResend', () => {
  it('manda reply_to y texto plano', async () => {
    const f = vi.fn().mockResolvedValue(ok())
    vi.stubGlobal('fetch', f)
    expect(await sendViaResend('a@b.co', { subject: 's', html: 'h', text: 't' }, CONFIG)).toEqual({ ok: true })
    const body = JSON.parse(f.mock.calls[0][1].body)
    expect(body).toMatchObject({ to: 'a@b.co', reply_to: 'support@moyiq.app', text: 't', from: CONFIG.fromEmail })
  })
  it('reintenta una vez ante 5xx o 429', async () => {
    const f = vi.fn().mockResolvedValueOnce(fail(503)).mockResolvedValueOnce(ok())
    vi.stubGlobal('fetch', f)
    expect((await sendViaResend('a@b.co', { subject: 's', html: 'h', text: 't' }, CONFIG)).ok).toBe(true)
    expect(f).toHaveBeenCalledTimes(2)
  })
  it('no reintenta un 422', async () => {
    const f = vi.fn().mockResolvedValue(fail(422))
    vi.stubGlobal('fetch', f)
    expect(await sendViaResend('a@b.co', { subject: 's', html: 'h', text: 't' }, CONFIG)).toEqual({ ok: false, error: 'resend_422' })
    expect(f).toHaveBeenCalledTimes(1)
  })
  it('reintenta ante error de red', async () => {
    const f = vi.fn().mockRejectedValueOnce(new Error('net')).mockResolvedValueOnce(ok())
    vi.stubGlobal('fetch', f)
    expect((await sendViaResend('a@b.co', { subject: 's', html: 'h', text: 't' }, CONFIG)).ok).toBe(true)
  })
  it('sin API key no llama a la red', async () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    expect(await sendViaResend('a@b.co', { subject: 's', html: 'h', text: 't' }, { ...CONFIG, resendApiKey: undefined })).toEqual({ ok: false, error: 'resend_not_configured' })
    expect(f).not.toHaveBeenCalled()
  })
})

describe('processCancellation', () => {
  it('rechaza un id que no es uuid sin tocar la red', async () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    expect(await processCancellation('1; drop', CONFIG)).toEqual({ ok: false, error: 'invalid_id' })
    expect(f).not.toHaveBeenCalled()
  })

  it('404 lógico si la fila no existe', async () => {
    vi.stubGlobal('fetch', router({ row: null }))
    expect(await processCancellation(ID, CONFIG)).toEqual({ ok: false, error: 'not_found' })
  })

  it('manda la confirmación al cliente y el aviso interno a los dos destinatarios', async () => {
    const f = router()
    vi.stubGlobal('fetch', f)
    expect(await processCancellation(ID, CONFIG)).toEqual({ ok: true, customer: 'sent', internal: 'sent' })
    const sends = resendCalls(f).map((c: any[]) => JSON.parse(c[1].body))
    expect(sends[0].to).toBe('ana@example.com')
    expect(sends[1].to).toEqual(['support@moyiq.app', 'alert@example.com'])
  })

  it('el claim es condicional: PATCH con <columna>=is.null', async () => {
    const f = router()
    vi.stubGlobal('fetch', f)
    await processCancellation(ID, CONFIG)
    const patches = f.mock.calls.filter((c: any[]) => c[1]?.method === 'PATCH').map((c: any[]) => c[0])
    expect(patches[0]).toContain('customer_email_sent_at=is.null')
    expect(patches[1]).toContain('internal_email_sent_at=is.null')
  })

  it('idempotente: si la fila ya tiene los flags no manda nada', async () => {
    const f = router({ row: row({ customer_email_sent_at: '2026-10-08T14:05:01Z', internal_email_sent_at: '2026-10-08T14:05:01Z' }) })
    vi.stubGlobal('fetch', f)
    expect(await processCancellation(ID, CONFIG)).toEqual({ ok: true, customer: 'already_sent', internal: 'already_sent' })
    expect(resendCalls(f)).toHaveLength(0)
  })

  it('idempotente ante carrera: si otro proceso ganó el claim no manda', async () => {
    const f = router({ claim: false })
    vi.stubGlobal('fetch', f)
    expect(await processCancellation(ID, CONFIG)).toEqual({ ok: true, customer: 'already_sent', internal: 'already_sent' })
    expect(resendCalls(f)).toHaveLength(0)
  })

  it('si Resend falla para el cliente libera el claim (para reintentar) y devuelve ok:false', async () => {
    const f = router({ resend: [fail(422), ok()] })
    vi.stubGlobal('fetch', f)
    expect(await processCancellation(ID, CONFIG)).toEqual({ ok: false, customer: 'failed', internal: 'sent' })
    const release = f.mock.calls.find((c: any[]) => c[1]?.method === 'PATCH' && c[1].headers.Prefer === 'return=minimal')
    expect(JSON.parse(release[1].body)).toEqual({ customer_email_sent_at: null })
  })

  it('sin API key de Resend no lee ni marca nada', async () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    expect(await processCancellation(ID, { ...CONFIG, resendApiKey: undefined })).toEqual({ ok: false, error: 'resend_not_configured' })
    expect(f).not.toHaveBeenCalled()
  })
})
