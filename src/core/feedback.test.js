import { describe, it, expect, vi } from 'vitest'
import { sanitizeLogMessage, technicalLog, sendFeedback } from './feedback.js'

describe('comentarios (C-39 / PRD-5)', () => {
  it('el registro técnico no lleva montos', () => {
    expect(sanitizeLogMessage('No se pudo guardar 1.234.567,89 en Comida')).toBe('No se pudo guardar # en Comida')
    expect(technicalLog([{ at: 't', type: 'error', message: 'x 25000', source: 'a.js:10:2' }])).toBe('t | error | x # | a.js:10:2')
  })
  it('solo adjunta el registro si se marca', async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }))
    await sendFeedback({ accessToken: 't', message: 'hola', nps: 8 }, f)
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ message: 'hola', nps: 8, meta: {} })
    await sendFeedback({ accessToken: 't', message: 'hola', includeLog: true }, f)
    expect(JSON.parse(f.mock.calls[1][1].body)).toHaveProperty('log')
    expect(f.mock.calls[0][1].headers.Authorization).toBe('Bearer t')
  })
  it('sin sesión no llama; propaga errores', async () => {
    const f = vi.fn()
    expect(await sendFeedback({ accessToken: '', message: 'x' }, f)).toEqual({ ok: false, error: 'session_required' })
    expect(f).not.toHaveBeenCalled()
    expect(await sendFeedback({ accessToken: 't', message: 'x' }, async () => ({ ok: false, status: 429, json: async () => ({ ok: false, error: 'rate_limited' }) }))).toEqual({ ok: false, error: 'rate_limited' })
    expect(await sendFeedback({ accessToken: 't', message: 'x' }, async () => { throw new Error('x') })).toEqual({ ok: false, error: 'network' })
  })
  it('el NPS automático manda kind nps y el motivo, sin registro técnico', async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }))
    await sendFeedback({ accessToken: 't', message: '', nps: 9, kind: 'nps', meta: { trigger: 'day14' } }, f)
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ kind: 'nps', message: '', nps: 9, meta: { trigger: 'day14' } })
  })
  it('SEG-1: manda turnstileToken solo si hay token', async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }))
    await sendFeedback({ accessToken: 't', message: 'hola', turnstileToken: 'tok' }, f)
    expect(JSON.parse(f.mock.calls[0][1].body).turnstileToken).toBe('tok')
    await sendFeedback({ accessToken: 't', message: 'hola', turnstileToken: '' }, f)
    expect(JSON.parse(f.mock.calls[1][1].body)).not.toHaveProperty('turnstileToken')
    expect(await sendFeedback({ accessToken: 't', message: 'x' }, async () => ({ ok: false, status: 403, json: async () => ({ ok: false, error: 'captcha_failed' }) }))).toEqual({ ok: false, error: 'captcha_failed' })
  })
})
