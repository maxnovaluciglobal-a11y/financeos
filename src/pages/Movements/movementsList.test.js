import { describe, it, expect } from 'vitest'
import { filterMovements, groupByDay, categoriesByAmount, dayLabel, isFixed } from './movementsList.js'

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
    expect(g[0].total).toBe(62_500)
    expect(g[0].items.map((e) => e.id)).toEqual(['a', 'b'])
    expect(g[2].total).toBe(900_000)
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
