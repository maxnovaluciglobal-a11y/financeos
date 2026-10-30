import { describe, it, expect } from 'vitest'
import { budgetSplit, clampSavingsPct, unbudgetedSpent } from './budgets.js'

describe('R8a: reparto del ingreso', () => {
  it('presupuestado + ahorro + libre = ingreso', () => {
    const r = budgetSplit({ income: 1000, budgeted: 600, savingsPct: 10 })
    expect(r).toMatchObject({ savings: 100, free: 300, over: 0 })
    expect(r.share.budgeted + r.share.savings + r.share.free).toBeCloseTo(1)
  })
  it('si se pasa, over > 0 y libre 0', () => {
    expect(budgetSplit({ income: 1000, budgeted: 950, savingsPct: 10 })).toMatchObject({ free: 0, over: 50 })
  })
  it('sin ingreso, sin proporciones', () => {
    expect(budgetSplit({ income: 0, budgeted: 100 }).share).toBeNull()
  })
  it('el % de ahorro se acota a 0–90 y acepta coma', () => {
    expect(clampSavingsPct('12,4')).toBe(12)
    expect(clampSavingsPct(150)).toBe(90)
    expect(clampSavingsPct('x')).toBe(0)
  })
  it('gasto sin presupuesto suma solo categorías sin límite', () => {
    expect(unbudgetedSpent({ Comida: 100, Cine: 40, Taxi: 0 }, new Set(['Comida']))).toBe(40)
  })
})
