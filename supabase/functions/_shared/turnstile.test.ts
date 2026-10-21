import { describe, it, expect, vi } from 'vitest'
import {
  checkTurnstile, extractTurnstileToken, clientIp, isEnforced, turnstileConfigFromEnv,
  turnstileErrorBody, siteverify, SITEVERIFY_URL,
} from './turnstile.ts'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

function cf(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const fetchImpl = vi.fn(async (url: string, init: RequestInit = {}) => { calls.push({ url, init }); return handler(url, init) })
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls }
}

describe('turnstile (SEG-1): configuración', () => {
  it('TURNSTILE_ENFORCE apagado por defecto; solo 1/true/on/yes lo prenden', () => {
    for (const v of [undefined, '', '0', 'false', 'off', 'no', 'enforce']) expect(isEnforced(v)).toBe(false)
    for (const v of ['1', 'true', 'TRUE', ' on ', 'yes']) expect(isEnforced(v)).toBe(true)
  })
  it('lee el secreto y el modo de las variables de entorno', () => {
    const env: Record<string, string> = { TURNSTILE_SECRET_KEY: ' s3cr3t ', TURNSTILE_ENFORCE: '1' }
    expect(turnstileConfigFromEnv((n) => env[n])).toEqual({ secret: 's3cr3t', enforce: true })
    expect(turnstileConfigFromEnv(() => undefined)).toEqual({ secret: null, enforce: false })
  })
  it('toma el token del body o del encabezado', () => {
    expect(extractTurnstileToken({ turnstileToken: ' abc ' })).toBe('abc')
    expect(extractTurnstileToken({ 'cf-turnstile-response': 'def' })).toBe('def')
    expect(extractTurnstileToken({}, new Headers({ 'cf-turnstile-response': 'ghi' }))).toBe('ghi')
    for (const b of [null, {}, { turnstileToken: 5 }, { turnstileToken: '' }, { turnstileToken: 'x'.repeat(3000) }]) {
      expect(extractTurnstileToken(b)).toBeNull()
    }
  })
  it('IP del visitante: cf-connecting-ip, después x-forwarded-for, después x-real-ip', () => {
    expect(clientIp(new Headers({ 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' }))).toBe('1.1.1.1')
    expect(clientIp(new Headers({ 'x-forwarded-for': '2.2.2.2, 10.0.0.1' }))).toBe('2.2.2.2')
    expect(clientIp(new Headers({ 'x-real-ip': '3.3.3.3' }))).toBe('3.3.3.3')
    expect(clientIp(new Headers())).toBeNull()
  })
})

describe('turnstile (SEG-1): decisión', () => {
  it('sin secreto pasa todo y no llama a Cloudflare (modo apagado)', async () => {
    const { fetchImpl, calls } = cf(() => json({ success: false }))
    for (const enforce of [false, true]) {
      expect(await checkTurnstile(null, { secret: null, enforce, fetchImpl })).toMatchObject({ allow: true, reason: 'no_secret' })
    }
    expect(calls).toHaveLength(0)
  })
  it('con secreto y sin TURNSTILE_ENFORCE nunca bloquea (modo observar)', async () => {
    const { fetchImpl, calls } = cf(() => json({ success: false, 'error-codes': ['invalid-input-response'] }))
    expect(await checkTurnstile(null, { secret: 's', fetchImpl })).toMatchObject({ allow: true, reason: 'not_enforced' })
    expect(calls).toHaveLength(0)
    const d = await checkTurnstile('tok', { secret: 's', fetchImpl })
    expect(d).toMatchObject({ allow: true, reason: 'not_enforced', codes: ['invalid-input-response'] })
    expect(calls).toHaveLength(1)
  })
  it('con enforce: sin token → 403 sin llamar a Cloudflare', async () => {
    const { fetchImpl, calls } = cf(() => json({ success: true }))
    expect(await checkTurnstile(null, { secret: 's', enforce: true, fetchImpl })).toEqual({ allow: false, status: 403, reason: 'missing_token' })
    expect(calls).toHaveLength(0)
  })
  it('con enforce: token válido pasa; manda secret, response y remoteip a siteverify', async () => {
    const { fetchImpl, calls } = cf(() => json({ success: true, hostname: 'moyiq.app' }))
    expect(await checkTurnstile('tok', { secret: 's', enforce: true, fetchImpl }, '1.2.3.4')).toMatchObject({ allow: true, reason: 'valid' })
    expect(calls[0].url).toBe(SITEVERIFY_URL)
    expect(calls[0].init.method).toBe('POST')
    const form = calls[0].init.body as URLSearchParams
    expect(form.get('secret')).toBe('s')
    expect(form.get('response')).toBe('tok')
    expect(form.get('remoteip')).toBe('1.2.3.4')
  })
  it('con enforce: token inválido, vencido o repetido → 403', async () => {
    for (const code of ['invalid-input-response', 'timeout-or-duplicate']) {
      const { fetchImpl } = cf(() => json({ success: false, 'error-codes': [code] }))
      expect(await checkTurnstile('tok', { secret: 's', enforce: true, fetchImpl })).toMatchObject({ allow: false, status: 403, reason: 'invalid_token', codes: [code] })
    }
  })
  it('con enforce: Cloudflare caído, 5xx, internal-error o timeout → 503 (fail-closed)', async () => {
    const handlers = [
      () => { throw new Error('net') },
      () => json({}, 502),
      () => json({ success: false, 'error-codes': ['internal-error'] }),
    ]
    for (const h of handlers) {
      const { fetchImpl } = cf(h as any)
      expect(await checkTurnstile('tok', { secret: 's', enforce: true, fetchImpl })).toMatchObject({ allow: false, status: 503, reason: 'verify_unavailable' })
    }
    const slow = cf((_u, init) => new Promise((_, rej) => init.signal!.addEventListener('abort', () => rej(Object.assign(new Error('a'), { name: 'AbortError' })))))
    expect(await siteverify('tok', 's', { fetchImpl: slow.fetchImpl, timeoutMs: 10 })).toEqual({ ok: false, success: false, codes: ['timeout'] })
  })
  it('el cuerpo de rechazo no expone detalles', () => {
    expect(turnstileErrorBody({ allow: false, status: 403, reason: 'invalid_token', codes: ['x'] })).toEqual({ ok: false, error: 'captcha_failed' })
    expect(turnstileErrorBody({ allow: false, status: 503, reason: 'verify_unavailable' })).toEqual({ ok: false, error: 'captcha_unavailable' })
  })
})
