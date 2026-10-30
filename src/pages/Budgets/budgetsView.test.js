import { describe, it, expect } from 'vitest'
import { kpiLine, rowLine, rowDetail, parseLimit } from './budgetsView.js'

describe('línea de KPIs (poda P2)', () => {
  it('cuenta las excedidas en singular y plural', () => {
    expect(kpiLine({ overCount: 0, totalBudget: 100, income: 1000 }).over).toEqual({ key: 'budgets.p2.kpi.overNone' })
    expect(kpiLine({ overCount: 1, totalBudget: 100, income: 1000 }).over).toEqual({ key: 'budgets.p2.kpi.overOne', n: 1 })
    expect(kpiLine({ overCount: 3, totalBudget: 100, income: 1000 }).over).toEqual({ key: 'budgets.p2.kpi.overMany', n: 3 })
  })
  it('cobertura con ingreso y sin ingreso', () => {
    expect(kpiLine({ totalBudget: 790, income: 1000 }).coverage).toEqual({ key: 'budgets.p2.kpi.coverage', ratio: 0.79 })
    expect(kpiLine({ totalBudget: 790, income: 0 }).coverage).toEqual({ key: 'budgets.p2.kpi.noIncome' })
  })
  it('tono: excedidas o déficit = riesgo; más de 80 % = atención', () => {
    expect(kpiLine({ overCount: 1, totalBudget: 100, income: 1000 }).tone).toBe('risk')
    expect(kpiLine({ overCount: 0, totalBudget: 1100, income: 1000 }).tone).toBe('risk')
    expect(kpiLine({ overCount: 0, totalBudget: 1002, income: 1000 }).tone).toBe('warn') // dentro de la tolerancia H18
    expect(kpiLine({ overCount: 0, totalBudget: 850, income: 1000 }).tone).toBe('warn')
    expect(kpiLine({ overCount: 0, totalBudget: 500, income: 1000 }).tone).toBe('ok')
    expect(kpiLine({ overCount: 0, totalBudget: 500, income: 0 }).tone).toBe('ok')
  })
})

describe('fila y detalle de categoría (poda P2)', () => {
  it('"Gastado X de Y" con presupuesto y "Gastado X" sin presupuesto', () => {
    expect(rowLine({ spent: 50, limit: 200 })).toEqual({ key: 'budgets.p2.row.spentOf', spent: 50, limit: 200 })
    expect(rowLine({ spent: 50, limit: 0 })).toEqual({ key: 'budgets.p2.row.spent', spent: 50 })
    expect(rowLine(null)).toEqual({ key: 'budgets.p2.row.spent', spent: 0 })
  })
  it('detalle: restante, excedido y arrastre', () => {
    expect(rowDetail({ spent: 50, limit: 220, carry: 20, budget: { limit: 200 } })).toEqual({
      spent: 50, limit: 220, base: 200, carry: 20, left: { key: 'budgets.col.left', value: 170, over: false },
    })
    expect(rowDetail({ spent: 260, limit: 200, carry: 0, budget: { limit: 200 } }).left).toEqual({ key: 'budgets.col.over', value: 60, over: true })
    expect(rowDetail({ spent: 30, limit: 0 })).toEqual({ spent: 30, limit: 0, base: 0, carry: 0, left: null })
  })
  it('límite editado', () => {
    expect(parseLimit('1500')).toBe(1500)
    expect(parseLimit('1500,5')).toBe(1500.5)
    expect(parseLimit('1,500.25')).toBe(1500.25)
    expect(parseLimit(' 0 ')).toBe(null)
    expect(parseLimit('-3')).toBe(null)
    expect(parseLimit('abc')).toBe(null)
    expect(parseLimit('')).toBe(null)
  })
})
