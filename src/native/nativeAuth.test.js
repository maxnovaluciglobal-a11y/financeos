// NAT-5 / SEC-N2: la vuelta moyiq://auth-callback solo inicia sesión si esta
// app inició un OAuth hace menos de 10 minutos, y nunca con tokens del fragmento.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const browser = { open: vi.fn(() => Promise.resolve()), close: vi.fn(() => Promise.resolve()) }
vi.mock('@capacitor/core', () => ({ registerPlugin: () => browser }))

const {
  nativeOAuth, completeNativeOAuth, takeOAuthPending, markOAuthPending,
  OAUTH_PENDING_KEY, OAUTH_PENDING_TTL_MS,
} = await import('./nativeAuth.js')

function memStorage() {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)) },
    removeItem: (k) => { m.delete(k) },
    has: (k) => m.has(k),
  }
}

function client() {
  return {
    auth: {
      signInWithOAuth: vi.fn(async () => ({ data: { url: 'https://auth.example/authorize' }, error: null })),
      exchangeCodeForSession: vi.fn(async () => ({ error: null })),
      setSession: vi.fn(async () => ({ error: null })),
    },
  }
}

let storage
beforeEach(() => { storage = memStorage(); vi.clearAllMocks() })

describe('completeNativeOAuth', () => {
  it('ignora un callback sin OAuth en curso (enlace de terceros)', async () => {
    const c = client()
    const r = await completeNativeOAuth(c, { code: 'abc' }, { storage })
    expect(r).toEqual({ error: 'oauth_not_pending', ignored: true })
    expect(c.auth.exchangeCodeForSession).not.toHaveBeenCalled()
    expect(browser.close).not.toHaveBeenCalled()
  })

  it('canjea el code si la app inició el OAuth, y la marca es de un solo uso', async () => {
    const c = client()
    expect(await nativeOAuth(c, 'google', { storage })).toEqual({})
    expect(storage.has(OAUTH_PENDING_KEY)).toBe(true)
    expect(browser.open).toHaveBeenCalledOnce()
    expect(await completeNativeOAuth(c, { code: 'abc' }, { storage })).toEqual({})
    expect(c.auth.exchangeCodeForSession).toHaveBeenCalledWith('abc')
    expect(storage.has(OAUTH_PENDING_KEY)).toBe(false)
    const again = await completeNativeOAuth(c, { code: 'abc' }, { storage })
    expect(again.ignored).toBe(true)
    expect(c.auth.exchangeCodeForSession).toHaveBeenCalledOnce()
  })

  it('nunca usa tokens del fragmento, aunque haya un OAuth en curso', async () => {
    const c = client()
    markOAuthPending('google', { storage })
    const r = await completeNativeOAuth(c, { code: null, hash: '#access_token=a&refresh_token=b' }, { storage })
    expect(r).toEqual({ error: 'oauth_no_code' })
    expect(c.auth.setSession).not.toHaveBeenCalled()
  })

  it('la marca vence a los 10 minutos', async () => {
    const c = client()
    const t0 = 1_800_000_000_000
    markOAuthPending('google', { storage, now: t0 })
    const r = await completeNativeOAuth(c, { code: 'abc' }, { storage, now: t0 + OAUTH_PENDING_TTL_MS + 1 })
    expect(r.ignored).toBe(true)
    expect(c.auth.exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('devuelve el error del canje o del proveedor (para mostrarlo en el acceso)', async () => {
    const c = client()
    c.auth.exchangeCodeForSession.mockResolvedValueOnce({ error: { message: 'invalid flow state' } })
    markOAuthPending('google', { storage })
    expect(await completeNativeOAuth(c, { code: 'abc' }, { storage })).toEqual({ error: 'invalid flow state' })
    markOAuthPending('google', { storage })
    expect(await completeNativeOAuth(c, { code: null, error: 'User cancelled' }, { storage })).toEqual({ error: 'User cancelled' })
  })

  it('si no se pudo abrir el navegador, no queda la marca', async () => {
    const c = client()
    browser.open.mockRejectedValueOnce(new Error('no browser'))
    expect(await nativeOAuth(c, 'google', { storage })).toEqual({ error: 'no browser' })
    expect(storage.has(OAUTH_PENDING_KEY)).toBe(false)
  })

  it('marca corrupta o con fecha futura no vale', () => {
    storage.setItem(OAUTH_PENDING_KEY, '{nope')
    expect(takeOAuthPending({ storage })).toBe(false)
    storage.setItem(OAUTH_PENDING_KEY, JSON.stringify({ at: Date.now() + 60_000 }))
    expect(takeOAuthPending({ storage })).toBe(false)
  })
})
