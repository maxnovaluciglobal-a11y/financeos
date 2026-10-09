// Migración v5 (unificación "Entretenimiento" → "Entretención") contra
// fake-indexeddb: foto previa, sin pérdida de datos, sin duplicados,
// presupuestos fusionados, re-ejecutar no cambia nada y un respaldo viejo
// importado entra unificado.
import 'fake-indexeddb/auto'
import { openDB } from 'idb'
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

const { MIGRATIONS, DB_VERSION, PRE_CATEGORY_UNIFY_SNAPSHOT_ID, PRE_RECURRING_SNAPSHOT_ID, runMigrationSteps } = await import('./migrations.js')

const EXPENSES = [
  { id: 'e1', date: '2026-10-02', description: 'Cine', amount: 12, category: 'Entretenimiento', subcategory: 'Cine' },
  { id: 'e2', date: '2026-10-03', description: 'Netflix', amount: 9, category: 'Entretención' },
  { id: 'e3', date: '2026-10-04', description: 'Super', amount: 80, category: 'Alimentación' },
]
const INCOMES = [{ id: 'i1', date: '2026-10-01', source: 'Sueldo', amount: 2000, category: 'Salario' }]
const BUDGETS = [
  { id: 'b1', category: 'Entretenimiento', limit: 100 },
  { id: 'b2', category: 'Entretención', limit: 40 },
  { id: 'b3', category: 'Alimentación', limit: 300 },
]
const RECURRING = [{ id: 'r1', kind: 'expense', description: 'Cine club', category: 'Entretenimiento', amounts: [{ from: '2026-10', amount: 10 }], schedule: { freq: 'monthly', day: 5 } }]
const GOALS = [{ id: 'g1', name: 'Viaje', target: 1000 }]
const SETTINGS = {
  language: 'es', currency: 'COP', activeTemplateId: 'freelancer',
  categoriesExpense: ['Vivienda', 'Alimentación', 'Entretenimiento', 'Otro'],
  templateSuggestedBudgets: [{ category: 'Entretenimiento', pct: 10 }],
  merchantRules: { cinemark: 'Entretenimiento' },
}

// Base existente en v4 con datos de la plantilla vieja.
async function seedV4() {
  const v4 = await openDB('financeos', 4, {
    upgrade: (db, o, n, tx) => runMigrationSteps(db, o, n, tx, MIGRATIONS.filter(m => m.version <= 4)),
  })
  for (const r of EXPENSES) await v4.put('expenses', r)
  for (const r of INCOMES) await v4.put('incomes', r)
  for (const r of BUDGETS) await v4.put('budgets', r)
  for (const r of RECURRING) await v4.put('recurring', r)
  for (const r of GOALS) await v4.put('goals', r)
  await v4.put('settings', SETTINGS, 'main')
  await v4.put('security', { hash: 'pin-hash' }, 'pin')
  v4.close()
}

let db, conn
beforeAll(async () => {
  await seedV4()
  db = await import('./index.js')
  conn = await db.getDB()
})

describe('migración v5 · categorías unificadas', () => {
  it('es un paso nuevo después de v4', () => {
    expect(MIGRATIONS.map(m => m.version)).toEqual([1, 2, 3, 4, 5])
    expect(DB_VERSION).toBe(5)
    expect(conn.version).toBe(5)
  })

  it('gastos y reglas renombrados, sin perder registros ni campos', async () => {
    const exp = await conn.getAll('expenses')
    expect(exp).toHaveLength(EXPENSES.length)
    expect(exp.find(e => e.id === 'e1')).toEqual({ ...EXPENSES[0], category: 'Entretención' })
    expect(exp.find(e => e.id === 'e3')).toEqual(EXPENSES[2])
    expect(exp.some(e => e.category === 'Entretenimiento')).toBe(false)
    expect(await conn.getAll('incomes')).toEqual(INCOMES)
    expect(await conn.getAll('goals')).toEqual(GOALS)
    const rec = await conn.getAll('recurring')
    expect(rec).toEqual([{ ...RECURRING[0], category: 'Entretención' }])
  })

  it('presupuestos: uno solo por categoría, con la suma de los límites', async () => {
    const bud = await conn.getAll('budgets')
    expect(bud).toHaveLength(2)
    expect(bud.find(b => b.category === 'Entretención')).toEqual({ id: 'b2', category: 'Entretención', limit: 140 })
    expect(bud.find(b => b.id === 'b3')).toEqual(BUDGETS[2])
  })

  it('ajustes: listas, presupuestos sugeridos y reglas de comercio', async () => {
    const s = await conn.get('settings', 'main')
    expect(s.categoriesExpense).toEqual(['Vivienda', 'Alimentación', 'Entretención', 'Otro'])
    expect(s.templateSuggestedBudgets).toEqual([{ category: 'Entretención', pct: 10 }])
    expect(s.merchantRules).toEqual({ cinemark: 'Entretención' })
    expect(s.currency).toBe('COP')
    expect(await conn.get('security', 'pin')).toEqual({ hash: 'pin-hash' })
  })

  it('deja una foto previa completa (sin el PIN) y no toca la de v4', async () => {
    const snap = await conn.get('backups', PRE_CATEGORY_UNIFY_SNAPSHOT_ID)
    expect(snap.fromVersion).toBe(4)
    expect(snap.reason).toBe('pre-category-unify')
    expect(snap.data.expenses).toEqual(EXPENSES)
    expect(snap.data.budgets).toEqual(BUDGETS)
    expect(snap.data.recurring).toEqual(RECURRING)
    expect(snap.data.settings).toMatchObject({ merchantRules: { cinemark: 'Entretenimiento' } })
    expect(JSON.stringify(snap)).not.toContain('pin-hash')
    expect(await conn.get('backups', PRE_RECURRING_SNAPSHOT_ID)).toBeUndefined() // la base nació en v4: sin foto v4
  })

  it('re-ejecutar el paso sobre datos ya unificados no cambia nada', async () => {
    const before = {
      expenses: await conn.getAll('expenses'), budgets: await conn.getAll('budgets'),
      recurring: await conn.getAll('recurring'), settings: await conn.get('settings', 'main'),
    }
    const step = MIGRATIONS.find(m => m.version === 5)
    await conn.delete('backups', PRE_CATEGORY_UNIFY_SNAPSHOT_ID)
    const tx = conn.transaction(['incomes', 'expenses', 'budgets', 'debts', 'goals', 'subscriptions', 'importBatches', 'recurring', 'settings', 'backups'], 'readwrite')
    await step.migrate(conn, tx, 4)
    await tx.done
    expect(await conn.getAll('expenses')).toEqual(before.expenses)
    expect(await conn.getAll('budgets')).toEqual(before.budgets)
    expect(await conn.getAll('recurring')).toEqual(before.recurring)
    expect(await conn.get('settings', 'main')).toEqual(before.settings)
    expect(await conn.get('backups', PRE_CATEGORY_UNIFY_SNAPSHOT_ID)).toBeUndefined() // nada que cambiar → sin foto
  })

  it('importar un respaldo viejo con "Entretenimiento" lo unifica y fusiona presupuestos', async () => {
    await db.importAllData({
      incomes: [], expenses: [{ id: 'x1', category: 'Entretenimiento', amount: 3, date: '2026-09-01' }],
      budgets: [{ id: 'y1', category: 'Entretenimiento', limit: 10 }, { id: 'y2', category: 'Entretención', limit: 5 }],
      debts: [], goals: [], subscriptions: [],
      settings: { categoriesExpense: ['Entretenimiento'], merchantRules: { cine: 'Entretenimiento' } },
      version: '1.1',
    })
    expect(await conn.getAll('expenses')).toEqual([{ id: 'x1', category: 'Entretención', amount: 3, date: '2026-09-01' }])
    expect(await conn.getAll('budgets')).toEqual([{ id: 'y2', category: 'Entretención', limit: 15 }])
    const s = await conn.get('settings', 'main')
    expect(s.categoriesExpense).toEqual(['Entretención'])
    expect(s.merchantRules).toEqual({ cine: 'Entretención' })
  })
})
