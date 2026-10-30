import { describe, it, expect, vi } from 'vitest'
import { parseHistory, rateOnOrBefore, historyFromMonthly, loadHistory, histFuente } from './refHistory.js'

const json = [
  { fuente: 'oficial', promedio: 889.2553, fecha: '2026-10-30' },
  { fuente: 'oficial', promedio: 832.1, fecha: '2026-09-29' },
  { fuente: 'oficial', promedio: null, fecha: '2026-09-30' },
  { fuente: 'oficial', promedio: 830, fecha: '2026-09-26' },
]

describe('refHistory (B5)', () => {
  it('parsea, filtra inválidos y ordena', () => {
    expect(parseHistory(json)).toEqual([['2026-09-26', 830], ['2026-09-29', 832.1], ['2026-10-30', 889.2553]])
  })
  it('toma la última tasa en o antes de la fecha (fines de semana sin dato)', () => {
    const rows = parseHistory(json)
    expect(rateOnOrBefore(rows, '2026-09-28')).toBe(830)
    expect(rateOnOrBefore(rows, '2026-09-29')).toBe(832.1)
    expect(rateOnOrBefore(rows, '2026-10-29')).toBe(832.1)
    expect(rateOnOrBefore(rows, '2026-01-01')).toBeNull()
  })
  it('la demo arma su historia con la tasa de cada mes', () => {
    const rows = historyFromMonthly({ '2026-10': { bcv: 885.4 }, '2026-09': { bcv: 832.15 } })
    expect(rateOnOrBefore(rows, '2026-09-29')).toBe(832.15)
    expect(rateOnOrBefore(rows, '2026-10-29')).toBe(885.4)
  })
  it('paralelo solo si el usuario lo eligió', () => {
    expect(histFuente('paralelo')).toBe('paralelo')
    expect(histFuente('bcv')).toBe('oficial')
  })
  it('usa la caché fresca sin red y cae a la vieja si la red falla', async () => {
    const store = new Map()
    const storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => json }))
    const rows = await loadHistory('oficial', { fetchFn, storage, now: 1000 })
    expect(rows).toHaveLength(3)
    await loadHistory('oficial', { fetchFn, storage, now: 2000 })
    expect(fetchFn).toHaveBeenCalledTimes(1)
    const failing = vi.fn(async () => { throw new Error('offline') })
    const old = await loadHistory('oficial', { fetchFn: failing, storage, now: 1000 + 13 * 3600 * 1000 })
    expect(old).toHaveLength(3)
  })
})
