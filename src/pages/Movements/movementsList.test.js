import { describe, it, expect } from 'vitest'
import { filterMovements, groupByDay, categoriesByAmount, dayLabel, isFixed, mergeMovements, signedAmount, monthTotals, lensState, inLens, parseExpensePrefill, normType } from './movementsList.js'

const E = [
  { id: 'a', date: '2026-10-15', amount: 50_000, category: 'Alimentación', description: 'Supermercado Éxito' },
  { id: 'b', date: '2026-10-15', amount: 12_500, category: 'Transporte', description: 'Taxi', subcategory: 'Taxi / Uber' },
  { id: 'c', date: '2026-10-14', amount: 47_900, category: 'Entretención', description: 'Netflix', recurringId: 'rs-1' },
  { id: 'd', date: '2026-10-02', amount: 900_000, category: 'Vivienda', description: 'Arriendo', recurringId: 'rc-2', notes: 'octubre' },
]

describe('filterMovements (UI-M3)', () => {
  it('busca sin tildes ni mayúsculas en descripción, categoría traducida, subcategoría y notas', () => {
    expect(filterMovements(E, { query: 'exito' }).map((e) => e.id)).toEqual(['a'])
    expect(filterMovements(E, { query: 'uber' }).map((e) => e.id)).toEqual(['b'])
    expect(filterMovements(E, { query: 'OCTUBRE' }).map((e) => e.id)).toEqual(['d'])
    expect(filterMovements(E, { query: 'housing', catNameOf: (c) => (c === 'Vivienda' ? 'Housing' : c) }).map((e) => e.id)).toEqual(['d'])
  })
  it('filtra por categoría y por fijo / único', () => {
    expect(filterMovements(E, { category: 'Transporte' }).map((e) => e.id)).toEqual(['b'])
    expect(filterMovements(E, { kind: 'fixed' }).map((e) => e.id)).toEqual(['c', 'd'])
    expect(filterMovements(E, { kind: 'oneoff' }).map((e) => e.id)).toEqual(['a', 'b'])
    expect(isFixed(E[2])).toBe(true)
  })
  it('combina filtros y tolera entradas vacías', () => {
    expect(filterMovements(E, { kind: 'fixed', query: 'net' }).map((e) => e.id)).toEqual(['c'])
    expect(filterMovements(null)).toEqual([])
    expect(filterMovements([null, E[0]])).toEqual([E[0]])
  })
})

describe('groupByDay (UI-M3)', () => {
  it('agrupa por día, del más reciente al más viejo, con subtotal', () => {
    const g = groupByDay(E)
    expect(g.map((d) => d.date)).toEqual(['2026-10-15', '2026-10-14', '2026-10-02'])
    expect(g[0].expense).toBe(62_500)
    expect(g[0].income).toBe(0)
    expect(g[0].net).toBe(-62_500)
    expect(g[0].items.map((e) => e.id)).toEqual(['a', 'b'])
    expect(g[2].expense).toBe(900_000)
  })
  it('lista vacía = sin grupos', () => {
    expect(groupByDay([])).toEqual([])
  })
})

describe('categoriesByAmount', () => {
  it('ordena las categorías presentes por gasto', () => {
    expect(categoriesByAmount(E)).toEqual(['Vivienda', 'Alimentación', 'Entretención', 'Transporte'])
  })
})

describe('dayLabel', () => {
  const t = (k) => ({ 'movl.day.today': 'Hoy', 'movl.day.yesterday': 'Ayer' }[k] || k)
  it('Hoy / Ayer / día con nombre', () => {
    expect(dayLabel('2026-10-15', { today: '2026-10-15', t })).toBe('Hoy')
    expect(dayLabel('2026-10-14', { today: '2026-10-15', t })).toBe('Ayer')
    expect(dayLabel('2026-10-02', { today: '2026-10-15', t, locale: 'es-CL' })).toMatch(/^vie.*2.*oct/)
    expect(dayLabel('2026-10-02', { today: '2026-10-15', t, locale: 'en-US' })).toBe('Fri, Oct 2')
  })
})

// ── B3a: ingresos y gastos juntos ──────────────────────────────────────────
const I = [
  { id: 'a', date: '2026-10-15', amount: 2_000_000, category: 'Salario', source: 'Sueldo octubre', createdAt: '2026-10-15T09:00:00Z' },
  { id: 'i2', date: '2026-10-03', amount: 300_000, category: 'Freelance', source: 'Proyecto web', recurrence: 'Mensual', inv: true },
  { id: 'i3', date: '2026-10-14', amount: 150_000, category: 'Bono', source: 'Bono', recurringId: 'rc-9' },
]
const EX = E.map((e, n) => ({ ...e, createdAt: `2026-10-15T0${n}:00:00Z` }))

describe('mergeMovements (B3a)', () => {
  const items = mergeMovements(EX, I)
  it('mezcla, ordena por día (y por creación dentro del día) y no confunde ids repetidos entre stores', () => {
    expect(items.map((x) => x.key)).toEqual(['income:a', 'expense:b', 'expense:a', 'expense:c', 'income:i3', 'income:i2', 'expense:d'])
    expect(new Set(items.map((x) => x.key)).size).toBe(items.length)
  })
  it('conserva el registro original en rec y usa la fuente como nombre del ingreso', () => {
    const inc = items.find((x) => x.key === 'income:a')
    expect(inc.rec).toBe(I[0])
    expect(inc.name).toBe('Sueldo octubre')
    expect(items.find((x) => x.key === 'expense:a').name).toBe('Supermercado Éxito')
  })
  it('signos: ingreso +, gasto −', () => {
    expect(signedAmount(items.find((x) => x.key === 'income:a'))).toBe(2_000_000)
    expect(signedAmount(items.find((x) => x.key === 'expense:b'))).toBe(-12_500)
    expect(signedAmount({ amount: -40 })).toBe(-40)
  })
  it('tolera listas vacías o nulas', () => {
    expect(mergeMovements(null, undefined)).toEqual([])
    expect(mergeMovements([null], [null])).toEqual([])
  })
})

describe('filtros con tipo (B3a)', () => {
  const items = mergeMovements(EX, I)
  it('Todos · Gastos · Ingresos', () => {
    expect(filterMovements(items, { type: 'all' })).toHaveLength(7)
    expect(filterMovements(items, { type: 'expense' }).every((x) => x.kind === 'expense')).toBe(true)
    expect(filterMovements(items, { type: 'income' }).map((x) => x.id)).toEqual(['a', 'i3', 'i2'])
  })
  it('origen fijo cuenta reglas y la recurrencia vieja de los ingresos', () => {
    expect(filterMovements(items, { type: 'income', kind: 'fixed' }).map((x) => x.id)).toEqual(['i3', 'i2'])
    expect(filterMovements(items, { type: 'income', kind: 'oneoff' }).map((x) => x.id)).toEqual(['a'])
    expect(isFixed({ kind: 'expense', recurrence: 'Mensual' })).toBe(false)
    expect(isFixed({ kind: 'income', recurrence: 'Único' })).toBe(false)
  })
  it('busca en la fuente del ingreso y combina con categoría', () => {
    expect(filterMovements(items, { query: 'sueldo' }).map((x) => x.key)).toEqual(['income:a'])
    expect(filterMovements(items, { category: 'Freelance', type: 'income' }).map((x) => x.id)).toEqual(['i2'])
    expect(filterMovements(items, { category: 'Freelance', type: 'expense' })).toEqual([])
  })
  it('normType acepta solo los tres tipos', () => {
    expect(normType('income')).toBe('income')
    expect(normType('x')).toBe('all')
    expect(normType(null)).toBe('all')
  })
})

describe('totales por día y del mes (B3a)', () => {
  const items = mergeMovements(EX, I)
  it('el día lleva lo que entró y lo que salió', () => {
    const g = groupByDay(items)
    expect(g[0]).toMatchObject({ date: '2026-10-15', income: 2_000_000, expense: 62_500, net: 1_937_500 })
    expect(g.find((d) => d.date === '2026-10-14')).toMatchObject({ income: 150_000, expense: 47_900 })
    expect(g.find((d) => d.date === '2026-10-03')).toMatchObject({ income: 300_000, expense: 0, net: 300_000 })
  })
  it('monthTotals separa ingresos, gastos y la parte de inversión', () => {
    const t = monthTotals([...items, { kind: 'expense', amount: 10_000, inv: true }])
    expect(t).toEqual({ income: 2_450_000, expense: 1_020_400, invIncome: 300_000, invExpense: 10_000, incomeCount: 3, expenseCount: 5 })
    expect(monthTotals(null).income).toBe(0)
  })
})

describe('lente en US$ (B3a, R12)', () => {
  const rate = { rate: 40, at: 1_761_700_000_000, source: 'bcv' }
  it('solo se activa si califica, hay tasa y el usuario eligió US$', () => {
    expect(lensState({ eligible: true, rate, mode: 'ref' })).toEqual({ available: true, on: true, rate })
    expect(lensState({ eligible: true, rate, mode: 'local' })).toMatchObject({ available: true, on: false })
    expect(lensState({ eligible: false, rate, mode: 'ref' })).toMatchObject({ available: false, on: false, rate: null })
    expect(lensState({ eligible: true, rate: null, mode: 'ref' })).toMatchObject({ available: false, on: false })
    expect(lensState({ eligible: true, rate: { rate: 0 }, mode: 'ref' }).on).toBe(false)
    expect(lensState().on).toBe(false)
  })
  it('convierte con la tasa (moneda principal por 1 US$); sin lente, el mismo monto', () => {
    const on = lensState({ eligible: true, rate, mode: 'ref' })
    expect(inLens(1_000, on)).toBe(25)
    expect(inLens('80', on)).toBe(2)
    expect(inLens(1_000, lensState({ eligible: true, rate, mode: 'local' }))).toBe(1_000)
    expect(inLens(1_000, null)).toBe(1_000)
    // Los totales del día convierten igual que cada fila.
    const g = groupByDay(mergeMovements(EX, I))[0]
    expect(inLens(g.income, on) - inLens(g.expense, on)).toBeCloseTo(inLens(g.net, on))
  })
})

describe('prellenado del gasto detallado (contrato con el alta rápida)', () => {
  const opts = { categories: ['Alimentación', 'Transporte'], methods: ['Débito', 'Efectivo'], today: '2026-10-30' }
  it('lee el JSON y valida cada campo', () => {
    expect(parseExpensePrefill(JSON.stringify({ description: ' Pan ', amount: 12.5, date: '2026-10-29', category: 'Transporte', method: 'Efectivo' }), opts))
      .toEqual({ description: 'Pan', amount: '12.5', date: '2026-10-29', category: 'Transporte', method: 'Efectivo' })
  })
  it('lo inválido cae al valor por defecto (fecha de hoy; categoría y medio sin tocar)', () => {
    expect(parseExpensePrefill('{"amount":"1,5","date":"ayer","category":"Inventada","method":"Cripto"}', opts))
      .toEqual({ amount: '1.5', date: '2026-10-30' })
  })
  it('sin descripción ni monto, o JSON roto, no abre nada', () => {
    expect(parseExpensePrefill(null, opts)).toBeNull()
    expect(parseExpensePrefill('', opts)).toBeNull()
    expect(parseExpensePrefill('{roto', opts)).toBeNull()
    expect(parseExpensePrefill('[1,2]', opts)).toBeNull()
    expect(parseExpensePrefill('{"amount":0,"description":"  "}', opts)).toBeNull()
    expect(parseExpensePrefill('"texto"', opts)).toBeNull()
  })
})
