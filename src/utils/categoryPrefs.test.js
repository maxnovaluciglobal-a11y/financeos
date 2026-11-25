import { describe, it, expect } from 'vitest'
import {
  sanitizePrefs, prefsOf, visibleCats, availableCats, hideCatPatch, addCatPatch, lookPatch,
  emojiFor, nameFor, slotFor, isCustom, CATALOG, COLOR_SLOTS,
} from './categoryPrefs.js'
import { getCategoriesExpense, CATS_EXPENSE } from './index.js'
import { es as esDict } from '../i18n/es.js'
import { en } from '../i18n/en.js'
import { pt } from '../i18n/pt.js'
import { de } from '../i18n/de.js'

describe('sanitizePrefs (compatibilidad hacia atrás)', () => {
  it('sin preferencias: nada oculto, sin aspecto propio', () => {
    expect(prefsOf({})).toEqual({ hidden: { expense: [], income: [] }, look: {} })
    expect(sanitizePrefs('x')).toEqual({ hidden: { expense: [], income: [] }, look: {} })
  })
  it('descarta lo malformado', () => {
    const p = sanitizePrefs({ hidden: { expense: ['Ropa', '', 3, 'Ropa'] }, look: { Ropa: { emoji: '👗', slot: 6, name: '' }, X: null, Y: { slot: 99 } } })
    expect(p.hidden.expense).toEqual(['Ropa'])
    expect(p.look).toEqual({ Ropa: { emoji: '👗' } })
  })
})

describe('píldoras visibles y disponibles', () => {
  const settings = { categoryPrefs: { hidden: { expense: ['Ropa', 'Deporte'] } } }
  const eff = getCategoriesExpense(settings)
  it('quitar no borra: solo saca de las píldoras', () => {
    const vis = visibleCats(eff, prefsOf(settings), 'expense')
    expect(vis).not.toContain('Ropa')
    expect(vis).toContain('Vivienda')
    expect(eff).toContain('Ropa')
  })
  it('disponibles = las quitadas + catálogo que falta', () => {
    const av = availableCats(eff, prefsOf(settings), 'expense')
    expect(av.slice(0, 2)).toEqual(['Ropa', 'Deporte'])
    expect(av).toContain('Mascota')
  })
  it('nunca deja cero píldoras', () => {
    const one = { categoryPrefs: { hidden: { expense: CATS_EXPENSE.slice(1) } } }
    expect(hideCatPatch(one, CATS_EXPENSE[0], 'expense', CATS_EXPENSE)).toBeNull()
    expect(hideCatPatch({}, 'Ropa', 'expense', CATS_EXPENSE).categoryPrefs.hidden.expense).toEqual(['Ropa'])
  })
})

describe('addCatPatch', () => {
  it('una del catálogo se agrega a categoriesExpense', () => {
    const r = addCatPatch({ categoriesExpense: ['Educación hijos'] }, 'Mascota', 'expense', CATS_EXPENSE)
    expect(r.value).toBe('Mascota')
    expect(r.patch.categoriesExpense).toEqual(['Educación hijos', 'Mascota'])
  })
  it('una quitada vuelve sin duplicarse; mayúsculas distintas usan la existente', () => {
    const s = { categoryPrefs: { hidden: { expense: ['Ropa'] } } }
    const r = addCatPatch(s, 'ropa', 'expense', CATS_EXPENSE)
    expect(r.value).toBe('Ropa')
    expect(r.patch.categoriesExpense).toBeUndefined()
    expect(r.patch.categoryPrefs.hidden.expense).toEqual([])
  })
  it('vacía → null', () => { expect(addCatPatch({}, '  ', 'expense', CATS_EXPENSE)).toBeNull() })
})

describe('lookPatch y lectura', () => {
  it('emoji, color y nombre propios; vacío vuelve al de siempre', () => {
    let s = { ...lookPatch({}, 'Alimentación', { emoji: '🥑', slot: 3, name: 'Súper' }) }
    let p = prefsOf(s)
    expect(emojiFor('Alimentación', p)).toBe('🥑')
    expect(slotFor('Alimentación', p)).toBe(3)
    expect(nameFor('Alimentación', p, 'es')).toBe('Súper')
    s = { ...s, ...lookPatch(s, 'Alimentación', { emoji: '', slot: null, name: '' }) }
    p = prefsOf(s)
    expect(p.look).toEqual({})
    expect(emojiFor('Alimentación', p)).toBe('🛒')
    expect(slotFor('Alimentación', p)).toBeNull()
  })
  it('una categoría sin emoji conocido lleva uno genérico', () => {
    expect(emojiFor('Algo raro', prefsOf({}))).toBeTruthy()
  })
  it('isCustom distingue las de fábrica', () => {
    expect(isCustom('Vivienda', 'expense')).toBe(false)
    expect(isCustom('Educación hijos', 'expense')).toBe(true)
  })
  it('el rojo de error no es un color elegible', () => {
    expect(COLOR_SLOTS).not.toContain(6)
  })
})

describe('catálogo traducido en los 4 idiomas', () => {
  it('cada categoría del catálogo tiene cat.* en es/en/pt/de', () => {
    for (const c of [...CATALOG.expense, ...CATALOG.income]) {
      for (const d of [esDict, en, pt, de]) expect(typeof d[`cat.${c}`], `${c}`).toBe('string')
    }
  })
})
