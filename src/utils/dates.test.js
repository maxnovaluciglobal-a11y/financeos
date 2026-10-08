// Fecha "de hoy" en hora LOCAL (B1). Antes se usaba toISOString(), que da la
// fecha en UTC: en LatAm, después de ~21 h, un gasto quedaba con fecha de mañana.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { localDateStr, localMonthStr, today, currentMonth } from './index.js'

afterEach(() => { vi.useRealTimers() })

describe('localDateStr / localMonthStr', () => {
  it('usa los getters locales, no UTC', () => {
    // 23:30 hora local del 31-ene: en UTC-3 ya sería 1-feb.
    const d = new Date(2026, 0, 31, 23, 30, 0)
    expect(localDateStr(d)).toBe('2026-01-31')
    expect(localMonthStr(d)).toBe('2026-01')
  })

  it('rellena mes y día con cero a la izquierda', () => {
    const d = new Date(2026, 2, 5, 9, 0, 0)
    expect(localDateStr(d)).toBe('2026-03-05')
    expect(localMonthStr(d)).toBe('2026-03')
  })

  it('coincide con la fecha local aunque toISOString ya esté en el día siguiente', () => {
    const d = new Date(2026, 9, 7, 23, 59, 0)
    const offsetMin = d.getTimezoneOffset()
    expect(localDateStr(d)).toBe('2026-10-07')
    // Solo en zonas al oeste de UTC el bug original se manifiesta a esta hora.
    if (offsetMin > 0) expect(d.toISOString().slice(0, 10)).toBe('2026-10-08')
  })
})

describe('today / currentMonth', () => {
  it('devuelven la fecha y el mes locales del reloj actual', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 11, 31, 22, 15, 0))
    expect(today()).toBe('2026-12-31')
    expect(currentMonth()).toBe('2026-12')
  })
})
