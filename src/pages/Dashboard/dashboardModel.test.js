import { describe, it, expect } from 'vitest'
import {
  monthDelta, prevMonthOf, monthName, fmtSignedPct,
  budgetState, budgetRows, nextOccurrence, upcomingPayments,
  weekToMonth, prevMonthScore, upsertMonthly, lastValueBefore, homeMonthTotals,
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
    expect(fmtSignedPct(-6.2, 'en')).toBe('\u22126\u202f%')
    expect(fmtSignedPct(12.4, 'en')).toBe('+12\u202f%')
    expect(fmtSignedPct(0.2, 'es')).toBe('0\u202f%')
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

// FIN-13 en Inicio: la fila de presupuesto usa la misma regla en centavos que
// la página Presupuestos (antes, división en coma flotante).
describe('budgetState en centavos (FIN-13)', () => {
  it('50,10 + 50,20 contra 100,30 está "near", no "over"', () => {
    expect((50.1 + 50.2) / 100.3 > 1).toBe(true) // la trampa de la coma flotante
    expect(budgetState(50.1 + 50.2, 100.3)).toBe('near')
    expect(budgetState(100.31, 100.3)).toBe('over')
  })
  it('sin límite: gasto > 0 es over, 0 es ok', () => {
    expect(budgetState(5, 0)).toBe('over')
    expect(budgetState(0, 0)).toBe('ok')
  })
})

// FIN-14: variaciones del Inicio contra el mes anterior hasta el mismo día.
describe('homeMonthTotals (FIN-14)', () => {
  const incomes = [
    { date: '2026-09-05', amount: 1000 },
    { date: '2026-09-25', amount: 3000 },
    { date: '2026-10-04', amount: 1200 },
  ]
  const expenses = [
    { date: '2026-09-08', amount: 200 },
    { date: '2026-09-28', amount: 800 },
    { date: '2026-10-09', amount: 300 },
  ]
  it('mes en curso (día 10): el anterior se corta al día 10', () => {
    const r = homeMonthTotals({ incomes, expenses, activeMonth: '2026-10', now: new Date(2026, 9, 10) })
    expect(r.prevCutDay).toBe(10)
    expect(r.cur.totalInc).toBe(1200)
    expect(r.prevToDate.totalInc).toBe(1000)   // sin el ingreso del 25-sep
    expect(r.prevToDate.totalExp).toBe(200)    // sin el gasto del 28-sep
    expect(r.prev.totalInc).toBe(4000)         // el mes completo sigue disponible
    // la variación de ingresos es +20 %, no -70 % contra el mes completo
    expect(monthDelta(r.cur.totalInc, r.prevToDate.totalInc).pct).toBeCloseTo(20)
  })
  it('mes cerrado: compara contra el mes anterior completo', () => {
    const r = homeMonthTotals({ incomes, expenses, activeMonth: '2026-10', now: new Date(2026, 10, 3) })
    expect(r.prevCutDay).toBeNull()
    expect(r.prevToDate).toBe(r.prev)
    expect(r.prevToDate.totalInc).toBe(4000)
  })
  it('enero compara contra diciembre del año anterior', () => {
    const r = homeMonthTotals({
      incomes: [{ date: '2025-12-02', amount: 50 }, { date: '2025-12-20', amount: 70 }, { date: '2026-01-03', amount: 10 }],
      expenses: [], activeMonth: '2026-01', now: new Date(2026, 0, 15),
    })
    expect(r.prevToDate.totalInc).toBe(50)
    expect(r.prev.totalInc).toBe(120)
  })
  it('día 31 contra un mes de 30 días: entra el mes anterior completo', () => {
    const r = homeMonthTotals({
      incomes: [{ date: '2026-09-30', amount: 90 }], expenses: [],
      activeMonth: '2026-10', now: new Date(2026, 9, 31),
    })
    expect(r.prevToDate.totalInc).toBe(90)
  })
  it('registros sin fecha válida no rompen ni suman', () => {
    const r = homeMonthTotals({ incomes: [null, { amount: 5 }, { date: 20261001, amount: 5 }], expenses: [], activeMonth: '2026-10', now: new Date(2026, 9, 2) })
    expect(r.cur.totalInc).toBe(0)
  })
})
