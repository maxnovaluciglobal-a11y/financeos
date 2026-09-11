import { describe, it, expect, vi, afterEach } from 'vitest'
import { isValidEmail, base64ByteLength, isPdfSizeOk, checkProLicense, sendReportEmail } from './reportEmailLogic.ts'

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

describe('checkProLicense', () => {
  it('acepta una licencia Pro válida', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ valid: true, plan: 'pro' }) }))
    expect(await checkProLicense('FNOS-X', CONFIG)).toEqual({ ok: true, plan: 'pro' })
  })
  it('acepta Enterprise también (mismo nivel que Pro para esta feature)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ valid: true, plan: 'enterprise' }) }))
    expect((await checkProLicense('FNOS-X', CONFIG)).ok).toBe(true)
  })
  it('rechaza una licencia Personal válida — Modo Asesor es Pro-only', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ valid: true, plan: 'personal' }) }))
    expect((await checkProLicense('FNOS-X', CONFIG)).ok).toBe(false)
  })
  it('rechaza una licencia inválida/expirada', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ valid: false }) }))
    expect((await checkProLicense('FNOS-X', CONFIG)).ok).toBe(false)
  })
  it('rechaza si la RPC de Supabase falla', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    expect((await checkProLicense('FNOS-X', CONFIG)).ok).toBe(false)
  })
  it('rechaza sin llamar a la red si no hay clave', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect((await checkProLicense('', CONFIG)).ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
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
