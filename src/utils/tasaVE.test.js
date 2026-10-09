import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadTasaVE, defaultFuenteVE, DEFAULT_FUENTE_VE, FALLBACK, FALLBACK_AT } from './tasaVE.js'

describe('tasaVE: oficial del BCV por defecto, sin fechas inventadas', () => {
  beforeEach(() => {
    const store = {}
    globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v) }, removeItem: k => { delete store[k] } }
  })

  it('la fuente por defecto es la oficial, aunque haya paralelo', () => {
    expect(DEFAULT_FUENTE_VE).toBe('oficial')
    expect(defaultFuenteVE({ oficial: 874.73, paralelo: 990, paraleloDisponible: true })).toBe('oficial')
  })
  it('sin oficial válida cae al paralelo de forma explícita', () => {
    expect(defaultFuenteVE({ oficial: 0, paralelo: 990, paraleloDisponible: true })).toBe('paralelo')
    expect(defaultFuenteVE(null)).toBe('oficial')
  })
  it('sin red devuelve los valores de respaldo con SU fecha, no la de hoy', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'))
    const d = await loadTasaVE()
    expect(d.source).toBe('fallback')
    expect(d.oficial).toBe(FALLBACK.oficial)
    expect(d.ts).toBe(FALLBACK_AT)
    expect(new Date(d.ts).getMonth()).toBe(7) // agosto
  })
  it('con la API guarda la hora de la consulta', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ json: async () => [{ fuente: 'oficial', promedio: 874.73 }, { fuente: 'paralelo', promedio: 979.08 }] })
    const before = Date.now()
    const d = await loadTasaVE()
    expect(d).toMatchObject({ oficial: 874.73, paralelo: 979.08, source: 'api' })
    expect(d.ts).toBeGreaterThanOrEqual(before)
  })
})
