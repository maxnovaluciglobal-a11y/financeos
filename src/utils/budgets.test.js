// Auditoría 360: FIN-8 (rollover del primer mes), FIN-13 (coma flotante) y
// FIN-16 (una sola regla de estado para Presupuestos y Coach).
import { describe, it, expect } from 'vitest'
import { effectiveBudgetLimits, budgetRollover, budgetStatus, countBudgetsExceeded, BUDGET_WARN_PCT } from './budgets.js'
import { roundTo, fmtAmount } from './index.js'
import { COACH_CONFIG } from '../data/coachRules.js'

const on = { budgetRollover: true }

describe('rollover (FIN-8)', () => {
  it('presupuesto de 300.000 creado este mes: el límite efectivo queda en 300.000, no 600.000', () => {
    const budgets = [{ category: 'Alimentación', limit: 300000, createdAt: '2026-10-03T10:00:00.000Z' }]
    const expenses = [
      { date: '2026-09-20', category: 'Transporte', amount: 5000 },
      { date: '2026-10-03', category: 'Alimentación', amount: 10000 },
    ]
    expect(effectiveBudgetLimits({ budgets, expenses, activeMonth: '2026-10', settings: on })).toEqual({ 'Alimentación': 300000 })
  })

  it('caso de t1.mjs: presupuesto viejo sin fecha y mes anterior sin ningún registro -> sin arrastre', () => {
    const budgets = [{ category: 'Alimentación', limit: 300000 }]
    const expenses = [{ date: '2026-10-03', category: 'Alimentación', amount: 10000 }]
    expect(effectiveBudgetLimits({ budgets, expenses, activeMonth: '2026-10', settings: on })['Alimentación']).toBe(300000)
  })

  it('presupuesto que ya existía y mes anterior con datos: arrastra lo no gastado (acotado al límite)', () => {
    const budgets = [{ category: 'Alimentación', limit: 300000, createdAt: '2026-08-01T00:00:00.000Z' }, { category: 'Ocio', limit: 50000 }]
    const expenses = [{ date: '2026-09-10', category: 'Alimentación', amount: 200000 }]
    expect(budgetRollover({ budgets, expenses, activeMonth: '2026-10', settings: on })).toEqual({ 'Alimentación': 100000, 'Ocio': 50000 })
    expect(effectiveBudgetLimits({ budgets, expenses, activeMonth: '2026-10', settings: on })['Alimentación']).toBe(400000)
  })

  it('con rollover apagado, el límite base', () => {
    const budgets = [{ category: 'Ocio', limit: 50000 }]
    expect(effectiveBudgetLimits({ budgets, expenses: [{ date: '2026-09-01', category: 'Ocio', amount: 1 }], activeMonth: '2026-10', settings: {} })).toEqual({ Ocio: 50000 })
  })
})

describe('estado del presupuesto (FIN-13, FIN-16)', () => {
  it('50,10 + 50,20 gastado contra un límite de 100,30 no está excedido', () => {
    expect(50.1 + 50.2 > 100.3).toBe(true)
    expect(budgetStatus(50.1 + 50.2, 100.3).over).toBe(false)
    expect(budgetStatus(100.31, 100.3).over).toBe(true)
  })

  it('exactamente al límite: atención, no excedido; 80 % es atención', () => {
    expect(budgetStatus(1000, 1000)).toMatchObject({ over: false, warn: true, level: 'attention' })
    expect(budgetStatus(800, 1000).warn).toBe(true)
    expect(budgetStatus(799, 1000).level).toBe('ok')
  })

  it('el Coach usa el mismo umbral de atención que Presupuestos', () => {
    expect(COACH_CONFIG.thresholds.budgetOverUsePct).toBe(BUDGET_WARN_PCT)
  })

  it('countBudgetsExceeded no cuenta el gasto exacto al límite', () => {
    const budgets = [{ category: 'A', limit: 100.3 }]
    const expenses = [{ date: '2026-10-01', category: 'A', amount: 50.1 }, { date: '2026-10-02', category: 'A', amount: 50.2 }]
    expect(countBudgetsExceeded({ budgets, expenses, activeMonth: '2026-10', settings: {} })).toBe(0)
  })

  it('redondeo decimal: 1,005 -> 1,01 y 2,675 -> 2,68 (antes 1,00 y 2,67)', () => {
    expect(roundTo(1.005, 2)).toBe(1.01)
    expect(roundTo(2.675, 2)).toBe(2.68)
    expect(roundTo(-1.005, 2)).toBe(-1.01)
    expect(roundTo(1e-7, 2)).toBe(0)
    expect(fmtAmount(1.005, 2, 'en-US')).toBe('1.01')
  })
})
