// "Me deben" (D2) contra fake-indexeddb: la store `debts` no tiene esquema, así
// que el campo `direction` y el historial de cobros viajan en el respaldo y el
// sync sin migración; un respaldo viejo (sin `direction`) entra igual y sigue
// siendo "debo"; y un "me deben" nunca crea una regla de cuota.
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

const { MIGRATIONS } = await import('./migrations.js')
const { splitDebts } = await import('../../utils/debtDirection.js')

const CARD = { id: 'd1', creditor: 'Banco', debtType: 'Tarjeta', initial: 1000, balance: 800, minPayment: 100, rate: 0, dueDate: '2026-11-05' }
const OWED = {
  id: 'r1', direction: 'owed', creditor: 'Ana', debtType: 'Otro', initial: 300, balance: 200, minPayment: 0, rate: 0,
  dueDate: '2026-11-10', notes: 'viaje', collections: [{ id: 'c1', date: '2026-10-20', amount: 100 }],
}

let db
beforeAll(async () => {
  db = await import('./index.js')
  await db.getDB()
})

describe('"Me deben" en la base, el respaldo y el sync', () => {
  it('no hace falta migración: `debts` es una store sin índices, solo por id', async () => {
    // Si un paso nuevo agrega un índice a `debts`, este test obliga a revisar
    // que los registros "owed" (sin cuota ni tasa) sobrevivan a ese paso.
    const conn = await db.getDB()
    const store = conn.transaction('debts').store
    expect(store.keyPath).toBe('id')
    expect([...store.indexNames]).toEqual([])
    expect(MIGRATIONS.length).toBeGreaterThan(0)
  })

  it('exportAllData lleva `direction`, notas e historial de cobros tal cual', async () => {
    await db.dbAdd('debts', CARD)
    await db.dbAdd('debts', OWED)
    const out = await db.exportAllData()
    expect(out.debts.find(d => d.id === 'r1')).toEqual(OWED)
    expect(out.debts.find(d => d.id === 'd1')).toEqual(CARD)
  })

  it('el mismo payload vuelve a entrar idéntico (respaldo JSON y blob del sync)', async () => {
    const out = await db.exportAllData()
    await db.importAllData(JSON.parse(JSON.stringify(out)))
    const back = await db.dbGetAll('debts')
    expect(back.find(d => d.id === 'r1')).toEqual(OWED)
    const { owe, owed } = splitDebts(back)
    expect(owe.map(d => d.id)).toEqual(['d1'])
    expect(owed.map(d => d.id)).toEqual(['r1'])
  })

  it('un respaldo viejo sin `direction` entra sin cambios y es todo "debo"', async () => {
    const old = { id: 'd9', creditor: 'Auto', debtType: 'Auto', initial: 5000, balance: 4000, minPayment: 200, rate: 12 }
    await db.importAllData({ incomes: [], expenses: [], budgets: [], debts: [old], goals: [], subscriptions: [], settings: null, version: '1.1' })
    const back = await db.dbGetAll('debts')
    expect(back).toEqual([old])
    expect(splitDebts(back).owed).toEqual([])
  })

  it('reconcileRecurringSources no crea regla para un "me deben"', async () => {
    await db.importAllData({ incomes: [], expenses: [], budgets: [], debts: [CARD, { ...OWED, minPayment: 50 }], goals: [], subscriptions: [], recurring: [], settings: null })
    await db.reconcileRecurringSources({ today: '2026-10-30', now: '2026-10-30T00:00:00Z' })
    const rules = await db.dbGetAll('recurring')
    expect(rules.map(r => r.id)).toEqual(['rd-d1'])
  })
})
