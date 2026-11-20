import { describe, it, expect } from 'vitest'
import { budgetUsage, countBudgetsExceeded } from './budgets.js'

const MONTH = '2026-11'

describe('G2-N2: la tarjeta de presupuesto del Inicio no oculta los excesos', () => {
  it('Ocio 200/100 y Salud 10/100: 105 %, 1 excedida, nivel riesgo (antes 55 % "Sigue así")', () => {
    const budgets = [{ category: 'Ocio', limit: 100 }, { category: 'Salud', limit: 100 }]
    const expenses = [{ date: '2026-11-03', category: 'Ocio', amount: 200 }, { date: '2026-11-03', category: 'Salud', amount: 10 }]
    const u = budgetUsage({ budgets, expenses, activeMonth: MONTH, settings: {} })
    expect(Math.round(u.pct * 100)).toBe(105)
    expect(u.overCount).toBe(1)
    expect(u.level).toBe('risk')
    expect(u.overCount).toBe(countBudgetsExceeded({ budgets, expenses, activeMonth: MONTH, settings: {} }))
  })
  it('umbrales de budgetStatus: atención desde el 80 %, el límite exacto no es exceso', () => {
    const budgets = [{ category: 'Ocio', limit: 100.30 }]
    const at = (amounts) => budgetUsage({ budgets, expenses: amounts.map(a => ({ date: '2026-11-02', category: 'Ocio', amount: a })), activeMonth: MONTH, settings: {} })
    expect(at([50.10, 50.20]).level).toBe('attention')
    expect(at([50.10, 50.20]).overCount).toBe(0)
    expect(at([80.24]).level).toBe('attention')
    expect(at([70]).level).toBe('ok')
  })
  it('ignora otros meses, gastos de inversión y categorías sin presupuesto', () => {
    const budgets = [{ category: 'Ocio', limit: 100 }]
    const expenses = [
      { date: '2026-10-03', category: 'Ocio', amount: 500 },
      { date: '2026-11-03', category: 'Ocio', amount: 500, inv: true },
      { date: '2026-11-03', category: 'Salud', amount: 500 },
      { date: '2026-11-04', category: 'Ocio', amount: '20' },
    ]
    const u = budgetUsage({ budgets, expenses, activeMonth: MONTH, settings: {} })
    expect(u.used).toBe(20)
    expect(u.level).toBe('ok')
  })
})
