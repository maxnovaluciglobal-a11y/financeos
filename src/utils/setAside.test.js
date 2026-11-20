import { describe, it, expect } from 'vitest'
import {
  isSetAside, splitSetAsides, buildSetAside, setAsideRoom, goalWithSetAside, goalWithoutSetAside,
  monthSetAsides, goalAcceptsSetAside,
} from './setAside.js'
import { monthContributions } from './investNetWorth.js'

const goal = { id: 'g1', name: 'Viaje', target: 1000, saved: 900, contributions: [{ amount: 900, date: '2026-10-01' }] }

describe('Apartar: modelo de datos', () => {
  it('arma el registro (compatible: es un "gasto" de Otros para versiones viejas)', () => {
    const r = buildSetAside({ amount: '50.004', date: '2026-11-20', dest: 'invest' })
    expect(r).toMatchObject({ kind: 'setAside', dest: 'invest', amount: 50, date: '2026-11-20', category: 'Otros' })
    expect(r.goalId).toBeUndefined()
    expect(buildSetAside({ amount: 10, date: '2026-11-20', dest: 'goal', goalId: 'g1' }).goalId).toBe('g1')
  })

  it('rechaza monto, destino o fecha inválidos', () => {
    expect(buildSetAside({ amount: 0, date: '2026-11-20', dest: 'invest' })).toBeNull()
    expect(buildSetAside({ amount: 5, date: '2026-11-20', dest: 'banco' })).toBeNull()
    expect(buildSetAside({ amount: 5, date: '2026-11-20', dest: 'goal' })).toBeNull()
    expect(buildSetAside({ amount: 5, date: 'ayer', dest: 'invest' })).toBeNull()
  })

  it('separa los apartados de los gastos', () => {
    const { expenses, setAsides } = splitSetAsides([{ id: 1, amount: 3 }, { id: 2, kind: 'setAside', dest: 'invest', amount: 4 }])
    expect(expenses.map(r => r.id)).toEqual([1])
    expect(setAsides.map(r => r.id)).toEqual([2])
    expect(isSetAside({ kind: 'setAside' })).toBe(true)
    expect(isSetAside({ inv: true })).toBe(false)
  })

  it('a una meta no pasa del objetivo y se puede deshacer', () => {
    expect(setAsideRoom(goal, 300)).toBe(100)
    const next = goalWithSetAside(goal, { amount: 300, date: '2026-11-20', ref: 'x1', method: 'Débito' })
    expect(next.saved).toBe(1000)
    expect(next.contributions.at(-1)).toEqual({ amount: 100, date: '2026-11-20', ref: 'x1', method: 'Débito' })
    const back = goalWithoutSetAside(next, { id: 'x1' })
    expect(back.saved).toBe(900)
    expect(back.contributions).toEqual(goal.contributions)
    expect(goalWithoutSetAside(next, { id: 'otro' })).toBeNull()
  })

  it('una meta completa no recibe apartados', () => {
    const done = { ...goal, saved: 1000 }
    expect(goalAcceptsSetAside(done)).toBe(false)
    expect(goalWithSetAside(done, { amount: 10, date: '2026-11-20', ref: 'x' })).toBeNull()
    expect(setAsideRoom({ id: 'g', target: 0, saved: 50 }, 25)).toBe(25) // sin objetivo: entra todo
  })

  it('suma el mes por destino', () => {
    const list = [
      { kind: 'setAside', dest: 'goal', amount: 10.1, date: '2026-11-02' },
      { kind: 'setAside', dest: 'invest', amount: 20.2, date: '2026-11-15' },
      { kind: 'setAside', dest: 'invest', amount: 99, date: '2026-10-30' },
      { amount: 500, date: '2026-11-03' },
    ]
    expect(monthSetAsides(list, '2026-11')).toMatchObject({ total: 30.3, goals: 10.1, invest: 20.2, count: 2 })
    expect(monthSetAsides(list, '2026-11', { untilDay: 10 })).toMatchObject({ total: 10.1, count: 1 })
  })

  it('Inversiones ve lo apartado "Para invertir" como aporte del mes', () => {
    const expenses = [
      { inv: true, amount: 100, date: '2026-11-03' },                 // aporte viejo marcado 💼
      { inv: true, project: 'Depto', amount: 80, date: '2026-11-03' }, // flujo de una propiedad: no
      { amount: 40, date: '2026-11-03' },
    ]
    const setAsides = [
      { kind: 'setAside', dest: 'invest', amount: 50, date: '2026-11-10' },
      { kind: 'setAside', dest: 'goal', goalId: 'g1', amount: 30, date: '2026-11-10' },
    ]
    expect(monthContributions(expenses, '2026-11', setAsides)).toEqual({ count: 2, sum: 150 })
    // Sin la lista aparte (llamada vieja): igual que antes.
    expect(monthContributions(expenses, '2026-11')).toEqual({ count: 1, sum: 100 })
  })
})
