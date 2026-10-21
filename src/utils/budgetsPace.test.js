import { describe, it, expect } from 'vitest'
import { categoryState, monthElapsed, budgetPace } from './budgets.js'

describe('categoryState (UI-M5): estado en palabras por categoría', () => {
  it('sin límite = sin asignar', () => {
    expect(categoryState(50, 0)).toBe('unassigned')
    expect(categoryState(50, undefined)).toBe('unassigned')
  })
  it('a tiempo, cerca del límite (desde el 80 %) y excedido (solo si supera)', () => {
    expect(categoryState(10, 100)).toBe('ok')
    expect(categoryState(80, 100)).toBe('near')
    expect(categoryState(100, 100)).toBe('near')
    expect(categoryState(100.01, 100)).toBe('over')
  })
})

describe('monthElapsed', () => {
  const today = new Date(2026, 9, 21) // 21-oct-2026
  it('mes en curso', () => {
    expect(monthElapsed('2026-10', today)).toMatchObject({ day: 21, days: 31, daysLeft: 11, closed: false })
  })
  it('mes cerrado cuenta entero; futuro, nada', () => {
    expect(monthElapsed('2026-09', today)).toMatchObject({ ratio: 1, daysLeft: 0, closed: true })
    expect(monthElapsed('2026-11', today)).toMatchObject({ ratio: 0, daysLeft: 30 })
  })
})

describe('budgetPace', () => {
  const today = new Date(2026, 9, 21)
  it('a buen ritmo cuando el uso no supera al tiempo', () => {
    const p = budgetPace({ spent: 600, total: 1000, activeMonth: '2026-10', today })
    expect(p.pace).toBe('ok')
    expect(p.left).toBe(400)
    expect(p.perDay).toBeCloseTo(400 / 11)
  })
  it('más rápido de lo previsto', () => {
    expect(budgetPace({ spent: 800, total: 1000, activeMonth: '2026-10', today }).pace).toBe('fast')
  })
  it('excedido y sin gasto por día', () => {
    const p = budgetPace({ spent: 1001, total: 1000, activeMonth: '2026-10', today })
    expect(p.pace).toBe('over')
    expect(p.perDay).toBe(0)
  })
  it('sin presupuesto no hay ritmo', () => {
    expect(budgetPace({ spent: 10, total: 0, activeMonth: '2026-10', today }).pace).toBe(null)
  })
})
