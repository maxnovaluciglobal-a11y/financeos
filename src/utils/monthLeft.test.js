import { describe, it, expect } from 'vitest'
import { monthLeft } from './monthLeft.js'
import { homeMonthTotals } from '../pages/Dashboard/dashboardModel.js'
import { dailyAvailable } from './dailyAvailable.js'

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
