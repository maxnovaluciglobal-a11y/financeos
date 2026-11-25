// Aplicar una regla a lo guardado: un fijo registrado solo sigue en Por
// revisar (solo cambia la categoría); "Deshacer" quita la regla creada.
import { describe, it, expect, vi } from 'vitest'

let stored = null
vi.mock('../../core/db/index.js', () => ({ getSettings: async () => stored }))
vi.mock('../../context/AppContext.jsx', () => ({ useApp: () => ({}) }))

const { applyRuleTo, saveCategoryRule } = await import('./RuleSheet.jsx')

describe('aplicar una regla a movimientos guardados', () => {
  it('un fijo registrado solo conserva needsReview; el resto queda revisado', () => {
    const fixed = { id: 'f', recurringId: 'r1', needsReview: true, category: 'Otros', categorySuggested: true }
    expect(applyRuleTo(fixed, 'Transporte')).toEqual({ id: 'f', recurringId: 'r1', needsReview: true, category: 'Transporte' })
    const imported = { id: 'i', importBatchId: 'b', needsReview: true, category: 'Importado' }
    expect(applyRuleTo(imported, 'Transporte')).toEqual({ id: 'i', importBatchId: 'b', category: 'Transporte' })
  })

  it('saveCategoryRule aplica a lo pendiente y su undo quita la regla con los ajustes de ahora', async () => {
    const writes = []
    const ctx = {
      settings: { currency: 'CLP', categoryRules: [] },
      expenses: [{ id: 'f', description: 'UBER TRIP', recurringId: 'r1', needsReview: true, category: 'Otros' }],
      incomes: [],
      updateSettings: async (s) => { writes.push(s); stored = s },
      updateExpense: async (rec) => writes.push(rec),
    }
    const r = await saveCategoryRule(ctx, { match: 'uber', category: 'Transporte', kind: 'expense' }, { applyPast: true })
    expect(r.changed).toBe(1)
    expect(writes[1]).toMatchObject({ id: 'f', category: 'Transporte', needsReview: true })
    stored = { ...stored, theme: 'dark' } // otro cambio después
    await r.undo()
    expect(stored.categoryRules).toEqual([])
    expect(stored.theme).toBe('dark')
  })

  it('al editar, un texto que choca con otra regla no guarda nada', async () => {
    const updateSettings = vi.fn()
    const ctx = { settings: { categoryRules: [{ id: 'a', match: 'uber', category: 'Transporte', kind: 'expense' }, { id: 'b', match: 'rappi', category: 'Delivery', kind: 'expense' }] }, updateSettings }
    const r = await saveCategoryRule(ctx, { id: 'b', match: 'Uber', category: 'Delivery', kind: 'expense' })
    expect(r.conflict.id).toBe('a')
    expect(updateSettings).not.toHaveBeenCalled()
  })
})
