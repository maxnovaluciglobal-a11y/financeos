import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  renderEmail,
  unsubscribeUrl,
  sendViaResend,
  fetchLeadById,
  fetchEligibleForEmail2,
  fetchEligibleForEmail3,
  fetchEligibleForEmail4,
  markSent,
  runCronBatch,
  processWelcome,
  type DiagnosticoLead,
  type NurtureEmailConfig,
} from './nurtureEmailLogic.ts'

const CONFIG: NurtureEmailConfig = {
  supabaseUrl: 'https://proj.supabase.co',
  serviceRole: 'srv-key',
  resendApiKey: 're_key',
  fromEmail: 'MOY IQ <hola@moyiq.app>',
  cronSecret: 'sekret',
  landingUrl: 'https://moyiq.app',
}

const LEAD: DiagnosticoLead = { id: 'lead-1', email: 'lead@ejemplo.com', score: 42, label: 'Regular' }

afterEach(() => { vi.unstubAllGlobals() })

describe('renderEmail', () => {
  it('welcome incluye el score, el label y el link de unsubscribe con el id del lead', () => {
    const r = renderEmail('welcome', LEAD, CONFIG)
    expect(r.subject).toBe('Tu diagnóstico completo (y el dato que se quedó afuera)')
    expect(r.html).toContain('42/100')
    expect(r.html).toContain('Regular')
    expect(r.html).toContain('unsubscribe.html?id=lead-1')
  })

  it('welcome solo anuncia el email 2 si el consentimiento de marketing ya está confirmado (doble opt-in)', () => {
    expect(renderEmail('welcome', LEAD, CONFIG).html).not.toContain('En dos días te cuento')
    const confirmed = { ...LEAD, consent_marketing: true, consent_confirmed_at: '2026-10-08T12:00:00Z' }
    expect(renderEmail('welcome', confirmed, CONFIG).html).toContain('En dos días te cuento')
    for (const lang of ['en', 'pt', 'de']) {
      const a = renderEmail('welcome', { ...LEAD, lang }, CONFIG).html
      const b = renderEmail('welcome', { ...confirmed, lang }, CONFIG).html
      expect(b.length).toBeGreaterThan(a.length)
    }
  })

  it('welcome usa un bloque distinto por cada label conocido', () => {
    const labels = ['Crítico', 'Regular', 'Bueno', 'Excelente'] as const
    const htmls = labels.map((label) => renderEmail('welcome', { ...LEAD, label }, CONFIG).html)
    // ningún par de bloques de acción debería ser idéntico entre sí
    const unique = new Set(htmls)
    expect(unique.size).toBe(labels.length)
  })

  it('welcome cae a un mensaje genérico si no hay label', () => {
    const r = renderEmail('welcome', { ...LEAD, label: null }, CONFIG)
    expect(r.html).toContain('Registra tus movimientos de esta semana')
  })

  it('day2 apunta al signup con ref=diagnostico-d2 y cierra el loop del email 1', () => {
    const r = renderEmail('day2', LEAD, CONFIG)
    expect(r.html).toContain('ref=diagnostico-d2')
    expect(r.html).toContain('Como prometí')
    expect(r.subject).toContain('presupuesto')
  })

  it('day5 no menciona ningún trial — Pro no tiene trial', () => {
    const r = renderEmail('day5', LEAD, CONFIG)
    expect(r.html.toLowerCase()).not.toContain('trial')
    expect(r.html).toContain('Actualizar a Pro')
    expect(r.html).toContain('ref=diagnostico-d5')
  })

  it('day5 no incluye ningún testimonio inventado (regla explícita del plan)', () => {
    const r = renderEmail('day5', LEAD, CONFIG)
    expect(r.html).toContain('Sin testimonio inventado')
  })

  it('day12 (reactivación) no repite el pitch de Starter/Pro y menciona el unsubscribe en el cuerpo', () => {
    const r = renderEmail('day12', LEAD, CONFIG)
    expect(r.subject).toBe('Tu IQ Score sigue ahí (no venció)')
    expect(r.html).not.toContain('Actualizar a Pro')
    expect(r.html).not.toContain('Starter (gratis')
    expect(r.html).toContain('ref=diagnostico-d12')
    expect(r.html).toContain('último correo de esta secuencia')
    expect(r.html).toContain('unsubscribe.html?id=lead-1')
  })
})

describe('unsubscribeUrl', () => {
  it('usa el id uuid del lead, no el email', () => {
    const url = unsubscribeUrl(CONFIG, 'abc-123')
    expect(url).toBe('https://moyiq.app/unsubscribe.html?id=abc-123')
    expect(url).not.toContain('@')
  })
})

describe('sendViaResend', () => {
  const rendered = { subject: 'Asunto', html: '<p>hola</p>' }

  it('falla sin llamar a la red si no hay RESEND_API_KEY', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const result = await sendViaResend('a@b.com', rendered, { ...CONFIG, resendApiKey: undefined })
    expect(result).toEqual({ ok: false, error: 'resend_not_configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('manda con el remitente configurado (hola@moyiq.app)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    expect(await sendViaResend('a@b.com', rendered, CONFIG)).toEqual({ ok: true })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.from).toBe('MOY IQ <hola@moyiq.app>')
    expect(body.to).toBe('a@b.com')
  })

  it('reintenta una vez ante un fallo transitorio', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'down' })
      .mockResolvedValueOnce({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    expect(await sendViaResend('a@b.com', rendered, CONFIG)).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('devuelve error si Resend falla dos veces seguidas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'down' }))
    expect(await sendViaResend('a@b.com', rendered, CONFIG)).toEqual({ ok: false, error: 'resend_500' })
  })
})

describe('fetchLeadById', () => {
  it('devuelve el primer resultado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [LEAD] }))
    expect(await fetchLeadById('lead-1', CONFIG)).toEqual(LEAD)
  })
  it('devuelve null si no hay resultados', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }))
    expect(await fetchLeadById('lead-x', CONFIG)).toBeNull()
  })
})

describe('fetchEligibleForEmail2', () => {
  it('filtra por unsubscribed_at/consent_marketing/account_created_at/email2_sent_at, sin filtro de edad', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [LEAD] })
    vi.stubGlobal('fetch', fetchMock)
    await fetchEligibleForEmail2(CONFIG)
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('unsubscribed_at=is.null')
    expect(url).toContain('consent_marketing=is.true')
    expect(url).toContain('account_created_at=is.null')
    expect(url).toContain('email2_sent_at=is.null')
    expect(url).toContain('consent_confirmed_at=not.is.null') // doble opt-in: solo confirmados
    expect(url).not.toContain('created_at=lte') // sin filtro de edad, a propósito
  })
})

describe('fetchEligibleForEmail3', () => {
  it('exige email2_sent_at no nulo y anterior al corte de 3 días — nunca salta el email 2', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [LEAD] })
    vi.stubGlobal('fetch', fetchMock)
    await fetchEligibleForEmail3(CONFIG)
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('email3_sent_at=is.null')
    expect(url).toContain('consent_confirmed_at=not.is.null') // doble opt-in: solo confirmados
    expect(url).toContain('email2_sent_at=not.is.null')
    expect(url).toContain('email2_sent_at=lte.')
  })
})

describe('fetchEligibleForEmail4', () => {
  it('exige email3_sent_at no nulo y anterior al corte de 7 días — nunca salta el email 3', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [LEAD] })
    vi.stubGlobal('fetch', fetchMock)
    await fetchEligibleForEmail4(CONFIG)
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('email4_sent_at=is.null')
    expect(url).toContain('consent_confirmed_at=not.is.null') // doble opt-in: solo confirmados
    expect(url).toContain('email3_sent_at=not.is.null')
    expect(url).toContain('email3_sent_at=lte.')
  })
})

describe('markSent', () => {
  it('escribe la columna correcta según el modo', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    await markSent('lead-1', 'day2', CONFIG)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(Object.keys(body)).toEqual(['email2_sent_at'])
  })

  it('escribe email4_sent_at para el modo day12', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    await markSent('lead-1', 'day12', CONFIG)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(Object.keys(body)).toEqual(['email4_sent_at'])
  })
})

describe('runCronBatch', () => {
  it('manda día2/día5/día12 a los elegibles de cada uno, marcando cada envío', async () => {
    const lead2 = { id: 'l2', email: 'l2@x.com', score: 50, label: 'Regular' }
    const lead3 = { id: 'l3', email: 'l3@x.com', score: 80, label: 'Bueno' }
    const lead4 = { id: 'l4', email: 'l4@x.com', score: 30, label: 'Crítico' }

    const fetchMock = vi.fn().mockImplementation((url: string, init?: any) => {
      if (typeof url === 'string' && url.includes('email2_sent_at=is.null')) {
        return Promise.resolve({ ok: true, json: async () => [lead2] })
      }
      if (typeof url === 'string' && url.includes('email4_sent_at=is.null')) {
        return Promise.resolve({ ok: true, json: async () => [lead4] })
      }
      if (typeof url === 'string' && url.includes('email3_sent_at=is.null')) {
        return Promise.resolve({ ok: true, json: async () => [lead3] })
      }
      if (typeof url === 'string' && url.includes('api.resend.com')) {
        return Promise.resolve({ ok: true })
      }
      // PATCH de markSent
      return Promise.resolve({ ok: true })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await runCronBatch(CONFIG)
    expect(result.email2).toEqual({ attempted: 1, sent: 1, failed: 0 })
    expect(result.email3).toEqual({ attempted: 1, sent: 1, failed: 0 })
    expect(result.email4).toEqual({ attempted: 1, sent: 1, failed: 0 })
  })

  it('cuenta fallos de Resend sin tirar la corrida completa', async () => {
    const lead2 = { id: 'l2', email: 'l2@x.com', score: 50, label: 'Regular' }
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('email2_sent_at=is.null')) {
        return Promise.resolve({ ok: true, json: async () => [lead2] })
      }
      if (typeof url === 'string' && url.includes('email4_sent_at=is.null')) {
        return Promise.resolve({ ok: true, json: async () => [] })
      }
      if (typeof url === 'string' && url.includes('email3_sent_at=is.null')) {
        return Promise.resolve({ ok: true, json: async () => [] })
      }
      if (typeof url === 'string' && url.includes('api.resend.com')) {
        return Promise.resolve({ ok: false, status: 500, text: async () => 'down' })
      }
      return Promise.resolve({ ok: true })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await runCronBatch(CONFIG)
    expect(result.email2.attempted).toBe(1)
    expect(result.email2.sent).toBe(0)
    expect(result.email2.failed).toBe(1)
  })
})

describe('processWelcome (email 1 = resultado pedido, transaccional)', () => {
  const ID = '0b6f1c2e-3d4a-4b5c-8d9e-0f1a2b3c4d5e'
  const row = (over = {}) => ({ id: ID, email: 'lead@ejemplo.com', score: 42, label: 'Regular', consent_marketing: true, consent_confirmed_at: null, ...over })
  function router(r: any) {
    return vi.fn(async (url: string, init: any = {}) => {
      if (url.startsWith('https://api.resend.com')) return { ok: true, status: 200, json: async () => ({}), text: async () => '' }
      if ((init.method ?? 'GET') === 'GET') return { ok: true, json: async () => (r ? [r] : []) }
      return { ok: true, json: async () => ({}) }
    })
  }
  const resendCalls = (m: any) => m.mock.calls.filter((c: any[]) => c[0].startsWith('https://api.resend.com'))

  it('rechaza un id que no es uuid sin tocar la red', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    expect(await processWelcome('x', CONFIG)).toEqual({ ok: false, error: 'invalid_lead_id' })
    expect(f).not.toHaveBeenCalled()
  })

  it('404 lógico si el lead no existe', async () => {
    vi.stubGlobal('fetch', router(null))
    expect(await processWelcome(ID, CONFIG)).toEqual({ ok: false, error: 'lead_not_found' })
  })

  it('no manda nada si el lead no marcó la casilla (consent_marketing false)', async () => {
    const f = router(row({ consent_marketing: false })); vi.stubGlobal('fetch', f)
    expect(await processWelcome(ID, CONFIG)).toEqual({ ok: false, error: 'not_requested' })
    expect(resendCalls(f)).toHaveLength(0)
  })

  it('no repite el envío si email1_sent_at ya está marcado', async () => {
    const f = router(row({ email1_sent_at: '2026-10-08T12:00:00Z' })); vi.stubGlobal('fetch', f)
    expect(await processWelcome(ID, CONFIG)).toEqual({ ok: true, state: 'already_sent' })
    expect(resendCalls(f)).toHaveLength(0)
  })

  it('manda el resultado aunque el doble opt-in no esté confirmado y marca email1_sent_at', async () => {
    const f = router(row()); vi.stubGlobal('fetch', f)
    expect(await processWelcome(ID, CONFIG)).toEqual({ ok: true })
    expect(resendCalls(f)).toHaveLength(1)
    const patch = f.mock.calls.find((c: any[]) => c[1]?.method === 'PATCH')
    expect(Object.keys(JSON.parse(patch[1].body))).toEqual(['email1_sent_at'])
  })
})
