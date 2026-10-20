import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  isValidEmail, base64ByteLength, isPdfSizeOk, sendReportEmail, pickLang, bearerToken, getAuthUser, claimReportSend,
  dailyLimitFrom, CLAIM_STATUS, DEFAULT_DAILY_LIMIT,
} from './reportEmailLogic.ts'
import { resolveResendApiKey } from '../_shared/resendKey.ts'

const CONFIG = { supabaseUrl: 'https://proj.supabase.co', serviceRole: 'srv-key', resendApiKey: 're_key', fromEmail: 'a@b.com' }

afterEach(() => { vi.unstubAllGlobals() })

describe('isValidEmail', () => {
  it('acepta un email con forma válida', () => {
    expect(isValidEmail('cliente@ejemplo.com')).toBe(true)
  })
  it('rechaza strings sin @ o sin dominio', () => {
    expect(isValidEmail('no-es-email')).toBe(false)
    expect(isValidEmail('a@b')).toBe(false)
  })
  it('rechaza no-strings, vacío, y strings absurdamente largos', () => {
    expect(isValidEmail(undefined)).toBe(false)
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('a@' + 'b'.repeat(300) + '.com')).toBe(false)
  })
})

describe('base64ByteLength / isPdfSizeOk', () => {
  it('calcula el tamaño real en bytes de un base64 (sin padding)', () => {
    // "hola" en base64 es "aG9sYQ==" -> 4 bytes reales
    expect(base64ByteLength('aG9sYQ==')).toBe(4)
  })
  it('acepta un PDF chico', () => {
    expect(isPdfSizeOk('aG9sYQ==')).toBe(true)
  })
  it('rechaza un payload que excede el límite de 8MB', () => {
    // ~4 caracteres base64 = 3 bytes reales; generamos > 8MB reales
    const huge = 'A'.repeat(12 * 1024 * 1024)
    expect(isPdfSizeOk(huge)).toBe(false)
  })
  it('rechaza vacío o tipos no-string', () => {
    expect(isPdfSizeOk('')).toBe(false)
    expect(isPdfSizeOk(undefined)).toBe(false)
  })
})

describe('C-20 · sesión de la cuenta dueña y tope diario', () => {
  it('bearerToken extrae el token y rechaza formas raras', () => {
    expect(bearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi')
    expect(bearerToken('bearer x')).toBe('x')
    for (const h of [null, undefined, '', 'Basic x', 'Bearer', 'Bearer a b']) expect(bearerToken(h as any)).toBeNull()
  })

  it('dailyLimitFrom: entero positivo razonable o el default', () => {
    expect(dailyLimitFrom('5')).toBe(5)
    for (const v of [undefined, null, '', '0', '-1', 'abc', '2.5', '100000']) expect(dailyLimitFrom(v as any)).toBe(DEFAULT_DAILY_LIMIT)
    expect(DEFAULT_DAILY_LIMIT).toBe(20)
  })

  it('getAuthUser consulta /auth/v1/user con el token del usuario', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'u1', email: 'asesor@x.com' }) })
    vi.stubGlobal('fetch', fetchMock)
    expect(await getAuthUser('tok', CONFIG)).toEqual({ id: 'u1', email: 'asesor@x.com' })
    expect(fetchMock.mock.calls[0][0]).toBe('https://proj.supabase.co/auth/v1/user')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok')
  })

  it('getAuthUser: token inválido, respuesta sin id o red caída → null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    expect(await getAuthUser('tok', CONFIG)).toBeNull()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
    expect(await getAuthUser('tok', CONFIG)).toBeNull()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net')))
    expect(await getAuthUser('tok', CONFIG)).toBeNull()
    expect(await getAuthUser('', CONFIG)).toBeNull()
  })

  it('claimReportSend manda user id, clave y tope a report_email_claim', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, remaining: 19 }) })
    vi.stubGlobal('fetch', fetchMock)
    expect(await claimReportSend('u1', 'FNOS-X', CONFIG, 20)).toEqual({ ok: true, remaining: 19 })
    expect(fetchMock.mock.calls[0][0]).toBe('https://proj.supabase.co/rest/v1/rpc/report_email_claim')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ p_user_id: 'u1', p_key: 'FNOS-X', p_daily_limit: 20 })
  })

  it.each([
    ['not_owner', 'not_owner', 403],
    ['daily_limit', 'daily_limit', 429],
    ['license_required', 'license_required', 403],
    ['bad_args', 'license_required', 403],
  ])('RPC devuelve %s → %s (%i)', async (rpcError, expected, status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: false, error: rpcError }) }))
    const r = await claimReportSend('u1', 'FNOS-X', CONFIG)
    expect(r).toEqual({ ok: false, error: expected })
    expect(CLAIM_STATUS[(r as any).error]).toBe(status)
  })

  it('RPC caída → claim_failed (503), nunca deja pasar el envío', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    expect(await claimReportSend('u1', 'FNOS-X', CONFIG)).toEqual({ ok: false, error: 'claim_failed' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net')))
    expect(await claimReportSend('u1', 'FNOS-X', CONFIG)).toEqual({ ok: false, error: 'claim_failed' })
    expect(CLAIM_STATUS.claim_failed).toBe(503)
  })

  it('sin clave no llama a la red', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await claimReportSend('u1', '', CONFIG)).toEqual({ ok: false, error: 'license_required' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('el correo lleva reply_to y el pie con la cuenta que envía (escapada)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    await sendReportEmail({ to: 'c@x.com', clientName: '', month: '2026-09', pdfBase64: 'aG9sYQ==', filename: 'r.pdf', senderEmail: 'ase<sor>@x.com' }, CONFIG)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.reply_to).toBe('ase<sor>@x.com')
    expect(body.html).toContain('Enviado por ase&lt;sor&gt;@x.com con MOY IQ')
    expect(body.html).not.toMatch(/¡|!(?!doctype html>)/)
  })

  it('sin senderEmail no agrega reply_to ni pie', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    await sendReportEmail({ to: 'c@x.com', clientName: '', month: '2026-09', pdfBase64: 'aG9sYQ==', filename: 'r.pdf' }, CONFIG)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).not.toHaveProperty('reply_to')
    expect(body.html).not.toContain('Enviado por')
  })
})

describe('sendReportEmail', () => {
  const params = { to: 'cliente@ejemplo.com', clientName: 'Sofía', month: '2026-09', pdfBase64: 'aG9sYQ==', filename: 'reporte.pdf' }

  it('falla sin llamar a la red si no hay RESEND_API_KEY', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const result = await sendReportEmail(params, { ...CONFIG, resendApiKey: undefined })
    expect(result).toEqual({ ok: false, error: 'resend_not_configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('envía el PDF como attachment en el primer intento', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    expect(await sendReportEmail(params, CONFIG)).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.attachments).toEqual([{ filename: 'reporte.pdf', content: 'aG9sYQ==' }])
    expect(body.to).toBe('cliente@ejemplo.com')
  })

  it('reintenta una vez ante un fallo transitorio y tiene éxito', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'down' })
      .mockResolvedValueOnce({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    expect(await sendReportEmail(params, CONFIG)).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('devuelve error si Resend falla dos veces seguidas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'down' }))
    expect(await sendReportEmail(params, CONFIG)).toEqual({ ok: false, error: 'resend_500' })
  })
})

describe('sendReportEmail por idioma (lang del cliente)', () => {
  afterEach(() => { vi.unstubAllGlobals() })
  const base = { to: 'cliente@ejemplo.com', clientName: 'Sofía', month: '2026-09', pdfBase64: 'aG9sYQ==', filename: 'r.pdf' }
  async function body(lang?: 'es' | 'en' | 'pt' | 'de', clientName = 'Sofía') {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    await sendReportEmail({ ...base, clientName, lang }, CONFIG)
    return JSON.parse(fetchMock.mock.calls[0][1].body)
  }
  it.each([
    ['es', 'Reporte financiero — septiembre de 2026'],
    ['en', 'Financial report — September 2026'],
    ['pt', 'Relatório financeiro — setembro de 2026'],
    ['de', 'Finanzbericht – September 2026'],
  ] as const)('%s', async (lang, subject) => {
    const b = await body(lang)
    expect(b.subject).toBe(subject)
    expect(b.html).toContain(`lang="${lang}"`)
  })
  it('sin lang: español', async () => {
    expect((await body()).subject).toBe('Reporte financiero — septiembre de 2026')
  })
  it('pickLang descarta valores inválidos', () => {
    expect(pickLang('xx')).toBe('es')
    expect(pickLang('en')).toBe('en')
  })
  it('el nombre del cliente se escapa en el HTML', async () => {
    const b = await body('en', '<b>x</b>')
    expect(b.html).toContain('&lt;b&gt;x&lt;/b&gt;')
    expect(b.html).not.toContain('<b>x</b>')
  })
})

// Auditoría 360, C-05 / VEN-3: send-report-email leía solo RESEND_API_KEY (secret del
// 29-jun, 403 desde @moyiq.app). index.ts arma la config con resolveResendApiKey.
describe('C-05 · clave de Resend del reporte por correo', () => {
  afterEach(() => { vi.unstubAllGlobals() })
  const params = { to: 'cliente@ejemplo.com', clientName: 'Sofía', month: '2026-09', pdfBase64: 'aG9sYQ==', filename: 'reporte.pdf' }
  const configFromEnv = (vars: Record<string, string | undefined>) => ({
    supabaseUrl: 'https://proj.supabase.co', serviceRole: 'srv-key',
    resendApiKey: resolveResendApiKey((name) => vars[name]),
    fromEmail: 'MOY IQ <licencias@moyiq.app>',
  })

  it('con las dos claves cargadas, el reporte sale con NURTURE_RESEND_API_KEY', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const cfg = configFromEnv({ NURTURE_RESEND_API_KEY: 're_nurture', RESEND_API_KEY: 're_vieja' })
    expect(await sendReportEmail(params, cfg)).toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.headers.Authorization).toBe('Bearer re_nurture')
    expect(JSON.parse(init.body).from).toBe('MOY IQ <licencias@moyiq.app>')
  })

  it('si solo existe RESEND_API_KEY se usa como respaldo', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    expect(await sendReportEmail(params, configFromEnv({ RESEND_API_KEY: 're_vieja' }))).toEqual({ ok: true })
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer re_vieja')
  })

  it('sin ninguna de las dos claves no llama a la red', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await sendReportEmail(params, configFromEnv({}))).toEqual({ ok: false, error: 'resend_not_configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
