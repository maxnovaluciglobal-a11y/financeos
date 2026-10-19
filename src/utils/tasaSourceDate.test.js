// FIN-17 (auditoría 360): la fecha de la tasa es la de la fuente, no la de la
// consulta, y el respaldo de AR lleva su fecha fija.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { loadTasaVE, sourceDate } from './tasaVE.js'
import { loadTasaAR, FALLBACK_AT as AR_FALLBACK_AT } from './tasaAR.js'
import { rateOptions } from './refRate.js'

const store = new Map()
beforeEach(() => {
  store.clear()
  globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) }
})
afterEach(() => { vi.unstubAllGlobals(); delete globalThis.localStorage })

describe('fecha de la tasa (FIN-17)', () => {
  it('VE: guarda la fecha de publicación del BCV (16-oct), no la de hoy', async () => {
    vi.stubGlobal('fetch', async () => ({ json: async () => ([
      { fuente: 'oficial', promedio: 880, fechaActualizacion: '2026-10-16T00:00:00-04:00' },
      { fuente: 'paralelo', promedio: 1000, fechaActualizacion: '2026-10-18T18:00:00.000Z' },
    ]) }))
    const r = await loadTasaVE()
    expect(r.at).toBe(Date.parse('2026-10-16T00:00:00-04:00'))
    expect(r.paraleloAt).toBe(Date.parse('2026-10-18T18:00:00.000Z'))
    const opts = rateOptions({ country: 'VE', currency: 'VES' }, { ve: r })
    expect(opts[0].at).toBe(Date.parse('2026-10-16T00:00:00-04:00'))
  })

  it('AR: sin red, el respaldo lleva su fecha fija y no la de hoy', async () => {
    vi.stubGlobal('fetch', async () => { throw new Error('offline') })
    const r = await loadTasaAR()
    expect(r.source).toBe('fallback')
    expect(r.at).toBe(AR_FALLBACK_AT)
    expect(r.ts).toBe(AR_FALLBACK_AT)
  })

  it('sourceDate cae al respaldo si la fecha no se puede leer', () => {
    expect(sourceDate('basura', 5)).toBe(5)
    expect(sourceDate(undefined, 7)).toBe(7)
  })
})
