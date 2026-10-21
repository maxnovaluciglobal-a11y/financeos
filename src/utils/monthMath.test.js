// FIN-15: fechas de fin de deuda y de metas sugeridas sin el desborde de setMonth.
import { describe, it, expect } from 'vitest'
import { monthsAheadFirstDay } from './monthMath.js'
import { localMonthStr } from './index.js'

describe('monthsAheadFirstDay (FIN-15)', () => {
  it('31 de enero + 1 mes es febrero, no marzo', () => {
    const d = monthsAheadFirstDay(new Date(2026, 0, 31), 1)
    expect(localMonthStr(d)).toBe('2026-02')
    // lo que hacía setMonth:
    const old = new Date(2026, 0, 31); old.setMonth(old.getMonth() + 1)
    expect(localMonthStr(old)).toBe('2026-03')
  })
  it('31 de octubre + 4 meses es febrero del año siguiente', () => {
    expect(localMonthStr(monthsAheadFirstDay(new Date(2026, 9, 31), 4))).toBe('2027-02')
  })
  it('29 de febrero (bisiesto) + 12 meses es febrero', () => {
    expect(localMonthStr(monthsAheadFirstDay(new Date(2028, 1, 29), 12))).toBe('2029-02')
  })
  it('0 meses es el mes en curso y siempre día 1', () => {
    const d = monthsAheadFirstDay(new Date(2026, 4, 30), 0)
    expect(localMonthStr(d)).toBe('2026-05')
    expect(d.getDate()).toBe(1)
  })
})
