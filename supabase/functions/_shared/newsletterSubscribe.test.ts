import { describe, it, expect, vi, afterEach } from 'vitest'
import { autoSubscribeEnabled, subscribeToNewsletter } from './newsletterSubscribe.ts'

describe('autoSubscribeEnabled', () => {
  it('solo "true" exacto la prende; sin variable queda apagada', () => {
    expect(autoSubscribeEnabled('true')).toBe(true)
    for (const v of [undefined, null, '', 'false', 'TRUE', '1', 'yes']) expect(autoSubscribeEnabled(v as any)).toBe(false)
  })
})

describe('subscribeToNewsletter', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
  const cfg = { proxyUrl: 'https://proxy.example/api/subscribe', proxyToken: 't' }

  it('ok solo con 2xx y avisa si el contacto estaba dado de baja', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, unsubscribed: true }) }))
    expect(await subscribeToNewsletter('a@x.com', 'moyiq', cfg)).toEqual({ ok: true, status: 200, unsubscribed: true })
  })

  it('error del proxy: ok false y el log no lleva el correo', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'unauthorized' }))
    expect(await subscribeToNewsletter('secreto@x.com', 'invest', cfg)).toEqual({ ok: false, status: 401 })
    expect(err.mock.calls.flat().join(' ')).not.toContain('secreto@x.com')
  })

  it('sin email o sin config no llama a la red', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    expect((await subscribeToNewsletter(null, 'moyiq', cfg)).ok).toBe(false)
    expect((await subscribeToNewsletter('a@x.com', 'moyiq', {})).ok).toBe(false)
    expect(f).not.toHaveBeenCalled()
  })
})
