import { describe, it, expect } from 'vitest'
import { monthKeys, totalForMonth, cumulativeByDay, prevMonthKey } from './chartSeries.js'

describe('series de gráficos (UI-M6)', () => {
  const now = new Date(2026, 9, 21)
  it('monthKeys: ventana actual y período anterior', () => {
    expect(monthKeys(3, 0, now)).toEqual(['2026-08', '2026-09', '2026-10'])
    expect(monthKeys(3, 3, now)).toEqual(['2026-05', '2026-06', '2026-07'])
    expect(monthKeys(2, 0, new Date(2026, 0, 5))).toEqual(['2025-12', '2026-01'])
  })
  it('totalForMonth', () => {
    expect(totalForMonth([{ date: '2026-10-01', amount: 10 }, { date: '2026-09-30', amount: 5 }, { date: '2026-10-09', amount: '2.5' }], '2026-10')).toBe(12.5)
  })
  it('prevMonthKey cruza el año', () => {
    expect(prevMonthKey('2026-01')).toBe('2025-12')
  })
  it('cumulativeByDay: corta el mes en curso en hoy y compara con el mes anterior', () => {
    const recs = [
      { date: '2026-10-02', amount: 100 }, { date: '2026-10-21', amount: 50 },
      { date: '2026-09-01', amount: 30 }, { date: '2026-09-30', amount: 70 },
    ]
    const s = cumulativeByDay(recs, '2026-10', now)
    expect(s).toHaveLength(31)
    expect(s[0]).toEqual({ day: 1, current: 0, currentPrev: 30 })
    expect(s[1].current).toBe(100)
    expect(s[20].current).toBe(150)
    expect(s[21].current).toBe(null)
    expect(s[29].currentPrev).toBe(100)
    expect(s[30].currentPrev).toBe(100) // septiembre no tiene 31
  })
  it('un mes cerrado no se corta', () => {
    const s = cumulativeByDay([{ date: '2026-09-15', amount: 9 }], '2026-09', now)
    expect(s[29].current).toBe(9)
  })
})
