// SEG-1 / SEG-7: helpers de Turnstile (sin site key todo sigue como antes).
import { describe, it, expect, vi } from 'vitest'
import { turnstileSiteKey, createTokenBox, isCaptchaError, leadSubmitBody, withCaptcha, loadTurnstile } from './turnstile.js'

describe('turnstile', () => {
  it('site key: vacía o con espacios = apagado', () => {
    expect(turnstileSiteKey({})).toBe('')
    expect(turnstileSiteKey({ VITE_TURNSTILE_SITE_KEY: '  ' })).toBe('')
    expect(turnstileSiteKey({ VITE_TURNSTILE_SITE_KEY: ' 0x4AAA ' })).toBe('0x4AAA')
  })

  it('caja de tokens: entrega el vigente una sola vez', async () => {
    const box = createTokenBox()
    box.put('tok-1')
    expect(await box.take()).toBe('tok-1')
    expect(box.peek()).toBe('')
  })

  it('caja de tokens: espera el token que llega después', async () => {
    const box = createTokenBox()
    const p = box.take(1000)
    box.put('tok-2')
    expect(await p).toBe('tok-2')
  })

  it('caja de tokens: si el widget falla o vence el plazo, devuelve vacío', async () => {
    const box = createTokenBox()
    const p = box.take(1000)
    box.fail()
    expect(await p).toBe('')
    vi.useFakeTimers()
    const q = box.take(50)
    vi.advanceTimersByTime(60)
    expect(await q).toBe('')
    vi.useRealTimers()
  })

  it('reconoce los errores de captcha de Supabase Auth', () => {
    expect(isCaptchaError('captcha protection: request disallowed (no captcha response (captcha_token) found in request)')).toBe(true)
    expect(isCaptchaError('captcha verification process failed')).toBe(true)
    expect(isCaptchaError('Invalid login credentials')).toBe(false)
  })

  it('cuerpo de lead-submit: el token solo viaja si existe', () => {
    expect(leadSubmitBody('register_demo_lead', { p_email: 'a@b.co' }, '')).toEqual({ rpc: 'register_demo_lead', args: { p_email: 'a@b.co' } })
    expect(leadSubmitBody('register_demo_lead', {}, 't')).toEqual({ rpc: 'register_demo_lead', args: {}, turnstileToken: 't' })
  })

  it('opciones de Auth: captchaToken solo si hay token', () => {
    expect(withCaptcha({ redirectTo: 'x' }, '')).toEqual({ redirectTo: 'x' })
    expect(withCaptcha({ redirectTo: 'x' }, 'c')).toEqual({ redirectTo: 'x', captchaToken: 'c' })
    expect(withCaptcha(undefined, undefined)).toEqual({})
  })

  it('loadTurnstile inserta api.js una sola vez y usa window.turnstile si ya existe', async () => {
    const appended = []
    const doc = { createElement: () => ({}), head: { appendChild: (s) => { appended.push(s); s.onload() } } }
    const win = {}
    const p = loadTurnstile(doc, win)
    // onload corre sincrónico en el doble: sin window.turnstile rechaza
    await expect(p).rejects.toThrow('turnstile_missing')
    const ts = { render() {} }
    expect(await loadTurnstile(doc, { turnstile: ts })).toBe(ts)
    expect(appended[0].src).toBe('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit')
  })
})
