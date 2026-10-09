import { describe, it, expect } from 'vitest'
import { canonicalCategory, unifyRecords, mergeBudgets, unifySettings, planCategoryUnification, unifyCategoryPayload, CATEGORY_ALIASES } from './categoryAliases.js'
import TEMPLATES from '../data/templates.js'
import { CATS_EXPENSE } from './index.js'
import { es } from '../i18n/es.js'
import { en } from '../i18n/en.js'
import { pt } from '../i18n/pt.js'
import { de } from '../i18n/de.js'

describe('canonicalCategory', () => {
  it('mapea la grafía vieja y deja todo lo demás igual', () => {
    expect(canonicalCategory('Entretenimiento')).toBe('Entretención')
    expect(canonicalCategory('Entretención')).toBe('Entretención')
    expect(canonicalCategory('Ocio y entretenimiento')).toBe('Ocio y entretenimiento')
    expect(canonicalCategory(undefined)).toBe(undefined)
    expect(canonicalCategory('toString')).toBe('toString')
  })

  it('el destino de cada alias es canónico y tiene etiqueta en los 4 idiomas', () => {
    for (const to of Object.values(CATEGORY_ALIASES)) {
      expect(CATS_EXPENSE).toContain(to)
      for (const d of [es, en, pt, de]) expect(d[`cat.${to}`]).toBeTruthy()
    }
  })

  it('las plantillas solo usan el valor canónico (nada de datos nuevos con la grafía vieja)', () => {
    const json = JSON.stringify(TEMPLATES)
    for (const from of Object.keys(CATEGORY_ALIASES)) expect(json).not.toContain(`"${from}"`)
  })
})

describe('unifyRecords', () => {
  it('renombra solo los afectados, sin perder campos ni registros', () => {
    const list = [
      { id: 'a', category: 'Entretenimiento', amount: 10, description: 'Cine', subcategory: 'Cine' },
      { id: 'b', category: 'Alimentación', amount: 5 },
      null,
    ]
    const { list: out, changed } = unifyRecords(list)
    expect(out).toHaveLength(3)
    expect(out[0]).toEqual({ id: 'a', category: 'Entretención', amount: 10, description: 'Cine', subcategory: 'Cine' })
    expect(out[1]).toBe(list[1])
    expect(changed.map(r => r.id)).toEqual(['a'])
    expect(list[0].category).toBe('Entretenimiento') // no muta la entrada
  })
})

describe('mergeBudgets', () => {
  it('con las dos grafías: un solo presupuesto canónico con la SUMA de los límites', () => {
    const list = [
      { id: 'b1', category: 'Entretenimiento', limit: 100 },
      { id: 'b2', category: 'Alimentación', limit: 300 },
      { id: 'b3', category: 'Entretención', limit: 50, rollover: true },
    ]
    const r = mergeBudgets(list)
    expect(r.deletes).toEqual(['b1'])
    expect(r.puts).toEqual([{ id: 'b3', category: 'Entretención', limit: 150, rollover: true }])
    expect(r.list).toEqual([{ id: 'b2', category: 'Alimentación', limit: 300 }, { id: 'b3', category: 'Entretención', limit: 150, rollover: true }])
    expect(r.list.filter(b => b.category === 'Entretención')).toHaveLength(1)
  })

  it('solo la grafía vieja: se renombra conservando id y límite', () => {
    const r = mergeBudgets([{ id: 'b1', category: 'Entretenimiento', limit: 80 }])
    expect(r.deletes).toEqual([])
    expect(r.list).toEqual([{ id: 'b1', category: 'Entretención', limit: 80 }])
  })

  it('sin grafía vieja no toca nada', () => {
    const list = [{ id: 'x', category: 'Entretención', limit: 1 }]
    const r = mergeBudgets(list)
    expect(r).toEqual({ list, puts: [], deletes: [] })
  })
})

describe('unifySettings', () => {
  it('listas sin duplicados, presupuestos sugeridos y reglas de comercio', () => {
    const s = {
      currency: 'COP',
      categoriesExpense: ['Vivienda', 'Entretenimiento', 'Entretención', 'Otro'],
      templateSuggestedBudgets: [{ category: 'Entretenimiento', pct: 10 }, { category: 'Vivienda', pct: 30 }],
      merchantRules: { netflix: 'Entretenimiento', exito: 'Alimentación' },
    }
    const n = unifySettings(s)
    expect(n.categoriesExpense).toEqual(['Vivienda', 'Entretención', 'Otro'])
    expect(n.templateSuggestedBudgets[0]).toEqual({ category: 'Entretención', pct: 10 })
    expect(n.merchantRules).toEqual({ netflix: 'Entretención', exito: 'Alimentación' })
    expect(n.currency).toBe('COP')
    expect(unifySettings(n)).toBeNull() // idempotente
  })
})

describe('plan y payload', () => {
  const data = {
    incomes: [{ id: 'i1', category: 'Salario', amount: 1 }],
    expenses: [{ id: 'e1', category: 'Entretenimiento', amount: 9 }, { id: 'e2', category: 'Entretención', amount: 4 }],
    budgets: [{ id: 'b1', category: 'Entretenimiento', limit: 20 }, { id: 'b2', category: 'Entretención', limit: 30 }],
    recurring: [{ id: 'r1', category: 'Entretenimiento', kind: 'expense' }],
    settings: { categoriesExpense: ['Entretenimiento'] },
  }

  it('el plan lista lo mínimo a escribir; sobre el resultado sale vacío', () => {
    const p = planCategoryUnification(data)
    expect(p.empty).toBe(false)
    expect(p.puts.expenses.map(r => r.id)).toEqual(['e1'])
    expect(p.puts.recurring.map(r => r.id)).toEqual(['r1'])
    expect(p.puts.budgets).toEqual([{ id: 'b2', category: 'Entretención', limit: 50 }])
    expect(p.deletes.budgets).toEqual(['b1'])
    expect(p.settings.categoriesExpense).toEqual(['Entretención'])
    expect(planCategoryUnification(unifyCategoryPayload(data)).empty).toBe(true)
    expect(planCategoryUnification({}).empty).toBe(true)
  })

  it('un respaldo viejo entra unificado, sin perder movimientos', () => {
    const out = unifyCategoryPayload({ ...data, debts: [{ id: 'd' }], version: '1.1' })
    expect(out.expenses).toHaveLength(2)
    expect(out.expenses.every(e => e.category === 'Entretención')).toBe(true)
    expect(out.budgets).toEqual([{ id: 'b2', category: 'Entretención', limit: 50 }])
    expect(out.debts).toEqual([{ id: 'd' }])
    expect(out.version).toBe('1.1')
    expect(unifyCategoryPayload(out)).toEqual(out)
  })
})
