import { describe, it, expect } from 'vitest'
import { roundCents, sumAmounts, savingGoal, meetsSavingGoal, DEFAULT_SAVING_GOAL } from './monthFigures.js'
import { homeMonthTotals } from '../pages/Dashboard/dashboardModel.js'

describe('roundCents y sumAmounts', () => {
  it('redondea a centavos y nunca devuelve −0', () => {
    expect(roundCents(0.30 - 0.10 - 0.20)).toBe(0)
    expect(Object.is(roundCents(-0.000001), -0)).toBe(false)
    expect(roundCents(1.005 + 2.004)).toBe(3.01)
  })
  it('suma montos guardados como texto sin concatenar', () => {
    expect(sumAmounts([{ amount: '2000' }, { amount: 300 }, { amount: null }, {}])).toBe(2300)
    expect(sumAmounts([{ amount: 50.10 }, { amount: 50.20 }])).toBe(100.30)
  })
})

describe('ENG-N5: un mes cuadrado al centavo da 0 en "Te queda"', () => {
  it('ingreso 0,30 y gastos 0,10 + 0,20', () => {
    const { cur } = homeMonthTotals({
      incomes: [{ date: '2026-11-01', amount: 0.30 }],
      expenses: [{ date: '2026-11-02', amount: 0.10 }, { date: '2026-11-03', amount: 0.20 }],
      activeMonth: '2026-11', now: new Date(2026, 10, 10, 12),
    })
    expect(cur.freeFlow).toBe(0)
    expect(cur.freeFlow < 0).toBe(false)
    expect(cur.balance).toBe(0)
  })
  it('propiedad: 2.000 meses cuadrados al centavo nunca dan saldo negativo', () => {
    let seed = 7
    const r = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
    for (let i = 0; i < 2000; i++) {
      const parts = Array.from({ length: 1 + Math.floor(r() * 6) }, () => Math.round(r() * 30000) / 100)
      const inc = parts.reduce((s, x) => s + x, 0)
      const { cur } = homeMonthTotals({
        incomes: [{ date: '2026-11-01', amount: Math.round(inc * 100) / 100 }],
        expenses: parts.map((a, j) => ({ date: `2026-11-0${1 + (j % 9)}`, amount: a })),
        activeMonth: '2026-11', now: new Date(2026, 10, 20, 12),
      })
      expect(cur.freeFlow).toBe(0)
    }
  })
})

describe('savingGoal: la meta de ahorro que eligió la persona', () => {
  it('usa el % configurado, respeta el 0 y solo sin valor cae al 25 %', () => {
    expect(savingGoal({ savingGoalPct: 10 })).toBe(0.10)
    expect(savingGoal({ savingGoalPct: '15' })).toBe(0.15)
    expect(savingGoal({ savingGoalPct: 0 })).toBe(0)
    expect(savingGoal({})).toBe(DEFAULT_SAVING_GOAL)
    expect(savingGoal(null)).toBe(DEFAULT_SAVING_GOAL)
    expect(savingGoal({ savingGoalPct: null })).toBe(DEFAULT_SAVING_GOAL)
    expect(savingGoal({ savingGoalPct: 'abc' })).toBe(DEFAULT_SAVING_GOAL)
  })
  it('15 % de ahorro con meta de 10 % llega; con meta de 15 % también', () => {
    expect(meetsSavingGoal(0.15, savingGoal({ savingGoalPct: 10 }))).toBe(true)
    expect(meetsSavingGoal(150 / 1000, savingGoal({ savingGoalPct: 15 }))).toBe(true)
    expect(meetsSavingGoal(0.22, savingGoal({ savingGoalPct: 25 }))).toBe(false)
  })
})
