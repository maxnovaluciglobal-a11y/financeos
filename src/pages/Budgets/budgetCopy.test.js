import { describe, it, expect } from 'vitest'
import { budgetsFromPreviousMonth, prevMonthKey } from './budgetCopy.js'

const ex = (date, category, amount, extra = {}) => ({ date, category, amount, ...extra })

describe('budgetsFromPreviousMonth (R10)', () => {
  it('mes anterior, incluido el salto de año', () => {
    expect(prevMonthKey('2026-10')).toBe('2026-09')
    expect(prevMonthKey('2026-01')).toBe('2025-12')
  })

  it('un presupuesto por categoría con lo gastado el mes anterior, de mayor a menor', () => {
    const out = budgetsFromPreviousMonth([
      ex('2026-09-02', 'Alimentación', 100.4),
      ex('2026-09-20', 'Alimentación', 50),
      ex('2026-09-05', 'Vivienda', 800),
      ex('2026-10-01', 'Ocio', 999),            // mes activo: no cuenta
      ex('2026-08-30', 'Transporte', 70),       // dos meses atrás: no cuenta
    ], '2026-10')
    expect(out).toEqual([
      { category: 'Vivienda', limit: 800 },
      { category: 'Alimentación', limit: 151 },
    ])
  })

  it('excluye inversión, montos inválidos y categorías que ya tienen presupuesto', () => {
    const out = budgetsFromPreviousMonth([
      ex('2026-09-02', 'Vivienda', 500, { inv: true }),
      ex('2026-09-03', 'Salud', 0),
      ex('2026-09-04', 'Salud', 'x'),
      ex('2026-09-05', 'Ropa', 40),
      ex('2026-09-06', 'Educación', 60),
    ], '2026-10', [{ category: 'Ropa', limit: 10 }])
    expect(out).toEqual([{ category: 'Educación', limit: 60 }])
  })

  it('sin gastos el mes anterior no propone nada', () => {
    expect(budgetsFromPreviousMonth([], '2026-10')).toEqual([])
  })
})
