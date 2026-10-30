import { describe, it, expect } from 'vitest'
import {
  weekStartFor, weekdayOrder, monthWeeks, realByDay, isUndatedRule, plannedByDay,
  buildCalendar, initialFocusDate, moveFocus, compactNumber,
} from './calendarModel.js'

describe('weekStartFor', () => {
  it('el país de Ajustes manda: EE. UU., Brasil y Venezuela empiezan el domingo', () => {
    expect(weekStartFor('es-CL', 'US')).toBe(0)
    expect(weekStartFor('es-CL', 'VE')).toBe(0)
    expect(weekStartFor('pt-BR', 'BR')).toBe(0)
    expect(weekStartFor('en-US', 'DE')).toBe(1)
    expect(weekStartFor('es-CL', 'cl')).toBe(1)
  })
  it('sin país, el locale decide y por defecto es lunes', () => {
    expect(weekStartFor('en-US')).toBe(0)
    expect(weekStartFor('de-DE')).toBe(1)
    expect(weekStartFor('es-CL')).toBe(1)
    expect(weekStartFor('')).toBe(1)
    expect(weekStartFor('no es un locale!!')).toBe(1)
  })
  it('weekdayOrder', () => {
    expect(weekdayOrder(1)).toEqual([1, 2, 3, 4, 5, 6, 0])
    expect(weekdayOrder(0)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })
})

describe('monthWeeks', () => {
  it('octubre 2026 empieza jueves: 3 huecos con lunes, 4 con domingo', () => {
    const mon = monthWeeks('2026-10', 1)
    expect(mon[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'])
    expect(mon.length).toBe(5)
    const sun = monthWeeks('2026-10', 0)
    expect(sun[0].slice(0, 5)).toEqual([null, null, null, null, '2026-10-01'])
  })
  it('todas las semanas tienen 7 casillas y están todos los días', () => {
    for (const ym of ['2026-02', '2026-03', '2027-02', '2026-08']) {
      for (const ws of [0, 1]) {
        const w = monthWeeks(ym, ws)
        expect(w.every(r => r.length === 7)).toBe(true)
        expect(w.length).toBeGreaterThanOrEqual(4)
        expect(w.length).toBeLessThanOrEqual(6)
        const days = w.flat().filter(Boolean)
        const [y, m] = ym.split('-').map(Number)
        expect(days.length).toBe(new Date(y, m, 0).getDate())
      }
    }
  })
  it('febrero 2027 con lunes: 4 semanas justas', () => {
    expect(monthWeeks('2027-02', 1).length).toBe(4)
  })
  it('entrada inválida → []', () => {
    expect(monthWeeks('x')).toEqual([])
    expect(monthWeeks('2026-13')).toEqual([])
  })
})

const items = [
  { kind: 'expense', date: '2026-10-29', amount: 100 },
  { kind: 'expense', date: '2026-10-29', amount: 50 },
  { kind: 'income', date: '2026-10-29', amount: 1000 },
  { kind: 'income', date: '2026-10-02', amount: 300 },
  { date: '2026-10-05', amount: -20 }, // sin kind = gasto, monto absoluto
  { kind: 'expense', date: '', amount: 9 },
]

describe('realByDay', () => {
  it('suma ingresos y gastos por día, en positivo', () => {
    const m = realByDay(items)
    expect(m.get('2026-10-29')).toMatchObject({ income: 1000, expense: 150 })
    expect(m.get('2026-10-29').items.length).toBe(3)
    expect(m.get('2026-10-05').expense).toBe(20)
    expect(m.has('')).toBe(false)
  })
  it('respeta el filtro Gastos / Ingresos', () => {
    expect(realByDay(items, { type: 'expense' }).get('2026-10-29')).toMatchObject({ income: 0, expense: 150 })
    const inc = realByDay(items, { type: 'income' })
    expect(inc.get('2026-10-29')).toMatchObject({ income: 1000, expense: 0 })
    expect(inc.has('2026-10-05')).toBe(false)
  })
})

const ruleSub = { id: 'rs-1', kind: 'expense', source: 'subscription', sourceId: 1, description: 'Netflix' }
const ruleSubNoDate = { id: 'rs-2', kind: 'expense', source: 'subscription', sourceId: 2, description: 'Spotify' }
const ruleDebt = { id: 'rd-3', kind: 'expense', source: 'debt', sourceId: 3, description: 'Banco' }
const ruleDebtNoDate = { id: 'rd-4', kind: 'expense', source: 'debt', sourceId: 4, description: 'Tío' }
const ruleSalary = { id: 'r-5', kind: 'income', source: 'manual', description: 'Sueldo' }
const subscriptions = [{ id: 1, nextPaymentDate: '2026-10-31' }, { id: 2 }]
const debts = [{ id: 3, dueDate: '2026-10-15' }, { id: 4, dueDate: '' }]

const occ = (rule, date, amount, status = 'pending') => ({ key: `${rule.id}|${date}`, rule, ruleId: rule.id, kind: rule.kind, date, amount, expected: amount, status })
const plan = [
  occ(ruleDebt, '2026-10-15', 200),            // pasado: no se muestra
  occ(ruleSub, '2026-10-31', 15),
  occ(ruleSalary, '2026-10-30', 2000),
  occ(ruleSalary, '2026-10-30', 0, 'confirmed'),
  occ(ruleSubNoDate, '2026-10-29', 10),
  occ(ruleDebtNoDate, '2026-10-31', 80),
  occ(ruleSubNoDate, '2026-10-30', 10),         // misma regla: una sola vez en "Sin fecha"
  occ(ruleSalary, '2026-10-29', 500, 'skipped'),
]

describe('isUndatedRule', () => {
  it('deuda sin vencimiento y suscripción sin próximo cobro', () => {
    expect(isUndatedRule(ruleDebtNoDate, { debts })).toBe(true)
    expect(isUndatedRule(ruleDebt, { debts })).toBe(false)
    expect(isUndatedRule(ruleSubNoDate, { subscriptions })).toBe(true)
    expect(isUndatedRule(ruleSub, { subscriptions })).toBe(false)
    expect(isUndatedRule(ruleSalary, { debts, subscriptions })).toBe(false)
    expect(isUndatedRule({ source: 'debt', sourceId: 99 }, { debts })).toBe(false) // origen ya borrado
    expect(isUndatedRule(null)).toBe(false)
  })
})

describe('plannedByDay', () => {
  it('solo pendientes de hoy en adelante; los sin fecha aparte, una vez por regla', () => {
    const { byDay, undated } = plannedByDay(plan, { today: '2026-10-29', debts, subscriptions })
    expect(byDay.has('2026-10-15')).toBe(false)
    expect(byDay.get('2026-10-31').map(o => o.ruleId)).toEqual(['rs-1'])
    expect(byDay.get('2026-10-30').map(o => o.ruleId)).toEqual(['r-5'])
    expect(undated.map(o => o.ruleId)).toEqual(['rs-2', 'rd-4'])
  })
  it('el filtro de tipo también rige lo previsto', () => {
    const inc = plannedByDay(plan, { today: '2026-10-29', type: 'income', debts, subscriptions })
    expect([...inc.byDay.keys()]).toEqual(['2026-10-30'])
    expect(inc.undated).toEqual([])
    const exp = plannedByDay(plan, { today: '2026-10-29', type: 'expense', debts, subscriptions })
    expect(exp.byDay.has('2026-10-30')).toBe(false)
  })
})

describe('buildCalendar', () => {
  const cal = buildCalendar({ ym: '2026-10', items, plan, today: '2026-10-29', weekStart: 1, debts, subscriptions })
  const cell = (date) => cal.weeks.flat().find(c => c && c.date === date)
  it('lo previsto nunca se mezcla con lo real', () => {
    const c29 = cell('2026-10-29')
    expect(c29).toMatchObject({ income: 1000, expense: 150, isToday: true, isPast: false, plannedExpense: 0 })
    const c31 = cell('2026-10-31')
    expect(c31).toMatchObject({ income: 0, expense: 0, plannedExpense: 15, plannedIncome: 0 })
    expect(cell('2026-10-30')).toMatchObject({ plannedIncome: 2000, income: 0 })
    expect(cell('2026-10-02')).toMatchObject({ isPast: true, income: 300 })
    expect(cal.undated.length).toBe(2)
  })
  it('la lente convierte cada cifra', () => {
    const half = buildCalendar({ ym: '2026-10', items, plan, today: '2026-10-29', debts, subscriptions, amount: n => n / 2 })
    const c = half.weeks.flat().find(x => x && x.date === '2026-10-29')
    expect(c.income).toBe(500)
    expect(c.expense).toBe(75)
  })
  it('un mes pasado no muestra previstos con fecha', () => {
    const past = buildCalendar({ ym: '2026-10', items, plan, today: '2026-11-05', debts, subscriptions })
    expect(past.weeks.flat().filter(Boolean).every(c => c.planned.length === 0)).toBe(true)
  })
})

describe('foco y teclado', () => {
  it('initialFocusDate: hoy si está en el mes, si no el día 1', () => {
    expect(initialFocusDate('2026-10', '2026-10-29')).toBe('2026-10-29')
    expect(initialFocusDate('2026-11', '2026-10-29')).toBe('2026-11-01')
  })
  it('flechas, Inicio y Fin; nunca sale del mes', () => {
    expect(moveFocus('2026-10-15', 'ArrowRight')).toBe('2026-10-16')
    expect(moveFocus('2026-10-15', 'ArrowLeft')).toBe('2026-10-14')
    expect(moveFocus('2026-10-15', 'ArrowDown')).toBe('2026-10-22')
    expect(moveFocus('2026-10-15', 'ArrowUp')).toBe('2026-10-08')
    expect(moveFocus('2026-10-01', 'ArrowLeft')).toBe('2026-10-01')
    expect(moveFocus('2026-10-29', 'ArrowDown')).toBe('2026-10-31')
    expect(moveFocus('2026-10-03', 'ArrowUp')).toBe('2026-10-01')
    // 15-oct-2026 es jueves: con lunes, la semana va del 12 al 18; con domingo, del 11 al 17.
    expect(moveFocus('2026-10-15', 'Home', { weekStart: 1 })).toBe('2026-10-12')
    expect(moveFocus('2026-10-15', 'End', { weekStart: 1 })).toBe('2026-10-18')
    expect(moveFocus('2026-10-15', 'Home', { weekStart: 0 })).toBe('2026-10-11')
    expect(moveFocus('2026-10-15', 'End', { weekStart: 0 })).toBe('2026-10-17')
    expect(moveFocus('2026-10-02', 'Home', { weekStart: 1 })).toBe('2026-10-01')
    expect(moveFocus('2026-10-15', 'Enter')).toBe(null)
    expect(moveFocus('x', 'ArrowLeft')).toBe(null)
  })
})

describe('compactNumber', () => {
  it('corto y sin símbolo, con el separador del locale', () => {
    expect(compactNumber(950)).toBe('950')
    expect(compactNumber(-950)).toBe('950')
    expect(compactNumber(1250, 'es-CL')).toBe('1,3K')
    expect(compactNumber(1250, 'en-US')).toBe('1.3K')
    expect(compactNumber(12_400)).toBe('12K')
    expect(compactNumber(1_500_000, 'de-DE')).toBe('1,5M')
    expect(compactNumber(25_000_000)).toBe('25M')
    expect(compactNumber(null)).toBe('0')
  })
})
