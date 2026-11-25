// "Por revisar" (24-nov-2026) contra fake-indexeddb: el flag
// `needsReview` no necesita migración (ningún índice lo usa). Lo
// guardado antes de esta versión queda revisado, el flag viaja en el respaldo
// y el sync, y el registro automático de fijos lo pone en la base.
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

const { reviewQueue } = await import('../../utils/review.js')

const OLD_IMPORT = { id: 'old1', date: '2026-10-02', amount: 12, description: 'COMPRA 1', category: 'Importado', importBatchId: 'b0', source: 'csv' }
const OLD_AUTO = { id: 'rc-r0-2026-10-01', date: '2026-10-01', amount: 500, description: 'Arriendo', category: 'Vivienda', recurringId: 'r0', occurrenceDate: '2026-10-01' }

let db
beforeAll(async () => {
  db = await import('./index.js')
  await db.getDB()
})

describe('needsReview en la base', () => {
  it('ningún índice usa el campo nuevo: no pide migración', async () => {
    const conn = await db.getDB()
    for (const s of ['incomes', 'expenses']) {
      const store = conn.transaction(s).store
      expect(store.keyPath).toBe('id')
      expect([...store.indexNames]).not.toContain('needsReview')
    }
  })

  it('lo guardado antes (sin el flag) queda revisado: la bandeja no se llena al actualizar', async () => {
    await db.dbAdd('expenses', OLD_IMPORT)
    await db.dbAdd('expenses', OLD_AUTO)
    expect(reviewQueue({ expenses: await db.dbGetAll('expenses') })).toEqual([])
  })

  it('el registro automático de un fijo entra marcado; el confirmado a mano no', async () => {
    const rule = { id: 'r1', kind: 'expense', description: 'Gimnasio', category: 'Deporte', amount: 30, schedule: { freq: 'monthly', day: 5 }, autoConfirm: true }
    await db.confirmOccurrencesInDb([{ rule, date: '2026-11-05', review: true }], { today: '2026-11-24' })
    await db.confirmOccurrencesInDb([{ rule: { ...rule, id: 'r2' }, date: '2026-11-05' }], { today: '2026-11-24' })
    const q = reviewQueue({ expenses: await db.dbGetAll('expenses') })
    expect(q.map(r => r.rec.id)).toEqual(['rc-r1-2026-11-05'])
    expect(q[0].origin).toBe('recurring')
  })

  it('respaldo y sync: el flag sale y vuelve a entrar tal cual', async () => {
    const out = await db.exportAllData()
    expect(out.expenses.find(r => r.id === 'rc-r1-2026-11-05')).toMatchObject({ needsReview: true, origin: 'recurring' })
    await db.importAllData(JSON.parse(JSON.stringify(out)))
    const q = reviewQueue({ expenses: await db.dbGetAll('expenses') })
    expect(q.map(r => r.rec.id)).toEqual(['rc-r1-2026-11-05'])
  })
})
