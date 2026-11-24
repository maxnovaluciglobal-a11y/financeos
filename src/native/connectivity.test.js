import { describe, it, expect, vi } from 'vitest'
import { canStartOAuth, probeReachable, authHealthUrl, hasNetworkForOAuth } from './connectivity.js'

describe('canStartOAuth (AND-14 / R3-1)', () => {
  it('navigator.onLine === false bloquea en cualquier plataforma', async () => {
    expect(await canStartOAuth({ onLine: false, native: false })).toBe(false)
    expect(await canStartOAuth({ onLine: false, native: true, getNetworkStatus: async () => ({ connected: true }) })).toBe(false)
  })

  it('en la web no consulta plugin ni prueba (sin latencia extra)', async () => {
    const probe = vi.fn(async () => false)
    const getNetworkStatus = vi.fn(async () => ({ connected: false }))
    expect(await canStartOAuth({ onLine: true, native: false, probe, getNetworkStatus })).toBe(true)
    expect(probe).not.toHaveBeenCalled()
    expect(getNetworkStatus).not.toHaveBeenCalled()
  })

  it('nativa: onLine en true pero el plugin Network dice sin red → aviso (el caso de la WebView de Android)', async () => {
    const probe = vi.fn(async () => true)
    expect(await canStartOAuth({ onLine: true, native: true, getNetworkStatus: async () => ({ connected: false, connectionType: 'none' }), probe })).toBe(false)
    expect(probe).not.toHaveBeenCalled()
  })

  it('nativa: el plugin dice conectado → abre el navegador sin probar', async () => {
    const probe = vi.fn(async () => false)
    expect(await canStartOAuth({ onLine: true, native: true, getNetworkStatus: async () => ({ connected: true }), probe })).toBe(true)
    expect(probe).not.toHaveBeenCalled()
  })

  it('nativa sin plugin (AAB viejo) o con plugin roto → decide la prueba', async () => {
    expect(await canStartOAuth({ onLine: true, native: true, getNetworkStatus: null, probe: async () => false })).toBe(false)
    expect(await canStartOAuth({ onLine: true, native: true, getNetworkStatus: null, probe: async () => true })).toBe(true)
    expect(await canStartOAuth({ onLine: true, native: true, getNetworkStatus: async () => { throw new Error('x') }, probe: async () => false })).toBe(false)
    expect(await canStartOAuth({ onLine: true, native: true, getNetworkStatus: async () => ({}), probe: async () => false })).toBe(false)
  })

  it('si no hay forma de saberlo, no bloquea', async () => {
    expect(await canStartOAuth({ onLine: undefined, native: true })).toBe(true)
    expect(await canStartOAuth({ onLine: true, native: true, probe: async () => { throw new Error('x') } })).toBe(true)
  })
})

describe('probeReachable', () => {
  it('cualquier respuesta HTTP cuenta como red; un error de red no', async () => {
    expect(await probeReachable('https://x.supabase.co/auth/v1/health', { fetchImpl: async () => ({ status: 401 }) })).toBe(true)
    expect(await probeReachable('https://x.supabase.co/auth/v1/health', { fetchImpl: async () => { throw new TypeError('Failed to fetch') } })).toBe(false)
  })

  it('pide sin caché y corta a los 2,5 s', async () => {
    vi.useFakeTimers()
    try {
      let seen
      const fetchImpl = vi.fn((url, opts) => { seen = opts; return new Promise(() => {}) })
      const p = probeReachable('https://x.supabase.co/auth/v1/health', { fetchImpl })
      await vi.advanceTimersByTimeAsync(2499)
      let done = false
      p.then(() => { done = true })
      await Promise.resolve()
      expect(done).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      expect(await p).toBe(false)
      expect(seen.cache).toBe('no-store')
      expect(seen.signal?.aborted).toBe(true)
    } finally { vi.useRealTimers() }
  })

  it('sin URL o sin fetch no bloquea', async () => {
    expect(await probeReachable('', { fetchImpl: async () => { throw new Error() } })).toBe(true)
    expect(await probeReachable('https://x', { fetchImpl: null })).toBe(true)
  })
})

describe('authHealthUrl', () => {
  it('arma el endpoint de health desde VITE_SUPABASE_URL', () => {
    expect(authHealthUrl('https://abc.supabase.co/')).toBe('https://abc.supabase.co/auth/v1/health')
    expect(authHealthUrl('')).toBe('')
    expect(authHealthUrl(undefined)).toBe('')
  })
})

describe('hasNetworkForOAuth (cableado real)', () => {
  const nativeWin = ({ onLine = true, fetchImpl } = {}) => ({
    navigator: { onLine },
    fetch: fetchImpl,
    Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android', isPluginAvailable: () => false },
  })

  it('en la web con onLine true deja pasar sin fetch', async () => {
    const fetchImpl = vi.fn()
    expect(await hasNetworkForOAuth({ navigator: { onLine: true }, fetch: fetchImpl })).toBe(true)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('nativa sin plugin Network: usa la prueba de fetch al health de Supabase Auth', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co')
    const down = nativeWin({ fetchImpl: async () => { throw new TypeError('offline') } })
    expect(await hasNetworkForOAuth(down)).toBe(false)
    const fetchImpl = vi.fn(async () => ({ status: 200 }))
    expect(await hasNetworkForOAuth(nativeWin({ fetchImpl }))).toBe(true)
    expect(fetchImpl.mock.calls[0][0]).toBe('https://abc.supabase.co/auth/v1/health')
    vi.unstubAllEnvs()
  })

  it('nativa con onLine false no abre el navegador', async () => {
    const fetchImpl = vi.fn(async () => ({ status: 200 }))
    expect(await hasNetworkForOAuth(nativeWin({ onLine: false, fetchImpl }))).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
