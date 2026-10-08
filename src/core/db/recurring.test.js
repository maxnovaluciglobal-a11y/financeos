// Migración v4 (movimientos fijos) y unificación de Suscripciones/Deudas,
// contra fake-indexeddb: foto previa, sin pérdida de datos, sin duplicados,
// re-ejecutar no cambia nada, confirmar es idempotente, respaldo ida y vuelta.
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

const { MIGRATIONS, DB_VERSION, PRE_RECURRING_SNAPSHOT_ID, runMigrationSteps } = await import('./migrations.js')

const SUBS = [
  { id: 's1', name: 'Netflix', category: 'Streaming', amount: 15.49, frequency: 'monthly', nextPaymentDate: '2026-10-11', status: 'active' },
  { id: 's2', name: 'Gym', category: 'Gimnasio', amount: 35, frequency: 'monthly', nextPaymentDate: '2026-10-05', status: 'active' },
]
const DEBTS = [
  { id: 'd1', creditor: 'Tarjeta Visa', balance: 1000, initial: 1500, minPayment: 100, dueDate: '2026-10-20', rate: 12, paidInstallments: 2 },
]
const INCOMES = [{ id: 'i1', date: '2026-10-01', source: 'Sueldo', amount: 2000, category: 'Salario', recurrence: 'Mensual' }]
const EXPENSES = [{ id: 'e1', date: '2026-10-02', description: 'Super', amount: 80, category: 'Alimentación' }]

// Base existente en v3 (antes de los fijos), con datos reales y un PIN.
async function seedV3() {
  const v3 = await openDB('financeos', 3, {
    upgrade: (db, oldV, newV, tx) => runMigrationSteps(db, oldV, newV, tx, MIGRATIONS.filter(m => m.version <= 3)),
  })
  for (const r of INCOMES) await v3.put('incomes', r)
  for (const r of EXPENSES) await v3.put('expenses', r)
  for (const r of SUBS) await v3.put('subscriptions', r)
  for (const r of DEBTS) await v3.put('debts', r)
  await v3.put('settings', { language: 'es', currency: 'CLP', activeMonth: '2026-10' }, 'main')
  await v3.put('security', { hash: 'pin-hash' }, 'pin')
  v3.close()
}

let db
beforeAll(async () => {
  await seedV3()
  db = await import('./index.js')
})

describe('migración v4', () => {
  it('es un paso nuevo, sin tocar los anteriores', () => {
    expect(MIGRATIONS.map(m => m.version)).toEqual([1, 2, 3, 4])
    expect(DB_VERSION).toBe(4)
  })

  it('crea recurring y backups, y deja una foto completa previa (sin el PIN)', async () => {
    const conn = await db.getDB()
    expect(conn.version).toBe(4)
    expect(conn.objectStoreNames.contains('recurring')).toBe(true)
    expect(conn.objectStoreNames.contains('backups')).toBe(true)
    const snap = await conn.get('backups', PRE_RECURRING_SNAPSHOT_ID)
    expect(snap.fromVersion).toBe(3)
    expect(snap.data.subscriptions).toEqual(SUBS)
    expect(snap.data.debts).toEqual(DEBTS)
    expect(snap.data.incomes).toEqual(INCOMES)
    expect(snap.data.expenses).toEqual(EXPENSES)
    expect(snap.data.settings).toMatchObject({ currency: 'CLP' })
    expect(JSON.stringify(snap)).not.toContain('pin-hash')
    // los datos originales siguen ahí, iguales
    expect(await conn.getAll('subscriptions')).toEqual(SUBS)
    expect(await conn.getAll('debts')).toEqual(DEBTS)
    expect(await conn.get('security', 'pin')).toEqual({ hash: 'pin-hash' })
  })

  it('si el paso async falla, la base queda en la versión vieja con sus datos', async () => {
    const name = 'abort-test'
    const v1 = await openDB(name, 1, { upgrade(d) { d.createObjectStore('a', { keyPath: 'id' }) } })
    await v1.put('a', { id: 'x', v: 1 })
    v1.close()
    const steps = [
      { version: 1, migrate() {} },
      { version: 2, async migrate(d, tx) {
        d.createObjectStore('b', { keyPath: 'id' })
        await tx.objectStore('a').getAll()
        await tx.objectStore('b').put({ id: 'y' })
        throw new Error('rota a propósito')
      } },
    ]
    await expect(openDB(name, 2, { upgrade: (d, o, n, tx) => runMigrationSteps(d, o, n, tx, steps) })).rejects.toThrow()
    const again = await openDB(name, 1)
    expect(again.version).toBe(1)
    expect(again.objectStoreNames.contains('b')).toBe(false)
    expect(await again.get('a', 'x')).toEqual({ id: 'x', v: 1 })
    again.close()
  })
})

describe('unificación (reconcileRecurringSources)', () => {
  it('crea una regla por suscripción y por deuda, enlazadas por sourceId', async () => {
    const created = await db.reconcileRecurringSources({ today: '2026-10-08', now: 'T' })
    expect(created.map(r => r.id).sort()).toEqual(['rd-d1', 'rs-s1', 'rs-s2'])
    const rules = await db.dbGetAll('recurring')
    expect(rules).toHaveLength(3)
    expect(rules.find(r => r.id === 'rd-d1')).toMatchObject({ source: 'debt', sourceId: 'd1', category: 'Deudas' })
  })

  it('re-ejecutar es un no-op: sin escrituras ni duplicados, originales intactos', async () => {
    const again = await db.reconcileRecurringSources({ today: '2026-10-08', now: 'T2' })
    expect(again).toEqual([])
    expect(await db.dbGetAll('recurring')).toHaveLength(3)
    expect(await db.dbGetAll('subscriptions')).toEqual(SUBS)
    expect(await db.dbGetAll('debts')).toEqual(DEBTS)
    expect(await db.dbGetAll('incomes')).toEqual(INCOMES)
    expect(await db.dbGetAll('expenses')).toEqual(EXPENSES)
  })
})

describe('confirmar ocurrencias', () => {
  it('confirmar la cuota de una deuda crea el gasto y baja el saldo una sola vez', async () => {
    const rule = (await db.dbGetAll('recurring')).find(r => r.id === 'rd-d1')
    const item = { rule, date: '2026-10-20' }
    // dos confirmaciones a la vez (doble toque / dos pestañas)
    const [a, b] = await Promise.all([
      db.confirmOccurrencesInDb([item], { today: '2026-10-21', now: 'N' }),
      db.confirmOccurrencesInDb([item], { today: '2026-10-21', now: 'N' }),
    ])
    expect(a.records.length + b.records.length).toBe(1)
    const exp = (await db.dbGetAll('expenses')).filter(e => e.recurringId === 'rd-d1')
    expect(exp).toHaveLength(1)
    expect(exp[0]).toMatchObject({ amount: 100, category: 'Deudas', occurrenceDate: '2026-10-20', date: '2026-10-20' })
    const debt = (await db.dbGetAll('debts'))[0]
    // 1000 + 1 % de interés mensual − 100
    expect(debt.balance).toBeCloseTo(910)
    expect(debt.paidInstallments).toBe(3)
    // y una tercera vez, más tarde, tampoco duplica
    const c = await db.confirmOccurrencesInDb([item], { today: '2026-10-25' })
    expect(c.records).toEqual([])
    expect((await db.dbGetAll('debts'))[0].balance).toBeCloseTo(910)
  })

  it('"Confirmar todos" con monto "solo este mes"', async () => {
    const rules = await db.dbGetAll('recurring')
    const nf = rules.find(r => r.id === 'rs-s1'), gym = rules.find(r => r.id === 'rs-s2')
    const res = await db.confirmOccurrencesInDb([{ rule: nf, date: '2026-10-11', amount: 16.99 }, { rule: gym, date: '2026-10-05' }], { today: '2026-10-12' })
    expect(res.records.map(r => r.amount).sort()).toEqual([16.99, 35])
    expect(res.records.find(r => r.recurringId === 'rs-s1').category).toBe('Entretención')
  })
})

describe('respaldo y sync incluyen los fijos', () => {
  it('export → import ida y vuelta conserva reglas y vínculos; sin security ni backups', async () => {
    const payload = await db.exportAllData()
    expect(payload.recurring).toHaveLength(3)
    expect(payload).not.toHaveProperty('backups')
    expect(payload).not.toHaveProperty('security')
    expect(JSON.stringify(payload)).not.toContain('pin-hash')
    const json = JSON.parse(JSON.stringify(payload))
    await db.clearAllData()
    expect(await db.dbGetAll('recurring')).toEqual([])
    await db.importAllData(json)
    expect(await db.dbGetAll('recurring')).toEqual(payload.recurring)
    expect((await db.dbGetAll('expenses')).filter(e => e.recurringId)).toHaveLength(3)
  })

  it('un respaldo viejo (sin recurring) no borra las reglas locales', async () => {
    const before = await db.dbGetAll('recurring')
    await db.dbAdd('recurring', { id: 'manual-1', source: 'manual', kind: 'income', description: 'Sueldo' })
    const { recurring, ...old } = await db.exportAllData()
    await db.importAllData(old)
    expect(await db.dbGetAll('recurring')).toHaveLength(before.length + 1)
  })

  it('clearAllData también borra las copias locales', async () => {
    const conn = await db.getDB()
    await conn.put('backups', { id: 'tmp', data: {} })
    await db.clearAllData()
    expect(await conn.getAll('backups')).toEqual([])
  })
})

describe('restaurar la foto previa', () => {
  it('vuelve los datos al estado anterior a la migración', async () => {
    const conn = await db.getDB()
    await conn.put('backups', { id: PRE_RECURRING_SNAPSHOT_ID, data: { incomes: INCOMES, expenses: EXPENSES, budgets: [], debts: DEBTS, goals: [], subscriptions: SUBS, importBatches: [], settings: null } })
    await db.dbAdd('expenses', { id: 'nuevo', amount: 1, date: '2026-10-09' })
    await db.restoreSnapshot()
    expect(await db.dbGetAll('expenses')).toEqual(EXPENSES)
    expect(await db.dbGetAll('debts')).toEqual(DEBTS)
    expect(await db.dbGetAll('recurring')).toEqual([])
    expect((await db.listSnapshots())[0]).toMatchObject({ id: PRE_RECURRING_SNAPSHOT_ID, counts: { subscriptions: 2 } })
  })
})
