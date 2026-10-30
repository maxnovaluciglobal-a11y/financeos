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

describe('B2b: ventanas del historial en el conversor', async () => {
  const { historyWindow, shiftDate, sparkPath, HIST_WINDOWS, HIST_DEFAULT_WINDOW } = await import('./refHistory.js')
  const rows = [
    ['2026-07-15', 700], ['2026-09-26', 830], ['2026-09-29', 832.1], ['2026-10-05', 850],
    ['2026-10-20', 900], ['2026-10-23', 870], ['2026-10-29', 888.9],
  ]

  it('7, 30 y 90 días; 30 por defecto', () => {
    expect(HIST_WINDOWS).toEqual([7, 30, 90])
    expect(HIST_DEFAULT_WINDOW).toBe(30)
  })

  it('shiftDate en UTC, también al cruzar meses y años', () => {
    expect(shiftDate('2026-10-30', -30)).toBe('2026-09-30')
    expect(shiftDate('2026-01-03', -7)).toBe('2025-12-27')
    expect(shiftDate('nope', 1)).toBe(null)
  })

  it('arranca en la tasa vigente al inicio (con su fecha real) y resume la ventana', () => {
    const w = historyWindow(rows, 30, '2026-10-30')
    expect(w.start).toBe('2026-09-30')
    expect(w.points.map(p => p.date)).toEqual(['2026-09-29', '2026-10-05', '2026-10-20', '2026-10-23', '2026-10-29'])
    expect(w.first).toEqual({ date: '2026-09-29', value: 832.1 })
    expect(w.last).toEqual({ date: '2026-10-29', value: 888.9 })
    expect(w.min).toEqual({ date: '2026-09-29', value: 832.1 })
    expect(w.max).toEqual({ date: '2026-10-20', value: 900 })
    expect(w.change).toBeCloseTo(888.9 / 832.1 - 1, 10)
  })

  it('7 días: punto de partida + los de la semana; 90 días toma desde julio', () => {
    const w7 = historyWindow(rows, 7, '2026-10-30')
    expect(w7.points.map(p => p.date)).toEqual(['2026-10-23', '2026-10-29'])
    const w90 = historyWindow(rows, 90, '2026-10-30')
    expect(w90.first.value).toBe(700)
    expect(w90.points).toHaveLength(7)
  })

  it('sin datos suficientes: null (la pantalla no dibuja nada)', () => {
    expect(historyWindow(null, 30, '2026-10-30')).toBe(null)
    expect(historyWindow([], 30, '2026-10-30')).toBe(null)
    expect(historyWindow([['2026-10-29', 888]], 30, '2026-10-30')).toBe(null)
    // Caché vieja (sin red): nada dentro de la semana, solo el punto de partida.
    expect(historyWindow([['2026-10-01', 850], ['2026-10-05', 860]], 7, '2026-10-30')).toBe(null)
  })

  it('la demo (una tasa por mes) también arma la ventana de 30 días', () => {
    const monthly = historyFromMonthly({ '2026-09': { bcv: 832.15 }, '2026-10': { bcv: 885.4 } })
    const w = historyWindow(monthly, 30, '2026-10-30')
    expect(w.first.value).toBe(832.15)
    expect(w.last.value).toBe(885.4)
  })

  it('sparkPath: de borde a borde, máximo arriba, serie plana al medio', () => {
    const w = historyWindow(rows, 30, '2026-10-30')
    const d = sparkPath(w, { width: 300, height: 64, pad: 4 })
    const pts = d.split(/[ML]/).filter(Boolean).map(p => p.trim().split(' ').map(Number))
    expect(pts[0][0]).toBe(4) // el punto de partida (29 sep) se dibuja en el borde izquierdo
    expect(pts[2][1]).toBe(4) // 900 = máx. → arriba
    expect(pts[0][1]).toBe(60) // 832,1 = mín. → abajo
    const flat = historyWindow([['2026-10-01', 5], ['2026-10-20', 5]], 30, '2026-10-30')
    expect(sparkPath(flat, { width: 300, height: 64 })).toMatch(/^M[\d.]+ 32\.0 L[\d.]+ 32\.0$/)
    expect(sparkPath(null)).toBe('')
  })
})
