import { describe, it, expect } from 'vitest'
import {
  normalizeText, suggestMatch, sanitizeRules, ruleMatches, findRule, upsertRule, undoUpsert, removeRule,
  matchingRecords, categoryByRule, applyRulesToImportRows, rulesOf, RULE_MIN_LENGTH,
} from './categoryRules.js'
import { importNeedsReview } from './review.js'

const NOW = '2026-11-24T10:00:00.000Z'

describe('normalizeText y suggestMatch', () => {
  it('sin acentos, minúsculas, sin signos', () => {
    expect(normalizeText('  UBER *Trip  Ñandú ')).toBe('uber trip nandu')
  })
  it('sugiere la primera palabra del comercio, sin palabras de cartola ni números', () => {
    expect(suggestMatch('COMPRA UBER *TRIP 1234')).toBe('uber')
    expect(suggestMatch('PAGO 9988 Rappi')).toBe('rappi')
    expect(suggestMatch('12 34')).toBe('')
  })
})

describe('sanitizeRules (compatibilidad hacia atrás)', () => {
  it('sin reglas o con basura → lista vacía, nunca lanza', () => {
    expect(sanitizeRules(undefined)).toEqual([])
    expect(sanitizeRules({ a: 1 })).toEqual([])
    expect(sanitizeRules([null, 3, { match: 'ub', category: 'X' }, { match: 'uber' }])).toEqual([])
    expect(rulesOf({})).toEqual([])
  })
  it('normaliza, completa el tipo y aplica el alias de categorías', () => {
    const [r] = sanitizeRules([{ match: 'Netflix', category: 'Entretenimiento' }])
    expect(r).toMatchObject({ match: 'netflix', category: 'Entretención', kind: 'any' })
    expect(r.id).toBeTruthy()
  })
  it('mismo texto y tipo: gana la más nueva', () => {
    const out = sanitizeRules([
      { id: 'a', match: 'uber', category: 'Transporte', kind: 'expense', createdAt: '2026-01-01' },
      { id: 'b', match: 'UBER', category: 'Delivery', kind: 'expense', createdAt: '2026-02-01' },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].category).toBe('Delivery')
  })
})

describe('ruleMatches / findRule', () => {
  const rules = sanitizeRules([
    { id: '1', match: 'uber', category: 'Transporte', kind: 'expense', createdAt: '2026-01-01' },
    { id: '2', match: 'uber eats', category: 'Comida', kind: 'expense', createdAt: '2026-01-01' },
    { id: '3', match: 'sueldo', category: 'Salario', kind: 'income', createdAt: '2026-01-01' },
  ])
  it('coincide por comienzo de palabra, no dentro de otra palabra', () => {
    expect(ruleMatches(rules[0], 'UBER *TRIP')).toBe(true)
    expect(ruleMatches(rules[0], 'Superuber')).toBe(false)
    expect(ruleMatches(rules[0], 'Ubérrimo')).toBe(true) // prefijo de palabra: "contiene" al inicio de una palabra
  })
  it('gana la más específica', () => {
    expect(findRule('Uber Eats pedido', rules, { kind: 'expense' }).category).toBe('Comida')
    expect(findRule('Uber viaje', rules, { kind: 'expense' }).category).toBe('Transporte')
  })
  it('respeta el tipo y las categorías permitidas', () => {
    expect(findRule('sueldo noviembre', rules, { kind: 'expense' })).toBeNull()
    expect(findRule('sueldo noviembre', rules, { kind: 'income' }).category).toBe('Salario')
    expect(findRule('uber', rules, { kind: 'expense', allowed: ['Comida'] })).toBeNull()
  })
  it(`menos de ${RULE_MIN_LENGTH} letras nunca coincide`, () => {
    expect(ruleMatches({ match: 'ub' }, 'uber')).toBe(false)
  })
})

describe('upsertRule / removeRule', () => {
  it('crea, reemplaza el mismo texto y tipo, y borra', () => {
    const a = upsertRule([], { match: 'Uber', category: 'Transporte', kind: 'expense' }, { now: NOW })
    expect(a.rules).toHaveLength(1)
    const b = upsertRule(a.rules, { match: 'uber', category: 'Delivery', kind: 'expense' }, { now: NOW })
    expect(b.rules).toHaveLength(1)
    expect(b.rules[0]).toMatchObject({ id: a.rule.id, category: 'Delivery' })
    const c = upsertRule(b.rules, { id: a.rule.id, match: 'uber trip', category: 'Transporte', kind: 'expense' }, { now: NOW })
    expect(c.rules).toHaveLength(1)
    expect(c.rules[0].match).toBe('uber trip')
    expect(removeRule(c.rules, a.rule.id)).toEqual([])
  })
  it('editar: busca por id y, si el texto choca con OTRA regla, no borra ninguna', () => {
    const a = upsertRule([], { match: 'Uber', category: 'Transporte', kind: 'expense' }, { now: NOW, id: 'a' })
    const b = upsertRule(a.rules, { match: 'Rappi', category: 'Delivery', kind: 'expense' }, { now: NOW, id: 'b' })
    const clash = upsertRule(b.rules, { id: 'b', match: 'uber', category: 'Delivery', kind: 'expense' }, { now: NOW })
    expect(clash.conflict).toMatchObject({ id: 'a', match: 'uber' })
    expect(clash.rules).toBeUndefined()
    // Otro tipo no choca.
    expect(upsertRule(b.rules, { id: 'b', match: 'uber', category: 'Salario', kind: 'income' }, { now: NOW }).rules).toHaveLength(2)
  })
  it('undoUpsert quita la regla nueva o devuelve la que reemplazó', () => {
    const a = upsertRule([], { match: 'Uber', category: 'Transporte', kind: 'expense' }, { now: NOW, id: 'a' })
    const c = upsertRule(a.rules, { match: 'Cine', category: 'Ocio', kind: 'expense' }, { now: NOW, id: 'c' })
    expect(undoUpsert(c.rules, c).map(r => r.id)).toEqual(['a'])
    const b = upsertRule(c.rules, { match: 'uber', category: 'Delivery', kind: 'expense' }, { now: NOW })
    expect(undoUpsert(b.rules, b).find(r => r.id === 'a').category).toBe('Transporte')
  })
  it('texto corto o sin categoría → null', () => {
    expect(upsertRule([], { match: 'ab', category: 'X' })).toBeNull()
    expect(upsertRule([], { match: 'abcd', category: '' })).toBeNull()
  })
})

describe('matchingRecords', () => {
  const rule = sanitizeRules([{ match: 'rappi', category: 'Comida', kind: 'expense' }])[0]
  const data = {
    expenses: [
      { id: 'e1', description: 'RAPPI*COL', category: 'Importado' },
      { id: 'e2', description: 'Rappi almuerzo', category: 'Comida' },
      { id: 'e3', description: 'Rappi', category: 'Otros', inv: true },
      { id: 'e4', description: 'Rappi', category: '', kind: 'setAside' },
      { id: 'e5', description: 'Cine', category: 'Importado' },
    ],
    incomes: [{ id: 'i1', source: 'Rappi reembolso', category: 'Otro' }],
  }
  it('solo gastos que coinciden, no los que ya tienen la categoría, ni inversión ni apartados', () => {
    expect(matchingRecords(rule, data).map(x => x.rec.id)).toEqual(['e1'])
  })
  it('isOpen filtra (p. ej. solo sin categoría)', () => {
    expect(matchingRecords(rule, data, { isOpen: () => false })).toEqual([])
  })
})

describe('categoryByRule e importación', () => {
  const settings = { categoryRules: [{ match: 'uber', category: 'Transporte', kind: 'expense' }] }
  it('devuelve la categoría y la regla', () => {
    expect(categoryByRule('UBER *TRIP', settings, { kind: 'expense' }).category).toBe('Transporte')
    expect(categoryByRule('Cine', settings, { kind: 'expense' })).toBeNull()
  })
  it('filas sugeridas o sin categoría toman la regla y dejan de pedir revisión por la categoría', () => {
    const rows = [
      { description: 'UBER TRIP', type: 'expense', category: 'Otros', categorySuggested: true },
      { description: 'UBER TRIP', type: 'expense' },
      { description: 'UBER TRIP', type: 'expense', category: 'Viajes' }, // categoría del archivo: no se toca
      { description: 'Cine', type: 'expense' },
    ]
    const out = applyRulesToImportRows(rows, settings.categoryRules)
    expect(out[0]).toMatchObject({ category: 'Transporte', categorySuggested: false, categoryByRule: true })
    expect(out[1].category).toBe('Transporte')
    expect(out[2].category).toBe('Viajes')
    expect(out[3]).toBe(rows[3])
    expect(out.map(importNeedsReview)).toEqual([false, false, false, true])
  })
  it('sin reglas devuelve las mismas filas', () => {
    const rows = [{ description: 'x' }]
    expect(applyRulesToImportRows(rows, [])).toBe(rows)
  })
})
