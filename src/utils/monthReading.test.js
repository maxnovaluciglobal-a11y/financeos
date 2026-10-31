import { describe, it, expect } from 'vitest'
import { monthReading, monthPosition, topCategoryDelta, budgetsConclusion, categoryConclusion, barConclusion,
  paceReference, paceSeries, paceConclusion, renderReading } from './monthReading.js'
import { homeMonthTotals, budgetRows } from '../pages/Dashboard/dashboardModel.js'
import { cumulativeByDay } from './chartSeries.js'
import { es } from '../i18n/es.js'
import { en } from '../i18n/en.js'
import { pt } from '../i18n/pt.js'
import { de } from '../i18n/de.js'
import { interpolate } from '../i18n/translate.js'

const NOW = new Date(2026, 9, 20) // 20-oct-2026: quedan 11 días
const M = '2026-10'
const exp = (date, amount, category = 'Alimentación') => ({ date, amount, category })
const inc = (date, amount) => ({ date, amount, category: 'Salario' })

function read({ incomes = [], expenses = [], budgets = [], limits = {}, pending = null, country = 'CL', now = NOW, month = M, rates = null }) {
  const totals = homeMonthTotals({ incomes, expenses, activeMonth: month, now })
  const monthExpenses = expenses.filter(e => e.date.startsWith(month))
  const rows = budgetRows({ budgets, monthExpenses, limits })
  return monthReading({ activeMonth: month, now, totals, expenses, rows, pending, country, rates })
}
const fmt = { money: n => `$${Math.round(n * 100) / 100}`, usd: n => `US$${Math.round(n * 100) / 100}`, pct: r => `${Math.round(r * 100)} %`, cat: c => c, month: () => 'septiembre' }
const say = (l, dict = es) => renderReading(l, { t: (k, v) => interpolate(dict[k] ?? k, v), fmt })

const ten = Array.from({ length: 6 }, (_, i) => exp(`2026-10-${String(i + 2).padStart(2, '0')}`, 10))

describe('monthPosition', () => {
  it('en curso, cerrado y futuro', () => {
    expect(monthPosition(M, NOW)).toEqual({ mode: 'current', today: 20, days: 31, left: 11 })
    expect(monthPosition('2026-09', NOW).mode).toBe('past')
    expect(monthPosition('2026-11', NOW).mode).toBe('future')
  })
})

describe('monthReading · prioridad: una frase, la más útil', () => {
  it('mes vacío', () => {
    const r = read({})
    expect(r.kind).toBe('empty')
    expect(say(r.short)).toBe('Todavía no hay movimientos este mes.')
  })
  it('mes vacío con fijos previstos', () => {
    expect(read({ pending: { count: 2, expense: 500, income: 0 } }).short.key).toBe('reading.emptyPending')
  })
  it('mes futuro y mes cerrado sin datos', () => {
    expect(read({ month: '2026-11' }).short.key).toBe('reading.future')
    expect(read({ month: '2026-09' }).short.key).toBe('reading.emptyClosed')
  })
  it('primeros días: no habla de ritmo aunque ya esté negativo', () => {
    const r = read({ now: new Date(2026, 9, 2), incomes: [inc('2026-10-01', 100)], expenses: [exp('2026-10-01', 900, 'Vivienda')] })
    expect(r.kind).toBe('early')
    expect(say(r.short)).toBe('Todavía hay pocos datos para leer el ritmo del mes; quedan 29 días.')
  })
  it('pocos movimientos, también más tarde en el mes', () => {
    expect(read({ incomes: [inc('2026-10-01', 100)], expenses: [exp('2026-10-05', 10)] }).kind).toBe('early')
  })
  it('sin ingresos todavía', () => {
    expect(say(read({ expenses: ten }).short)).toBe('Van $60 en gastos y todavía no hay ingresos este mes.')
    expect(say(read({ expenses: ten, pending: { count: 1, expense: 0, income: 1000 } }).short)).toBe('Van $60 en gastos; hay $1000 en ingresos por entrar.')
  })
  it('saldo negativo', () => {
    const r = read({ incomes: [inc('2026-10-01', 40)], expenses: ten })
    expect(say(r.short)).toBe('Los gastos superan a los ingresos por $20 este mes.')
  })
  it('saldo negativo con ingreso por entrar: lo dice sin alarma', () => {
    const r = read({ incomes: [inc('2026-10-01', 40)], expenses: ten, pending: { count: 1, expense: 0, income: 500 } })
    expect(say(r.short)).toBe('Los gastos superan a los ingresos por $20; faltan $500 por entrar.')
  })
  it('presupuesto pasado gana a ritmo y fijos', () => {
    const r = read({ incomes: [inc('2026-10-01', 1000)], expenses: ten, budgets: [{ category: 'Alimentación', limit: 50 }],
      pending: { count: 2, expense: 100, income: 0 } })
    expect(say(r.short)).toBe('Alimentación pasó su presupuesto por $10.')
    expect(r.long.length).toBeGreaterThan(1)
  })
  it('varios presupuestos pasados nombran el más alto', () => {
    const expenses = [...ten, exp('2026-10-03', 30, 'Ropa')]
    const r = read({ incomes: [inc('2026-10-01', 1000)], expenses, budgets: [{ category: 'Alimentación', limit: 50 }, { category: 'Ropa', limit: 10 }] })
    expect(say(r.short)).toBe('2 categorías pasaron su presupuesto; la más alta es Ropa.')
  })
  it('ritmo alto en porcentaje fuera de VE/AR, coherente con el anillo', () => {
    const r = read({ incomes: [inc('2026-10-01', 100)], expenses: ten.map(e => ({ ...e, amount: 14 })) })
    expect(say(r.short)).toBe('Va el 65 % del mes y se gastó el 84 % del ingreso; quedan 11 días.')
    // #12: el dato por día llega a la lectura larga.
    expect(r.facts.map(f => f.key)).toContain('reading.perDay')
  })
  it('VE/AR: el ritmo va en monto, sin porcentaje', () => {
    const r = read({ country: 'VE', incomes: [inc('2026-10-01', 100)], expenses: ten.map(e => ({ ...e, amount: 14 })) })
    expect(r.short.key).toBe('reading.pace.highAmount')
    expect(say(r.short)).toBe('Se gastan $4.2 por día, $0.97 más de lo que cabe en el ingreso; quedan 11 días.')
    expect(r.facts.map(f => f.key)).not.toContain('reading.perDay')
  })
  it('presupuesto cerca del límite', () => {
    const r = read({ incomes: [inc('2026-10-01', 1000)], expenses: ten, budgets: [{ category: 'Alimentación', limit: 70 }] })
    expect(say(r.short)).toBe('Alimentación lleva el 86 % de su presupuesto; quedan 11 días.')
  })
  it('fijos pendientes', () => {
    const r = read({ incomes: [inc('2026-10-01', 1000)], expenses: ten, pending: { count: 3, expense: 200, income: 0 } })
    expect(say(r.short)).toBe('Faltan 3 pagos fijos por $200 este mes.')
    expect(say(read({ incomes: [inc('2026-10-01', 1000)], expenses: ten, pending: { count: 1, expense: 50, income: 0 } }).short)).toBe('Falta un pago fijo por $50 este mes.')
  })
  it('categoría que más subió, en % o en monto según el país', () => {
    const prev = [exp('2026-09-03', 30), exp('2026-09-04', 20)]
    const expenses = [...prev, ...ten]
    const incomes = [inc('2026-10-01', 1000)]
    expect(say(read({ incomes, expenses }).short)).toBe('Alimentación va 20 % arriba de septiembre a esta fecha.')
    expect(say(read({ incomes, expenses, country: 'AR' }).short)).toBe('Alimentación va $10 arriba de septiembre a esta fecha.')
  })
  it('VE con tasas: la variación va en US$ de cada período', () => {
    const prev = [exp('2026-09-03', 30), exp('2026-09-04', 20)]
    const r = read({ incomes: [inc('2026-10-01', 1000)], expenses: [...prev, ...ten], country: 'VE', rates: { cur: 2, prev: 1 } })
    const f = r.facts.find(x => x.key.startsWith('reading.cat.'))
    expect(f.key).toBe('reading.cat.down')
    expect(f.vars.amount).toEqual({ usd: 20 })
  })
  it('ritmo normal, sin nada más que decir', () => {
    const r = read({ incomes: [inc('2026-10-01', 1000)], expenses: ten })
    expect(say(r.short)).toBe('El gasto va dentro del ritmo del ingreso; quedan 11 días.')
  })
  it('último día del mes', () => {
    const r = read({ now: new Date(2026, 9, 31), incomes: [inc('2026-10-01', 1000)], expenses: ten })
    expect(say(r.short)).toBe('El gasto va dentro del ritmo del ingreso; hoy termina el mes.')
  })
  it('falta 1 día: singular', () => {
    const r = read({ now: new Date(2026, 9, 30), incomes: [inc('2026-10-01', 1000)], expenses: ten })
    expect(say(r.short)).toContain('queda 1 día')
  })
})

describe('monthReading · mes cerrado', () => {
  const month = '2026-09'
  const expenses = [exp('2026-09-03', 300), exp('2026-09-04', 200), exp('2026-08-04', 100)]
  it('a favor, en contra y en cero', () => {
    expect(say(read({ month, incomes: [inc('2026-09-01', 800)], expenses }).short)).toBe('Septiembre cerró con $300 a favor.')
    expect(say(read({ month, incomes: [inc('2026-09-01', 100)], expenses }).short)).toBe('Septiembre cerró con $400 en contra.')
    expect(say(read({ month, incomes: [inc('2026-09-01', 500)], expenses }).short)).toBe('Septiembre cerró en cero.')
  })
  it('la lectura larga suma presupuesto y variación, hasta 3 frases', () => {
    const r = read({ month, incomes: [inc('2026-09-01', 800)], expenses, budgets: [{ category: 'Alimentación', limit: 400 }] })
    expect(r.kind).toBe('closed')
    expect(r.long.length).toBe(3)
    expect(say(r.long[1])).toBe('Alimentación terminó $100 sobre su presupuesto.')
  })
  it('no pide días restantes', () => {
    for (const l of read({ month, incomes: [inc('2026-09-01', 800)], expenses }).facts) expect(l.vars.left).toBeUndefined()
  })
})

describe('topCategoryDelta', () => {
  it('ignora cambios chicos y categorías sin base', () => {
    const expenses = [exp('2026-10-01', 105), exp('2026-09-01', 100), exp('2026-10-01', 500, 'Ropa')]
    expect(topCategoryDelta({ expenses, activeMonth: M })).toBeNull()
  })
  it('compara hasta el mismo día del mes anterior', () => {
    const expenses = [exp('2026-10-05', 200), exp('2026-09-05', 100), exp('2026-09-25', 900)]
    expect(topCategoryDelta({ expenses, activeMonth: M, cutDay: 20 }).dir).toBe('up')
  })
  it('excluye inversión', () => {
    const expenses = [{ ...exp('2026-10-05', 900), inv: true }, exp('2026-09-05', 100)]
    expect(topCategoryDelta({ expenses, activeMonth: M })).toBeNull()
  })
})

describe('titulares (#9)', () => {
  const row = (category, spent, limit, state) => ({ category, spent, limit, state })
  it('presupuestos', () => {
    expect(budgetsConclusion([])).toBeNull()
    expect(budgetsConclusion([row('A', 0, 10, 'ok')])).toBeNull()
    expect(say(budgetsConclusion([row('Ropa', 120, 100, 'over')]))).toBe('Ropa pasó su presupuesto por $20')
    expect(say(budgetsConclusion([row('A', 2, 1, 'over'), row('B', 2, 1, 'over')]))).toBe('2 categorías pasaron su presupuesto')
    expect(say(budgetsConclusion([row('Ropa', 90, 100, 'near')]))).toBe('Ropa está cerca de su límite')
    expect(say(budgetsConclusion([row('A', 90, 100, 'near'), row('B', 90, 100, 'near')]))).toBe('2 categorías están cerca de su límite')
    expect(say(budgetsConclusion([row('Ropa', 10, 100, 'ok')]))).toBe('Los presupuestos van dentro del límite')
    expect(say(budgetsConclusion([row('Ropa', 10, 100, 'ok')], { closed: true }))).toBe('Los presupuestos cerraron dentro del límite')
  })
  it('categorías: necesita al menos dos', () => {
    expect(categoryConclusion([exp('2026-10-01', 10)])).toBeNull()
    expect(say(categoryConclusion([exp('2026-10-01', 75), exp('2026-10-01', 25, 'Ropa')]))).toBe('Alimentación se llevó el 75 % del gasto')
  })
  it('ingresos y gastos: necesita al menos dos meses con datos', () => {
    expect(barConclusion([{ income: 0, expense: 0 }, { income: 5, expense: 1 }])).toBeNull()
    expect(say(barConclusion([{ income: 5, expense: 1 }, { income: 5, expense: 2 }]))).toBe('Los ingresos cubrieron los gastos en los 2 meses con datos')
    expect(say(barConclusion([{ income: 5, expense: 9 }, { income: 5, expense: 2 }, { income: 0, expense: 0 }]))).toBe('Los gastos superaron a los ingresos en 1 de 2 meses')
  })
})

describe('gasto contra ritmo (#11)', () => {
  it('referencia: ingreso, si no el mes anterior, si no nada', () => {
    expect(paceReference({ income: 900, prevExpenses: 5 })).toEqual({ value: 900, kind: 'income' })
    expect(paceReference({ income: 0, prevExpenses: 5 })).toEqual({ value: 5, kind: 'prev' })
    expect(paceReference({})).toBeNull()
  })
  it('la línea llega a la referencia el último día y respeta los días sin dato', () => {
    const cum = cumulativeByDay([exp('2026-10-02', 10)], M, NOW)
    const s = paceSeries(cum, 310)
    expect(s).toHaveLength(31)
    expect(s[0].pace).toBe(10)
    expect(s[30].pace).toBe(310)
    expect(s[19].current).toBe(10)
    expect(s[25].current).toBeNull()
  })
  it('título sobre, bajo y al ritmo', () => {
    const data = (current) => [{ day: 1, current, pace: 100 }, { day: 2, current: null, pace: 200 }]
    expect(say(paceConclusion(data(150)))).toBe('El gasto va $50 sobre el ritmo')
    expect(say(paceConclusion(data(60)))).toBe('El gasto va $40 bajo el ritmo')
    expect(say(paceConclusion(data(101)))).toBe('El gasto va al ritmo del mes')
    expect(say(paceConclusion(data(150), { closed: true }))).toBe('El gasto cerró $50 sobre el ritmo')
    expect(paceConclusion(data(0))).toBeNull()
  })
})

describe('renderReading', () => {
  it('sin línea no hay texto', () => {
    expect(renderReading(null, { t: () => 'x', fmt })).toBe('')
  })
  it('todas las claves existen en los 4 idiomas', () => {
    const cases = [
      read({}), read({ month: '2026-11' }), read({ expenses: ten }),
      read({ incomes: [inc('2026-10-01', 40)], expenses: ten }),
      read({ incomes: [inc('2026-10-01', 100)], expenses: ten.map(e => ({ ...e, amount: 14 })) }),
    ]
    for (const dict of [es, en, pt, de]) for (const c of cases) for (const l of c.facts) {
      expect(dict[l.key], l.key).toBeTruthy()
      expect(say(l, dict)).not.toMatch(/\{\w+\}/)
    }
  })
})
