import { describe, it, expect } from 'vitest'
import {
  monthDelta, prevMonthOf, monthName, fmtSignedPct,
  budgetState, budgetRows, nextOccurrence, upcomingPayments,
  weekToMonth, prevMonthScore, upsertMonthly, lastValueBefore,
} from './dashboardModel.js'

describe('monthDelta', () => {
  it('sin mes anterior o con base 0 no hay línea', () => {
    expect(monthDelta(100, 0)).toBeNull()
    expect(monthDelta(100, 50, { hasPrev: false })).toBeNull()
  })
  it('|Δ| < 0.5 % es "igual"', () => {
    expect(monthDelta(1004, 1000)).toEqual({ dir: 'flat', pct: 0, good: null })
  })
  it('subir es bueno salvo en gastos (invert)', () => {
    expect(monthDelta(110, 100)).toMatchObject({ dir: 'up', good: true })
    expect(monthDelta(94, 100, { invert: true })).toMatchObject({ dir: 'down', good: true })
    expect(monthDelta(120, 100, { invert: true })).toMatchObject({ dir: 'up', good: false })
  })
  it('con base negativa compara contra el valor absoluto', () => {
    // de −100 a +50: mejoró 150 %
    expect(monthDelta(50, -100)).toMatchObject({ dir: 'up', good: true, pct: 150 })
  })
})

describe('mes anterior, nombre y porcentaje', () => {
  it('prevMonthOf cruza el año', () => {
    expect(prevMonthOf('2026-01')).toBe('2025-12')
    expect(prevMonthOf('2026-10')).toBe('2026-09')
  })
  it('monthName localizado', () => {
    expect(monthName('2026-09', 'es')).toBe('septiembre')
    expect(monthName('2026-09', 'de')).toBe('September')
  })
  it('fmtSignedPct usa el signo menos real', () => {
    expect(fmtSignedPct(-6.2, 'en')).toBe('−6%')
    expect(fmtSignedPct(12.4, 'en')).toBe('+12%')
  })
})

describe('presupuesto por categoría', () => {
  it('estados: ok < 80 % · near 80–100 % · over > 100 % (igual que Presupuestos)', () => {
    expect(budgetState(79, 100)).toBe('ok')
    expect(budgetState(80, 100)).toBe('near')
    expect(budgetState(100, 100)).toBe('near')
    expect(budgetState(101, 100)).toBe('over')
  })
  it('ordena por riesgo e ignora gastos de inversión', () => {
    const rows = budgetRows({
      budgets: [
        { id: 1, category: 'A', limit: 100 },
        { id: 2, category: 'B', limit: 100 },
        { id: 3, category: 'C', limit: 100 },
      ],
      monthExpenses: [
        { category: 'A', amount: 50 },
        { category: 'B', amount: 130 },
        { category: 'C', amount: 90 },
        { category: 'A', amount: 999, inv: true },
      ],
    })
    expect(rows.map(r => r.category)).toEqual(['B', 'C', 'A'])
    expect(rows.map(r => r.state)).toEqual(['over', 'near', 'ok'])
  })
  it('usa el límite efectivo (rollover) cuando viene', () => {
    const [r] = budgetRows({ budgets: [{ category: 'A', limit: 100 }], monthExpenses: [{ category: 'A', amount: 110 }], limits: { A: 150 } })
    expect(r.limit).toBe(150)
    expect(r.state).toBe('ok')
  })
})

describe('próximos pagos', () => {
  const today = new Date(2026, 9, 8) // 8-oct-2026, hora local

  it('nextOccurrence avanza mes a mes y respeta el fin de mes', () => {
    expect(nextOccurrence('2026-10-20', today).getDate()).toBe(20)
    const d = nextOccurrence('2026-08-04', today)
    expect([d.getMonth(), d.getDate()]).toEqual([10, 4]) // 4-nov
    const eom = nextOccurrence('2026-01-31', new Date(2026, 1, 10))
    expect([eom.getMonth(), eom.getDate()]).toEqual([1, 28])
  })

  it('mezcla deudas y suscripciones activas en 30 días, ordenadas por fecha', () => {
    const { items, total } = upcomingPayments({
      today,
      debts: [
        { id: 'd1', creditor: 'Visa', balance: 1000, minPayment: 180, dueDate: '2026-09-22' }, // → 22-oct
        { id: 'd2', creditor: 'Banco', balance: 5000, minPayment: 350, dueDate: '2026-11-15' }, // fuera de 30 días
        { id: 'd3', creditor: 'Saldada', balance: 0, minPayment: 100, dueDate: '2026-10-10' },
      ],
      subscriptions: [
        { id: 's1', name: 'Netflix', amount: 47900, status: 'active', frequency: 'monthly', nextPaymentDate: '2026-10-04' }, // → 4-nov
        { id: 's2', name: 'Pausada', amount: 10, status: 'paused', nextPaymentDate: '2026-10-09' },
        { id: 's3', name: 'Anual', amount: 99, status: 'active', frequency: 'annual', nextPaymentDate: '2025-10-12' }, // → 12-oct
      ],
    })
    expect(items.map(i => [i.kind, i.name, i.date])).toEqual([
      ['sub', 'Anual', '2026-10-12'],
      ['debt', 'Visa', '2026-10-22'],
      ['sub', 'Netflix', '2026-11-04'],
    ])
    expect(total).toBe(3)
  })

  it('la cuota nunca supera el saldo pendiente', () => {
    const { items } = upcomingPayments({ today, debts: [{ id: 1, creditor: 'X', balance: 50, minPayment: 180, dueDate: '2026-10-15' }], subscriptions: [] })
    expect(items[0].amount).toBe(50)
  })

  it('respeta el tope de ítems', () => {
    const subs = Array.from({ length: 8 }, (_, i) => ({ id: i, name: `S${i}`, amount: 1, status: 'active', nextPaymentDate: `2026-10-${String(10 + i).padStart(2, '0')}` }))
    const r = upcomingPayments({ today, debts: [], subscriptions: subs })
    expect(r.items).toHaveLength(5)
    expect(r.total).toBe(8)
  })
})

describe('historiales mensuales', () => {
  it('weekToMonth estima el mes de una semana guardada', () => {
    expect(weekToMonth('2026-W40')).toBe('2026-09')
    expect(weekToMonth('basura')).toBeNull()
  })
  it('prevMonthScore toma el último valor de un mes anterior', () => {
    const h = [{ w: '2026-W36', s: 70 }, { w: '2026-W39', s: 79, d: '2026-09-25' }, { w: '2026-W41', s: 82, d: '2026-10-06' }]
    expect(prevMonthScore(h, '2026-10')).toEqual({ m: '2026-09', v: 79 })
    expect(prevMonthScore([{ w: '2026-W41', s: 82, d: '2026-10-06' }], '2026-10')).toBeNull()
  })
  it('upsertMonthly pisa el mes en curso y conserva el orden', () => {
    let h = upsertMonthly([], '2026-09', 100)
    h = upsertMonthly(h, '2026-10', 110)
    h = upsertMonthly(h, '2026-10', 120)
    expect(h).toEqual([{ m: '2026-09', v: 100 }, { m: '2026-10', v: 120 }])
    expect(lastValueBefore(h, '2026-10', { monthOf: e => e.m, valueOf: e => e.v })).toEqual({ m: '2026-09', v: 100 })
  })
})

import { upcomingFromRules } from './dashboardModel.js'
describe('upcomingFromRules — próximos pagos desde los fijos', () => {
  const r = (id, day, amount, source = 'manual', kind = 'expense') => ({ id, kind, source, description: id, category: 'Otros',
    amounts: [{ from: '2026-01', amount }], schedule: { freq: 'monthly', day }, startDate: '2026-01-01', skipped: [] })
  it('solo previstos de gasto entre hoy y 30 días, cruzando de mes', () => {
    const rules = [r('arriendo', 1, 500), r('gym', 5, 35, 'subscription'), r('tarjeta', 20, 80, 'debt'), r('sueldo', 25, 2000, 'manual', 'income')]
    const expenses = [{ id: 'x', recurringId: 'gym', occurrenceDate: '2026-11-05', amount: 35, date: '2026-11-05' }]
    const { items, total } = upcomingFromRules(rules, { expenses, today: '2026-10-08' })
    expect(items.map(i => `${i.name}@${i.date}`)).toEqual(['tarjeta@2026-10-20', 'arriendo@2026-11-01'])
    expect(items[0].kind).toBe('debt')
    expect(total).toBe(2)
  })
})
