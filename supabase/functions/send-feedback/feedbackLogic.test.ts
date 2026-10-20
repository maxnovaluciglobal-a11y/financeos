import { describe, it, expect, vi, afterEach } from 'vitest'
import { parseFeedback, claimFeedback, claimNps, sendFeedbackEmail, renderFeedbackEmail, MAX_MESSAGE } from './feedbackLogic.ts'
import { corsHeaders, ALLOWED_ORIGINS, FALLBACK_ORIGIN } from './cors.ts'

const CONFIG = { supabaseUrl: 'https://p.supabase.co', serviceRole: 'srv', resendApiKey: 're', supportEmail: 'support@moyiq.app', fromEmail: 'MOY IQ <hola@moyiq.app>' }
afterEach(() => { vi.unstubAllGlobals() })

describe('send-feedback (C-39 / PRD-5): entrada', () => {
  it('acepta texto, NPS 0–10 opcional, registro y meta conocida', () => {
    expect(parseFeedback({ message: ' Hola ', nps: 9, log: 'err', meta: { lang: 'es', plan: 'pro', amount: '100' } }))
      .toEqual({ message: 'Hola', nps: 9, log: 'err', meta: { lang: 'es', plan: 'pro' } })
    expect(parseFeedback({ message: 'x' })).toEqual({ message: 'x', nps: null, log: null, meta: {} })
  })
  it('rechaza vacío, demasiado largo o NPS fuera de rango', () => {
    for (const b of [null, {}, { message: '   ' }, { message: 'a'.repeat(MAX_MESSAGE + 1) }, { message: 'x', nps: 11 }, { message: 'x', nps: 2.5 }, { message: 'x', nps: '9' }]) {
      expect(parseFeedback(b)).toBeNull()
    }
  })
})

describe('send-feedback: tope y envío', () => {
  it('claimFeedback interpreta la RPC', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }))
    expect(await claimFeedback('u', CONFIG)).toBe('ok')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: false, error: 'rate_limited' }) }))
    expect(await claimFeedback('u', CONFIG)).toBe('rate_limited')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))
    expect(await claimFeedback('u', CONFIG)).toBe('claim_failed')
  })
  it('manda a soporte con reply-to de la cuenta y escapa el HTML', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', f)
    expect(await sendFeedbackEmail({ message: '<b>hola</b>', nps: 3, log: null, meta: { lang: 'es' } }, { email: 'ana@x.com' }, CONFIG)).toEqual({ ok: true })
    const body = JSON.parse(f.mock.calls[0][1].body)
    expect(body.to).toEqual(['support@moyiq.app'])
    expect(body.reply_to).toBe('ana@x.com')
    expect(body.subject).toContain('NPS 3')
    expect(body.html).toContain('&lt;b&gt;hola&lt;/b&gt;')
  })
  it('sin clave de Resend o con error, lo informa', async () => {
    expect(await sendFeedbackEmail({ message: 'x', nps: null, log: null, meta: {} }, { email: null }, { ...CONFIG, resendApiKey: undefined })).toEqual({ ok: false, error: 'missing_resend_key' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 422 }))
    expect(await sendFeedbackEmail({ message: 'x', nps: null, log: null, meta: {} }, { email: null }, CONFIG)).toEqual({ ok: false, error: 'resend_422' })
  })
  it('el registro técnico va al final del correo', () => {
    const m = renderFeedbackEmail({ message: 'msg', nps: null, log: 'TypeError at x', meta: {} }, { email: 'a@b.co' })
    expect(m.text.indexOf('msg')).toBeLessThan(m.text.indexOf('TypeError'))
  })
})

describe('send-feedback: NPS automático (PRD-5)', () => {
  it('kind nps: puntaje obligatorio, comentario opcional, trigger en meta y nunca montos', () => {
    expect(parseFeedback({ kind: 'nps', nps: 8, message: '', meta: { trigger: 'day14', amount: '9' } }))
      .toEqual({ kind: 'nps', message: '', nps: 8, log: null, meta: { trigger: 'day14' } })
    expect(parseFeedback({ kind: 'nps', message: 'ok' })).toBeNull()
    expect(parseFeedback({ kind: 'nps', nps: 12 })).toBeNull()
  })
  it('claimNps: una vez por cuenta', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }))
    expect(await claimNps('u', CONFIG)).toBe('ok')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: false, error: 'already_answered' }) }))
    expect(await claimNps('u', CONFIG)).toBe('already_answered')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net')))
    expect(await claimNps('u', CONFIG)).toBe('claim_failed')
  })
  it('el correo dice que es el NPS automático y aguanta el comentario vacío', () => {
    const m = renderFeedbackEmail({ kind: 'nps', message: '', nps: 7, log: null, meta: { trigger: 'movements10' } }, { email: 'a@b.co' })
    expect(m.subject).toBe('MOY IQ · NPS automático (NPS 7)')
    expect(m.text).toContain('(sin comentario)')
    expect(m.text).toContain('trigger: movements10')
  })
})

describe('CORS de send-feedback', () => {
  it('solo la app', () => {
    for (const o of ALLOWED_ORIGINS) expect(corsHeaders(o)['Access-Control-Allow-Origin']).toBe(o)
    expect(corsHeaders('https://demo.moyiq.app')['Access-Control-Allow-Origin']).toBe(FALLBACK_ORIGIN)
  })
})
