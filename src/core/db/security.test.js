// T14 · la store 'security' (PIN/biometría) nunca entra en el respaldo ni en
// el sync, y "Olvidé mi PIN" (wipeLocalDevice) la borra junto con todo lo
// demás. Corre contra fake-indexeddb y un localStorage en memoria.
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'

const mem = new Map()
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)) },
  removeItem: (k) => { mem.delete(k) },
  key: (i) => [...mem.keys()][i] ?? null,
  get length() { return mem.size },
  clear: () => mem.clear(),
}

const { DB_VERSION, MIGRATIONS } = await import('./migrations.js')
const db = await import('./index.js')
const store = await import('../appLockStore.js')
const { hashPin } = await import('../appLock.js')

async function seedLock() {
  const pin = await hashPin('2468', { iterations: 1000 })
  return store.saveLockConfig({ pin, biometric: { credentialId: 'cred-abc' }, timeoutMin: 1 })
}

beforeEach(async () => {
  mem.clear()
  await db.wipeLocalDevice()
  mem.clear()
})

describe('migración de la store security', () => {
  it('es un paso nuevo (v3), sin tocar los anteriores', async () => {
    // v4 (movimientos fijos) vino después; el paso 3 sigue siendo el de security.
    expect(DB_VERSION).toBeGreaterThanOrEqual(3)
    expect(MIGRATIONS.map(m => m.version).slice(0, 3)).toEqual([1, 2, 3])
    const conn = await db.getDB()
    expect([...conn.objectStoreNames]).toContain('security')
  })
})

describe('el PIN no viaja en respaldos ni en el sync', () => {
  it('exportAllData no incluye nada de la store security', async () => {
    const cfg = await seedLock()
    await db.dbAdd('expenses', { id: 'e1', date: '2026-10-01', category: 'Comida', amount: 10 })
    const payload = await db.exportAllData()
    const json = JSON.stringify(payload)
    expect(payload).not.toHaveProperty('security')
    expect(payload).not.toHaveProperty('backups')
    expect(json).not.toContain(cfg.pin.hash)
    expect(json).not.toContain(cfg.pin.salt)
    expect(json).not.toContain('cred-abc')
    expect(payload.expenses).toHaveLength(1)
  })

  it('importar un respaldo (aunque traiga una clave "security") no escribe ni borra el bloqueo', async () => {
    const cfg = await seedLock()
    const evil = await hashPin('0000', { iterations: 1000 })
    await db.importAllData({
      incomes: [], expenses: [], budgets: [], debts: [], goals: [], subscriptions: [], importBatches: [],
      security: { lock: { enabled: true, pin: evil } },
      settings: { language: 'en', lock: { enabled: true, pin: evil } },
    })
    const after = await store.getLockConfig()
    expect(after.pin.hash).toBe(cfg.pin.hash)
  })

  it('clearAllData ("Borrar todos los datos" de Ajustes) conserva el bloqueo', async () => {
    await seedLock()
    await db.clearAllData()
    expect(await store.getLockConfig()).not.toBeNull()
  })
})

describe('wipeLocalDevice (Olvidé mi PIN)', () => {
  it('borra bloqueo, intentos, ajustes, datos y claves locales; apaga el sync y conserva la licencia', async () => {
    await seedLock()
    await store.saveAttempts({ count: 7, lockedUntil: Date.now() + 60_000 })
    await db.saveSettings({ language: 'de', onboardingDone: true })
    await db.dbAdd('incomes', { id: 'i1', date: '2026-10-01', category: 'Sueldo', amount: 100 })
    localStorage.setItem('fos_score_history', '[1,2]')
    localStorage.setItem('fnos_presync_backup', '{"incomes":[]}')
    localStorage.setItem('fnos_sync_on', '1')
    localStorage.setItem('fnos_license_v2', '{"plan":"pro"}')

    await db.wipeLocalDevice()

    expect(await store.getLockConfig()).toBeNull()
    expect(await store.getAttempts()).toEqual({ count: 0, lockedUntil: 0 })
    expect(await db.dbGetAll('incomes')).toEqual([])
    const s = await db.getSettings()
    expect(s.onboardingDone).toBeUndefined()
    expect(s.language).toBe(db.firstRunSettings().language)
    expect(localStorage.getItem('fos_score_history')).toBeNull()
    expect(localStorage.getItem('fnos_presync_backup')).toBeNull()
    expect(localStorage.getItem('fnos_sync_on')).toBe('0')
    expect(localStorage.getItem('fnos_license_v2')).toBe('{"plan":"pro"}')
  })
})

describe('appLockStore', () => {
  it('disableLock borra configuración e intentos', async () => {
    await seedLock()
    await store.saveAttempts({ count: 3, lockedUntil: 0 })
    await store.disableLock()
    expect(await store.getLockConfig()).toBeNull()
    expect((await store.getAttempts()).count).toBe(0)
  })

  it('updateLockConfig conserva el PIN y normaliza el timeout', async () => {
    const cfg = await seedLock()
    const next = await store.updateLockConfig({ timeoutMin: 99, biometric: null })
    expect(next.pin.hash).toBe(cfg.pin.hash)
    expect(next.timeoutMin).toBe(5)
    expect(next.biometric).toBeNull()
  })

  it('saveLockConfig rechaza un registro de PIN inválido', async () => {
    await expect(store.saveLockConfig({ pin: { hash: 'x' } })).rejects.toThrow()
  })
})
