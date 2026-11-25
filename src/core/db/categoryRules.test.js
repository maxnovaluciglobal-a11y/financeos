// Reglas de categoría y píldoras (24-nov-2026) contra fake-indexeddb: viven en
// settings, no piden migración, viajan en el respaldo y el sync, y un respaldo
// viejo (sin los campos) entra sin reglas ni preferencias, sin romper nada.
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeAll } from 'vitest'

const mem = new Map()
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)) },
  removeItem: (k) => { mem.delete(k) },
  key: (i) => [...mem.keys()][i] ?? null,
  get length() { return mem.size },
  clear: () => mem.clear(),
}

const { rulesOf, upsertRule } = await import('../../utils/categoryRules.js')
const { prefsOf, lookPatch } = await import('../../utils/categoryPrefs.js')

let db
beforeAll(async () => {
  db = await import('./index.js')
  await db.getDB()
})

describe('categoryRules y categoryPrefs en settings', () => {
  it('respaldo y sync: las reglas y las píldoras salen y vuelven a entrar', async () => {
    const base = await db.getSettings()
    const { rules } = upsertRule([], { match: 'Uber', category: 'Transporte', kind: 'expense' }, { now: '2026-11-24T00:00:00.000Z' })
    const { categoryPrefs } = lookPatch({ categoryPrefs: { hidden: { expense: ['Ropa'] } } }, 'Alimentación', { emoji: '🥑', slot: 3 })
    await db.saveSettings({ ...base, categoryRules: rules, categoryPrefs })
    const out = await db.exportAllData()
    expect(rulesOf(out.settings)).toHaveLength(1)
    expect(prefsOf(out.settings).hidden.expense).toEqual(['Ropa'])
    await db.saveSettings({ ...base })
    await db.importAllData(JSON.parse(JSON.stringify(out)))
    const back = await db.getSettings()
    expect(rulesOf(back)[0]).toMatchObject({ match: 'uber', category: 'Transporte', kind: 'expense' })
    expect(prefsOf(back).look['Alimentación']).toEqual({ emoji: '🥑', slot: 3 })
  })

  it('un respaldo anterior (sin los campos) entra sin reglas ni preferencias', async () => {
    const out = await db.exportAllData()
    delete out.settings.categoryRules
    delete out.settings.categoryPrefs
    await db.importAllData(JSON.parse(JSON.stringify(out)))
    const back = await db.getSettings()
    expect(rulesOf(back)).toEqual([])
    expect(prefsOf(back)).toEqual({ hidden: { expense: [], income: [] }, look: {} })
  })

  it('una regla guardada con la grafía vieja de la categoría se lee con la canónica', async () => {
    const base = await db.getSettings()
    await db.saveSettings({ ...base, categoryRules: [{ id: 'x', match: 'netflix', category: 'Entretenimiento', kind: 'expense' }] })
    expect(rulesOf(await db.getSettings())[0].category).toBe('Entretención')
  })
})
