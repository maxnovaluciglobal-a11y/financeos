import { describe, it, expect } from 'vitest'
import { reportOverBudget, subscriptionsToDeduct } from './reportsModel.js'
import { countBudgetsExceeded, effectiveBudgetLimits } from '../../utils/budgets.js'
import { monthPlan } from '../../utils/recurring.js'
import { ruleFromSubscription } from '../../utils/recurringSources.js'

const MONTH = '2026-11'

describe('ENG-N6 (a): Reportes cuenta los excedidos como Presupuestos', () => {
  it('el límite exacto no es exceso (50,10 + 50,20 contra 100,30)', () => {
    const budgets = [{ category: 'Alimentación', limit: 100.30 }, { category: 'Ocio', limit: 50 }]
    const expenses = [
      { date: '2026-11-02', category: 'Alimentación', amount: 50.10 },
      { date: '2026-11-03', category: 'Alimentación', amount: 50.20 },
      { date: '2026-11-04', category: 'Ocio', amount: 50.01 },
    ]
    const expByCat = { 'Alimentación': 50.10 + 50.20, Ocio: 50.01 }
    const limits = effectiveBudgetLimits({ budgets, expenses, activeMonth: MONTH, settings: {} })
    const over = reportOverBudget({ budgets, expByCat, limits })
    expect(over.map(b => b.category)).toEqual(['Ocio'])
    expect(over.length).toBe(countBudgetsExceeded({ budgets, expenses, activeMonth: MONTH, settings: {} }))
  })
  it('sin límite y con gasto, excedido (como antes)', () => {
    expect(reportOverBudget({ budgets: [{ category: 'X', limit: 0 }], expByCat: { X: 1 }, limits: {} }).length).toBe(1)
  })
})

describe('ENG-N6 (b): las suscripciones ya cobradas no se restan dos veces', () => {
  const today = '2026-11-20'
  const subs = [
    { id: 's1', name: 'Streaming', amount: 10, frequency: 'monthly', status: 'active', nextPaymentDate: '2026-11-05', category: 'Streaming' },
    { id: 's2', name: 'Nube', amount: 4, frequency: 'monthly', status: 'active', nextPaymentDate: '2026-11-28', category: 'Cloud' },
  ]
  const rules = subs.map(sub => ({ ...ruleFromSubscription(sub, { today: '2026-11-01', now: 0 }), startDate: '2026-11-01' }))

  it('resta solo la que falta cuando la otra ya se confirmó como gasto', () => {
    const expenses = [{ id: 'e1', date: '2026-11-05', amount: 10, category: 'Entretención', recurringId: 'rs-s1', occurrenceDate: '2026-11-05' }]
    const plan = monthPlan(rules, MONTH, { incomes: [], expenses, today })
    expect(subscriptionsToDeduct({ plan, rules, monthlySubs: 14 })).toBe(4)
  })
  it('sin nada cobrado, resta las dos', () => {
    const plan = monthPlan(rules, MONTH, { incomes: [], expenses: [], today })
    expect(subscriptionsToDeduct({ plan, rules, monthlySubs: 14 })).toBe(14)
  })
  it('sin reglas de suscripción (datos viejos), el equivalente mensual de todas', () => {
    expect(subscriptionsToDeduct({ plan: [], rules: [], monthlySubs: 14.333 })).toBe(14.33)
  })
})
