import { describe, it, expect } from 'vitest'
import { monthLeft } from './monthLeft.js'
import { homeMonthTotals } from '../pages/Dashboard/dashboardModel.js'
import { dailyAvailable } from './dailyAvailable.js'
import { monthPlan, pendingTotals } from './recurring.js'

const incomes = [
  { amount: 1000, date: '2026-11-01' },
  { amount: 300, date: '2026-11-05', inv: true },   // arriendo de una propiedad: fuera
  { amount: 999, date: '2026-10-28' },
]
const expenses = [
  { amount: 200.1, date: '2026-11-02' },
  { amount: '99.9', date: '2026-11-09' },           // monto como texto: se suma, no se concatena
  { amount: 50, date: '2026-11-03', inv: true },
]
const setAsides = [
  { kind: 'setAside', dest: 'goal', goalId: 'g', amount: 100, date: '2026-11-04' },
  { kind: 'setAside', dest: 'invest', amount: 150, date: '2026-11-12' },
]

describe('Te queda: una sola cuenta', () => {
  it('ingresos − gastos − apartado, sin lo marcado como propiedad o negocio', () => {
    const m = monthLeft({ incomes, expenses, setAsides, month: '2026-11' })
    expect(m).toMatchObject({ income: 1000, spent: 300, setAside: 250, setAsideGoals: 100, setAsideInvest: 150, left: 450, incCount: 1, expCount: 2 })
  })

  it('lo apartado no baja la tasa de ahorro (es ahorro)', () => {
    const m = monthLeft({ incomes, expenses, setAsides, month: '2026-11' })
    expect(m.savingRate).toBeCloseTo(0.7)
  })

  it('un apartado mezclado con los gastos cuenta una sola vez y como apartado', () => {
    const m = monthLeft({ incomes, expenses: [...expenses, setAsides[1]], setAsides: [setAsides[0]], month: '2026-11' })
    expect(m).toMatchObject({ spent: 300, setAside: 250, left: 450 })
  })

  it('hasta un día del mes, y sin −0', () => {
    expect(monthLeft({ incomes, expenses, setAsides, month: '2026-11', untilDay: 4 })).toMatchObject({ income: 1000, spent: 200.1, setAside: 100, left: 699.9 })
    expect(monthLeft({ incomes: [{ amount: 0.3, date: '2026-11-01' }], expenses: [{ amount: 0.1, date: '2026-11-01' }, { amount: 0.2, date: '2026-11-01' }], month: '2026-11' }).left).toBe(0)
  })

  it('Inicio, Metas y la lupa dicen lo mismo', () => {
    const now = new Date(2026, 10, 20)
    const home = homeMonthTotals({ incomes, expenses, setAsides, activeMonth: '2026-11', now }).cur
    const goals = monthLeft({ incomes, expenses, setAsides, month: '2026-11' }).left
    const personal = { incomes: incomes.filter(r => !r.inv), expenses: expenses.filter(r => !r.inv) }
    const lupa = dailyAvailable({ ...personal, setAsides, activeMonth: '2026-11', now, income: home.totalInc })
    expect(home.freeFlow).toBe(450)
    expect(home.balance).toBe(goals)
    expect(lupa.avail[lupa.lastDay]).toBe(450)
    // Lo apartado no es gasto: la línea del gasto no lo suma.
    expect(lupa.spentCum[lupa.lastDay]).toBe(300)
  })

  it('sin apartados, igual que antes', () => {
    const home = homeMonthTotals({ incomes, expenses, activeMonth: '2026-11', now: new Date(2026, 10, 20) }).cur
    expect(home).toMatchObject({ totalInc: 1000, totalExp: 300, balance: 700, setAside: 0 })
  })

  it('el mismo apartado en las dos listas cuenta una sola vez', () => {
    const sa = { id: 'sa-1', kind: 'setAside', dest: 'goal', goalId: 1, amount: 100, date: '2026-11-05' }
    const m = monthLeft({ incomes: [{ amount: 500, date: '2026-11-01' }], expenses: [sa], setAsides: [sa], month: '2026-11' })
    expect(m.setAside).toBe(100)
    expect(m.setAsideCount).toBe(1)
    expect(m.left).toBe(400)
    const d = dailyAvailable({ incomes: [{ amount: 500, date: '2026-11-01' }], expenses: [sa], setAsides: [sa], activeMonth: '2026-11', now: new Date(2026, 10, 20), income: 500 })
    expect(d.avail[d.lastDay]).toBe(400)
    // Copias distintas con el mismo id (lista cruda + lista separada) también.
    const m2 = monthLeft({ expenses: [{ ...sa }], setAsides: [{ ...sa }], month: '2026-11' })
    expect(m2.setAside).toBe(100)
  })
})

// UX-N2 (decisión de Walter, 23-nov-2026): "Te queda" también descuenta los
// gastos fijos del mes que faltan. Misma regla que "Previsto pendiente".
const rule = (over = {}) => ({
  id: 'r-rent', kind: 'expense', source: 'manual', description: 'Arriendo', category: 'Vivienda',
  amountMode: 'fixed', amounts: [{ from: '2026-01', amount: 400 }],
  schedule: { freq: 'monthly', day: 25, anchorDate: '2026-01-25' },
  startDate: '2026-01-01', autoConfirm: false, paused: false, skipped: [], ...over,
})
const rules = [
  rule(),                                                                                  // 400, pendiente
  rule({ id: 'r-gym', description: 'Gimnasio', amounts: [{ from: '2026-01', amount: 30 }] }), // 30, pendiente
  rule({ id: 'r-net', description: 'Internet', amounts: [{ from: '2026-01', amount: 50 }], schedule: { freq: 'monthly', day: 3, anchorDate: '2026-01-03' } }),
  rule({ id: 'r-tv', description: 'Streaming', amounts: [{ from: '2026-01', amount: 15 }], skipped: ['2026-11-25'] }), // omitida
  rule({ id: 'r-prop', description: 'Expensas depto', inv: true, amounts: [{ from: '2026-01', amount: 90 }] }),      // de una propiedad
  rule({ id: 'r-sal', kind: 'income', description: 'Sueldo 2', amounts: [{ from: '2026-01', amount: 700 }] }),        // ingreso previsto
]
// El internet del día 3 ya está registrado (vinculado al fijo): es real, no previsto.
const paidNet = { id: 'e-net', amount: 50, date: '2026-11-03', description: 'Internet', recurringId: 'r-net', occurrenceDate: '2026-11-03' }
const nov = { incomes, expenses: [...expenses, paidNet], setAsides }
const planNov = monthPlan(rules, '2026-11', { incomes, expenses: nov.expenses, today: '2026-11-20' })

describe('Te queda descuenta los fijos por pagar (UX-N2)', () => {
  it('ingresos − gastos − apartado − fijos de gasto pendientes', () => {
    const m = monthLeft({ ...nov, month: '2026-11', plan: planNov, today: '2026-11-20' })
    // Real: 1000 − (300 + 50) − 250 = 400; faltan arriendo 400 y gimnasio 30.
    expect(m).toMatchObject({ leftReal: 400, pendingFixed: 430, pendingFixedCount: 2, left: -30 })
  })

  it('es la misma cifra que el gasto de "Previsto pendiente" (una sola definición)', () => {
    const m = monthLeft({ ...nov, month: '2026-11', plan: planNov, today: '2026-11-20' })
    expect(m.pendingFixed).toBe(pendingTotals(planNov).expense)
  })

  it('sin ingresos previstos, omitidos, ya registrados ni reglas de inversión', () => {
    const m = monthLeft({ ...nov, month: '2026-11', plan: planNov, today: '2026-11-20' })
    // 700 del sueldo previsto, 15 omitido, 50 ya pagado y 90 de la propiedad: fuera.
    expect(m.pendingFixed).toBe(430)
  })

  it('un fijo cargado a mano (sin vínculo) cuenta una sola vez, como real', () => {
    const rent = { id: 'e-rent', amount: 400, date: '2026-11-25', description: 'Arriendo' }
    const exp2 = [...nov.expenses, rent]
    const plan = monthPlan(rules, '2026-11', { incomes, expenses: exp2, today: '2026-11-26' })
    const m = monthLeft({ incomes, expenses: exp2, setAsides, month: '2026-11', plan, today: '2026-11-26' })
    expect(m).toMatchObject({ spent: 750, pendingFixed: 30, leftReal: 0, left: -30 })
  })

  it('la tasa de ahorro no cambia: un fijo por pagar todavía no es gasto', () => {
    const a = monthLeft({ ...nov, month: '2026-11' })
    const b = monthLeft({ ...nov, month: '2026-11', plan: planNov, today: '2026-11-20' })
    expect(b.savingRate).toBe(a.savingRate)
    expect(b.spent).toBe(a.spent)
  })

  it('un mes pasado no tiene nada pendiente', () => {
    const planOct = monthPlan(rules, '2026-10', { incomes, expenses: nov.expenses, today: '2026-11-20' })
    expect(pendingTotals(planOct).expense).toBeGreaterThan(0)   // el plan lo marca previsto…
    const m = monthLeft({ ...nov, month: '2026-10', plan: planOct, today: '2026-11-20' })
    expect(m).toMatchObject({ pendingFixed: 0, pendingFixedCount: 0 })   // …pero ya pasó
    expect(m.left).toBe(m.leftReal)
  })

  it('un mes futuro descuenta todos sus fijos de gasto (en el plan, todos están pendientes)', () => {
    const planDic = monthPlan(rules, '2026-12', { incomes, expenses: nov.expenses, today: '2026-11-20' })
    const m = monthLeft({ ...nov, month: '2026-12', plan: planDic, today: '2026-11-20' })
    expect(m).toMatchObject({ pendingFixed: 495, pendingFixedCount: 4, leftReal: 0, left: -495 })
  })

  it('con untilDay (cortes por día) es solo lo registrado', () => {
    const m = monthLeft({ ...nov, month: '2026-11', untilDay: 10, plan: planNov, today: '2026-11-20' })
    expect(m.pendingFixed).toBe(0)
    expect(m.left).toBe(m.leftReal)
  })

  it('Inicio, Metas, Movimientos y la lupa siguen diciendo lo mismo', () => {
    const now = new Date(2026, 10, 20)
    const home = homeMonthTotals({ ...nov, activeMonth: '2026-11', now, plan: planNov })
    expect(home.cur).toMatchObject({ freeFlow: -30, balance: -30, leftReal: 400, pendingFixed: 430 })
    // El mes anterior (cerrado) y su corte por día no descuentan nada.
    expect(home.prev.pendingFixed).toBe(0)
    expect(home.prevToDate.pendingFixed).toBe(0)
    const goals = monthLeft({ ...nov, month: '2026-11', plan: planNov, today: '2026-11-20' }).left
    expect(goals).toBe(home.cur.freeFlow)
    const personal = { incomes: incomes.filter(r => !r.inv), expenses: nov.expenses.filter(r => !r.inv) }
    const lupa = dailyAvailable({ ...personal, setAsides, activeMonth: '2026-11', now, income: home.cur.totalInc,
      plan: planNov, pending: pendingTotals(planNov), pendingFixed: home.cur.pendingFixed })
    // "Te queda" de hoy en la lupa = la cifra grande; los días pasados, lo registrado.
    expect(lupa.avail[lupa.lastDay]).toBe(home.cur.freeFlow)
    expect(lupa.avail[lupa.lastDay - 1]).toBe(400)
    // La línea del gasto no suma los fijos por pagar; la proyección sí los cuenta.
    expect(lupa.spentCum[lupa.lastDay]).toBe(350)
    expect(lupa.projEnd).toBeGreaterThanOrEqual(350 + 430)
  })

  it('sin plan, igual que antes', () => {
    const m = monthLeft({ incomes, expenses, setAsides, month: '2026-11' })
    expect(m).toMatchObject({ pendingFixed: 0, left: 450, leftReal: 450 })
  })
})
