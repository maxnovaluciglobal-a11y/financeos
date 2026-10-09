// La foto previa a fijos (migración v4) es best-effort y nunca deja al usuario
// con la app vacía: si falla, la base igual llega a v4; y si una base
// existente no se puede abrir, NO se cae en silencio a localStorage.
import 'fake-indexeddb/auto'
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { openDB } from 'idb'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const mem = new Map()
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)) },
  removeItem: (k) => { mem.delete(k) },
  key: (i) => [...mem.keys()][i] ?? null,
  get length() { return mem.size },
  clear: () => mem.clear(),
}

const quota = () => new DOMException('quota llena', 'QuotaExceededError')
const restores = []
function patch(obj, name, impl) {
  const orig = obj[name]
  obj[name] = function (...args) { return impl.call(this, orig, ...args) }
  restores.push(() => { obj[name] = orig })
}

async function seedV3() {
  const { MIGRATIONS, runMigrationSteps } = await import('./migrations.js')
  const v3 = await openDB('financeos', 3, {
    upgrade: (db, o, n, tx) => runMigrationSteps(db, o, n, tx, MIGRATIONS.filter(m => m.version <= 3)),
  })
  await v3.put('expenses', { id: 'e1', date: '2026-10-01', amount: 10, description: 'Super' })
  await v3.put('subscriptions', { id: 's1', name: 'Netflix', amount: 9, frequency: 'monthly', status: 'active' })
  v3.close()
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  mem.clear()
  vi.resetModules()
})
afterEach(() => { while (restores.length) restores.pop()() })

describe('foto previa best-effort', () => {
  it('si el put de la foto falla, el upgrade igual llega a la última versión con las stores creadas', async () => {
    await seedV3()
    patch(IDBObjectStore.prototype, 'put', function (orig, ...a) {
      if (this.name === 'backups') throw quota()
      return orig.apply(this, a)
    })
    const db = await import('./index.js')
    const conn = await db.getDB()
    expect(conn.version).toBe(5)
    expect(conn.objectStoreNames.contains('recurring')).toBe(true)
    expect(await conn.getAll('backups')).toEqual([])
    expect(await conn.getAll('expenses')).toHaveLength(1)
    expect(db.isUsingFallback()).toBe(false)
  })

  it('si la foto aborta el upgrade, getDB reintenta una vez sin foto y llega a la última versión', async () => {
    await seedV3()
    let thrown = false
    patch(IDBObjectStore.prototype, 'getAll', function (orig, ...a) {
      // Solo dentro de la foto (transacción versionchange) y solo la primera
      // vez falla la lectura: el reintento (sin foto) ya puede leer, como
      // necesita la migración v5 para renombrar categorías.
      if (!thrown && this.transaction?.mode === 'versionchange' && this.name === 'incomes') { thrown = true; throw quota() }
      return orig.apply(this, a)
    })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const db = await import('./index.js')
    const conn = await db.getDB()
    errSpy.mockRestore()
    expect(conn.version).toBe(5)
    expect(conn.objectStoreNames.contains('backups')).toBe(true)
    expect(await conn.getAll('subscriptions')).toHaveLength(1)
    expect(mem.has('fos_snapshot_skipped')).toBe(true)
    expect(db.isUsingFallback()).toBe(false)
  })
})

describe('sin fallback silencioso a localStorage', () => {
  it('base existente que no abre → DbOpenError (no fallback) y los datos quedan intactos', async () => {
    await seedV3()
    patch(globalThis.IDBDatabase.prototype, 'createObjectStore', function (orig, name, ...a) {
      if (name === 'recurring') throw new DOMException('roto', 'UnknownError')
      return orig.call(this, name, ...a)
    })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const db = await import('./index.js')
    await expect(db.getDB()).rejects.toMatchObject({ name: 'DbOpenError' })
    await expect(db.dbGetAll('expenses')).rejects.toMatchObject({ name: 'DbOpenError' })
    errSpy.mockRestore()
    expect(db.isUsingFallback()).toBe(false)
    expect(mem.size === 0 || ![...mem.keys()].some(k => k.startsWith('fos_expenses'))).toBe(true)
    restores.pop()()
    const old = await openDB('financeos')
    expect(old.version).toBe(3)
    expect(await old.getAll('expenses')).toHaveLength(1)
    old.close()
  })

  it('sin base previa e IndexedDB inutilizable → fallback a localStorage como antes', async () => {
    patch(globalThis.indexedDB, 'open', function () { throw new DOMException('no idb', 'InvalidStateError') })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const db = await import('./index.js')
    expect(await db.getDB()).toBe(null)
    warn.mockRestore()
    expect(db.isUsingFallback()).toBe(true)
  })
})
