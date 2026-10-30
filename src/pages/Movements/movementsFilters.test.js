import { describe, it, expect } from 'vitest'
import { toggleKind, toggleCategory, activeFilters, hasActiveFilter, clearFilter, searchVisible, toggleSearch, donutPick, donutRecords } from './movementsFilters.js'

describe('filtros de Movimientos (poda P2)', () => {
  it('origen y categoría se apagan al tocar el activo', () => {
    expect(toggleKind('all', 'fixed')).toBe('fixed')
    expect(toggleKind('fixed', 'fixed')).toBe('all')
    expect(toggleKind('fixed', 'oneoff')).toBe('oneoff')
    expect(toggleKind('all', 'raro')).toBe('all')
    expect(toggleCategory(null, 'Salud')).toBe('Salud')
    expect(toggleCategory('Salud', 'Salud')).toBe(null)
    expect(toggleCategory('Salud', '')).toBe(null)
  })
  it('lista los activos en orden y los quita de a uno o todos', () => {
    expect(activeFilters({})).toEqual([])
    expect(activeFilters({ kind: 'all', category: null })).toEqual([])
    expect(activeFilters({ kind: 'fixed', category: 'Salud' })).toEqual([{ id: 'kind', value: 'fixed' }, { id: 'category', value: 'Salud' }])
    expect(hasActiveFilter({ category: 'Ropa' })).toBe(true)
    expect(clearFilter({ kind: 'fixed', category: 'Salud' }, 'kind')).toEqual({ kind: 'all', category: 'Salud' })
    expect(clearFilter({ kind: 'fixed', category: 'Salud' }, 'category')).toEqual({ kind: 'fixed', category: null })
    expect(clearFilter({ kind: 'fixed', category: 'Salud' }, 'all')).toEqual({ kind: 'all', category: null })
  })
  it('el buscador sigue visible mientras haya texto', () => {
    expect(searchVisible({})).toBe(false)
    expect(searchVisible({ open: true })).toBe(true)
    expect(searchVisible({ open: false, query: 'taxi' })).toBe(true)
    expect(searchVisible({ open: false, query: '   ' })).toBe(false)
    expect(toggleSearch({ open: false })).toBe(true)
    expect(toggleSearch({ open: true, query: '' })).toBe(false)
    expect(toggleSearch({ open: true, query: 'taxi' })).toBe(true)
  })
  it('el donut filtra por categoría: de Ingresos pasa a Gastos y del calendario a la lista', () => {
    expect(donutPick({ type: 'income', view: 'cal' }, 'Salud')).toEqual({ type: 'expense', view: 'list', category: 'Salud' })
    expect(donutPick({ type: 'all', view: 'list' }, 'Salud')).toEqual({ type: 'all', view: 'list', category: 'Salud' })
    expect(donutPick({ type: 'expense', view: 'cal' }, null)).toEqual({ type: 'expense', view: 'cal', category: null })
  })
  it('registros del donut: solo gastos con monto, en la lente', () => {
    const E = [{ category: 'Salud', amount: 100 }, { category: 'Ropa', amount: 0 }, null, { category: 'Ropa', amount: '50' }]
    expect(donutRecords(E)).toEqual([{ category: 'Salud', amount: 100 }, { category: 'Ropa', amount: 50 }])
    expect(donutRecords(E, (n) => n / 10)).toEqual([{ category: 'Salud', amount: 10 }, { category: 'Ropa', amount: 5 }])
    expect(donutRecords(null)).toEqual([])
  })
})
