import { describe, it, expect } from 'vitest'
import {
  needsReview, reviewQueue, markReviewed, withReview, importNeedsReview, quickAddNeedsReview,
  reviewOrigin, isUncategorized, seedDemoReview,
} from './review.js'
import { planConfirmations } from './recurringConfirm.js'
import { buildDemoState, DEMO_PERSONAS } from '../demo/demoData.js'
import { M0 } from '../demo/demoDates.js'

describe('Por revisar: lo guardado antes queda revisado (sin migración)', () => {
  it('un movimiento sin el flag no entra a la bandeja, aunque no tenga categoría', () => {
    const legacy = [
      { id: 'a', date: '2026-10-01', amount: 10, category: 'Importado', importBatchId: 'b1', source: 'csv' },
      { id: 'b', date: '2026-10-02', amount: 10, category: '', recurringId: 'r1' },
      { id: 'c', date: '2026-10-03', amount: 10, category: 'Alimentación' },
    ]
    expect(legacy.some(needsReview)).toBe(false)
    expect(reviewQueue({ expenses: legacy })).toEqual([])
  })
  it('solo `needsReview: true` cuenta (un string o 1 de un respaldo raro no)', () => {
    expect(needsReview({ needsReview: true })).toBe(true)
    expect(needsReview({ needsReview: 'true' })).toBe(false)
    expect(needsReview({ needsReview: 1 })).toBe(false)
    expect(needsReview(null)).toBe(false)
  })
  it('un apartado nunca entra a la bandeja', () => {
    expect(needsReview({ kind: 'setAside', needsReview: true })).toBe(false)
  })
})

describe('reviewQueue', () => {
  const expenses = [
    withReview({ id: 'e1', date: '2026-11-03', amount: 5, description: 'Lider', category: 'Alimentación' }, 'applepay'),
    withReview({ id: 'e2', date: '2026-11-10', amount: 9, description: 'COMPRA 123', category: 'Importado', importBatchId: 'b' }, 'import'),
    { id: 'e3', date: '2026-11-11', amount: 1, description: 'Ya visto', category: 'Otros' },
  ]
  const incomes = [withReview({ id: 'i1', date: '2026-11-05', amount: 100, source: 'Sueldo', category: 'Salario', recurringId: 'r' }, 'recurring')]
  it('junta ingresos y gastos, del más nuevo al más viejo, con origen y nombre', () => {
    const q = reviewQueue({ incomes, expenses })
    expect(q.map(r => r.key)).toEqual(['e-e2', 'i-i1', 'e-e1'])
    expect(q[0]).toMatchObject({ kind: 'expense', origin: 'import', uncategorized: true, name: 'COMPRA 123' })
    expect(q[1]).toMatchObject({ kind: 'income', origin: 'recurring', name: 'Sueldo' })
  })
  it('un ingreso importado muestra la descripción, no "csv"', () => {
    const q = reviewQueue({ incomes: [withReview({ id: 'x', date: '2026-11-01', source: 'csv', description: 'TRANSF RECIBIDA' }, 'import')] })
    expect(q[0].name).toBe('TRANSF RECIBIDA')
  })
  it('confirmar quita el flag y conserva el origen; cambiar categoría también quita "sugerida"', () => {
    const r = markReviewed({ ...expenses[1], categorySuggested: true }, { category: 'Transporte' })
    expect(r.needsReview).toBeUndefined()
    expect(r.categorySuggested).toBeUndefined()
    expect(r.category).toBe('Transporte')
    expect(r.origin).toBe('import')
    expect(reviewQueue({ expenses: [r] })).toEqual([])
  })
  it('reviewOrigin sin etiqueta: importado o fijo por sus campos', () => {
    expect(reviewOrigin({ importBatchId: 'b' })).toBe('import')
    expect(reviewOrigin({ recurringId: 'r' })).toBe('recurring')
    expect(reviewOrigin({ origin: 'voice' })).toBe('voice')
  })
})

describe('quién marca "por revisar"', () => {
  it('importación: solo filas con categoría sugerida o sin categoría', () => {
    expect(importNeedsReview({ category: 'Alimentación', categorySuggested: true })).toBe(true)
    expect(importNeedsReview({ category: 'Importado' })).toBe(true)
    expect(importNeedsReview({ category: '' })).toBe(true)
    expect(importNeedsReview({ category: 'Vivienda' })).toBe(false)
    expect(isUncategorized({ category: 'Importado' })).toBe(true)
  })
  it('alta rápida: de afuera (Apple Pay, enlace, dictado) y sin categoría elegida a mano', () => {
    expect(quickAddNeedsReview({ origin: 'applepay', categoryChosen: false })).toBe(true)
    expect(quickAddNeedsReview({ origin: 'voice', categoryChosen: true })).toBe(false)
    expect(quickAddNeedsReview({ origin: null, categoryChosen: false })).toBe(false)
  })
  it('withReview sin needs solo deja el origen', () => {
    expect(withReview({ id: 1, needsReview: true }, 'import', { needs: false })).toEqual({ id: 1, origin: 'import' })
  })
  it('fijo con registro automático: entra a la bandeja; confirmado a mano, no', () => {
    const rule = { id: 'r1', kind: 'expense', description: 'Arriendo', category: 'Vivienda', amount: 500, schedule: { freq: 'monthly', day: 1 } }
    const [auto] = planConfirmations([{ rule, date: '2026-11-01', amount: 500, review: true }], [], new Map(), { today: '2026-11-24', now: 'x' })
    const [hand] = planConfirmations([{ rule, date: '2026-11-01', amount: 500 }], [], new Map(), { today: '2026-11-24', now: 'x' })
    expect(auto.record).toMatchObject({ needsReview: true, origin: 'recurring', id: 'rc-r1-2026-11-01' })
    expect(hand.record.needsReview).toBeUndefined()
  })
})

describe('demo: unos pocos por revisar en cada persona', () => {
  it('seedDemoReview marca hasta 3 del mes sin tocar montos ni fechas', () => {
    const rows = [
      { id: 'a', date: `${M0}-01`, amount: 10, recurrence: 'Mensual' },
      { id: 'b', date: `${M0}-02`, amount: 20, recurrence: 'Único' },
      { id: 'c', date: `${M0}-03`, amount: 30, recurrence: 'Único' },
      { id: 'd', date: '2000-01-01', amount: 40, recurrence: 'Único' },
    ]
    const out = seedDemoReview(rows, M0)
    expect(out.map(r => r.amount)).toEqual([10, 20, 30, 40])
    expect(out.map(r => r.date)).toEqual(rows.map(r => r.date))
    expect(Object.fromEntries(out.filter(needsReview).map(r => [r.id, r.origin]))).toEqual({ a: 'recurring', c: 'applepay', b: 'import' })
  })
  it.each(Object.keys(DEMO_PERSONAS))('persona %s: la bandeja tiene algo y como mucho 3', (id) => {
    const st = buildDemoState(id, 'es', 'exitoso')
    const n = reviewQueue(st).length
    // El día 1 del mes puede haber un solo gasto registrado.
    expect(n).toBeGreaterThanOrEqual(st.expenses.some(r => r.date?.startsWith(M0)) ? 1 : 0)
    expect(n).toBeLessThanOrEqual(3)
  })
})

