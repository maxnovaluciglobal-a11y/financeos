import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('logRejection (ING-5)', () => {
  beforeEach(() => {
    const m = new Map()
    vi.stubGlobal('localStorage', { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) })
  })
  it('una promesa best-effort que falla queda en el registro local con su origen', async () => {
    const { logRejection, getClientErrorLog } = await import('./errorLog.js')
    await Promise.reject(new Error('sin red')).catch(logRejection('sync:169'))
    const [e] = getClientErrorLog()
    expect(e).toMatchObject({ type: 'rejection', message: 'sin red', source: 'sync:169' })
  })
})
