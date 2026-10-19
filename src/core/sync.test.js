// Sync (auditoría 360: ING-3, C-21 / D-05). Servidor simulado (sync_pull /
// sync_push sobre una fila), base local en memoria y localStorage en memoria.
// Cubre el camino viejo (v1), la migración opt-in a frase de paso (v2), su
// verificación y rollback, y que un blob que el dispositivo no puede leer
// nunca se pise.
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mem = new Map()
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)) },
  removeItem: (k) => { mem.delete(k) },
  key: (i) => [...mem.keys()][i] ?? null,
  get length() { return mem.size },
  clear: () => mem.clear(),
}

const STORES = ['incomes', 'expenses', 'budgets', 'debts', 'goals', 'subscriptions', 'importBatches', 'recurring']
let local = {}
const emptyLocal = () => Object.fromEntries(STORES.map((s) => [s, []]))
vi.mock('./db/index.js', () => ({
  DATA_STORES: ['incomes', 'expenses', 'budgets', 'debts', 'goals', 'subscriptions', 'importBatches', 'recurring'],
  exportAllData: async () => JSON.parse(JSON.stringify({ ...local, settings: { currency: 'CLP' } })),
  importAllData: async (p) => { for (const s of Object.keys(local)) local[s] = Array.isArray(p[s]) ? JSON.parse(JSON.stringify(p[s])) : [] },
}))
let license = 'FNOS-AAAA-BBBB-CCCC'
vi.mock('../utils/licenseValidator.js', () => ({ getLicenseKey: () => license }))
vi.mock('./authClient.js', () => ({ authClient: { auth: { getSession: async () => ({ data: { session: { access_token: 'jwt' } } }) } } }))

// Servidor: una fila por hash de licencia.
let row = null
let corruptNextPush = false
const pushes = []
vi.stubGlobal('fetch', vi.fn(async (url, init) => {
  const body = JSON.parse(init.body)
  if (url.endsWith('/rpc/sync_pull')) {
    return { ok: true, json: async () => (row ? { ok: true, blob: row.blob, updated_at: row.updatedAt } : { ok: true, empty: true }) }
  }
  if (url.endsWith('/rpc/sync_push')) {
    const blob = corruptNextPush ? body.p_blob.slice(0, -8) + 'AAAAAAA=' : body.p_blob
    corruptNextPush = false
    row = { blob, updatedAt: body.p_updated_at }
    pushes.push(row)
    return { ok: true, json: async () => ({ ok: true }) }
  }
  return { ok: false, status: 404, json: async () => ({}) }
}))
vi.stubEnv('VITE_SUPABASE_URL', 'https://p.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon')

const sync = await import('./sync.js')
const crypto2 = await import('../utils/syncCrypto.js')
const IT = 1000 // iteraciones bajas solo en los tests (producción: 600 000)
const PASS = 'una frase de paso larga'
const DATA_A = { expenses: [{ id: 'a1', amount: 100 }, { id: 'a2', amount: 200 }], incomes: [{ id: 'i1', amount: 900 }] }

function setLocal(d) { local = { ...emptyLocal(), ...JSON.parse(JSON.stringify(d)) } }
const meta = (m) => localStorage.setItem('fnos_sync_meta', JSON.stringify(m))

beforeEach(() => {
  mem.clear(); row = null; pushes.length = 0; corruptNextPush = false
  license = 'FNOS-AAAA-BBBB-CCCC'
  setLocal({})
  sync.setSyncEnabled(true)
})

async function seedRemoteV1(data, updatedAt) {
  row = { blob: await crypto2.encryptData({ ...emptyLocal(), ...data }, license), updatedAt }
}

describe('camino viejo (v1) sin migrar', () => {
  it('sube cifrado con la licencia y otro dispositivo con la misma licencia lo lee', async () => {
    setLocal(DATA_A); meta({ lastLocalChange: 10 })
    await sync.pushNow()
    expect(crypto2.isV2Blob(row.blob)).toBe(false)
    expect((await crypto2.decryptData(row.blob, license)).expenses).toHaveLength(2)
    expect(sync.syncMode()).toBe('v1')
  })
  it('aplica lo remoto más nuevo con respaldo local previo', async () => {
    await seedRemoteV1(DATA_A, 500)
    setLocal({ expenses: [{ id: 'old' }] }); meta({ lastLocalChange: 100, lastPushedAt: 100 })
    const r = await sync.pullAndApplyIfNewer()
    expect(r.applied).toBe(true)
    expect(local.expenses.map((e) => e.id)).toEqual(['a1', 'a2'])
    expect(JSON.parse(localStorage.getItem('fnos_presync_backup')).expenses[0].id).toBe('old')
  })
})

describe('protecciones nuevas', () => {
  it('dispositivo nuevo y vacío: toma lo remoto aunque su marca de cambio sea más nueva (bug del 19-oct)', async () => {
    await seedRemoteV1(DATA_A, 500)
    meta({ lastLocalChange: Date.now() })
    const r = await sync.pullAndApplyIfNewer()
    expect(r.applied).toBe(true)
    expect(pushes).toHaveLength(0)
    expect(local.expenses).toHaveLength(2)
  })
  it('un blob que este dispositivo no puede descifrar nunca se pisa', async () => {
    await seedRemoteV1(DATA_A, 500)
    license = 'FNOS-ZZZZ-ZZZZ-ZZZZ'
    setLocal({ expenses: [{ id: 'x' }] }); meta({ lastLocalChange: Date.now(), lastPushedAt: 1 })
    const before = row.blob
    const r = await sync.pullAndApplyIfNewer()
    expect(r).toEqual({ applied: false, blocked: 'undecryptable' })
    expect(row.blob).toBe(before)
  })
  it('con solo el hash de la licencia no hay llave v1: no sube y pide la clave o la frase', async () => {
    await seedRemoteV1(DATA_A, 500)
    license = await crypto2.licenseKeyHash('FNOS-AAAA-BBBB-CCCC')
    expect(await sync.syncRequirement()).toBe('license_key')
    expect(await sync.pullAndApplyIfNewer()).toEqual({ applied: false, blocked: 'license_key_required' })
    await expect(sync.pushNow()).rejects.toThrow('passphrase_required')
  })
})

describe('v2 desde cero (nube vacía)', () => {
  it('exige frase de 10+ caracteres, crea la llave y sube con frase', async () => {
    expect(await sync.syncRequirement()).toBe('new_passphrase')
    await expect(sync.setupPassphrase('corta', IT)).rejects.toThrow('passphrase_too_short')
    await sync.setupPassphrase(PASS, IT)
    setLocal(DATA_A); meta({ lastLocalChange: 5 })
    await sync.pushNow()
    expect(crypto2.isV2Blob(row.blob)).toBe(true)
    expect(row.blob).not.toContain('"amount"')
    expect(sync.syncMode()).toBe('v2')
  })
})

describe('migración v1 → v2 → rollback', () => {
  it('migra: guarda la copia v1, trae lo remoto más nuevo, sube v2 verificado', async () => {
    await seedRemoteV1(DATA_A, 500)
    const v1Blob = row.blob
    setLocal({ expenses: [{ id: 'viejo' }] }); meta({ lastLocalChange: 100, lastPushedAt: 100 })
    await sync.migrateToPassphrase(PASS, { iterations: IT })
    expect(sync.syncMode()).toBe('v2')
    expect(crypto2.isV2Blob(row.blob)).toBe(true)
    expect(local.expenses.map((e) => e.id)).toEqual(['a1', 'a2'])
    expect(JSON.parse(localStorage.getItem('fnos_sync_v1_rollback')).blob).toBe(v1Blob)
    // La licencia ya no descifra la nube.
    await expect(crypto2.decryptData(row.blob, license)).rejects.toThrow()
  })

  it('otro dispositivo sin migrar queda bloqueado y no pisa la copia v2; con la frase correcta se desbloquea', async () => {
    await seedRemoteV1(DATA_A, 500)
    setLocal(DATA_A); meta({ lastLocalChange: 100, lastPushedAt: 500 })
    await sync.migrateToPassphrase(PASS, { iterations: IT })
    const v2Blob = row.blob
    // "Dispositivo B": mismo localStorage de cuenta pero sin la llave v2.
    localStorage.removeItem('fnos_sync_v2')
    setLocal({ expenses: [{ id: 'b-local' }] }); meta({ lastLocalChange: Date.now(), lastPushedAt: 1 })
    expect(await sync.pullAndApplyIfNewer()).toEqual({ applied: false, blocked: 'passphrase_required' })
    expect(row.blob).toBe(v2Blob)
    expect(await sync.syncRequirement()).toBe('passphrase')
    await expect(sync.unlockWithPassphrase('frase equivocada larga', { minIterations: IT })).rejects.toThrow('wrong_key')
    expect(sync.syncMode()).toBe('v1')
    await sync.unlockWithPassphrase(PASS, { minIterations: IT })
    expect(sync.syncMode()).toBe('v2')
    meta({ lastLocalChange: 1, lastPushedAt: 1 })
    expect((await sync.pullAndApplyIfNewer()).applied).toBe(true)
    expect(local.expenses.map((e) => e.id)).toEqual(['a1', 'a2'])
  })

  it('rollback a la licencia: la nube vuelve a v1 con los datos actuales y la licencia la lee', async () => {
    await seedRemoteV1(DATA_A, 500)
    setLocal(DATA_A); meta({ lastLocalChange: 100, lastPushedAt: 500 })
    await sync.migrateToPassphrase(PASS, { iterations: IT })
    local.expenses.push({ id: 'a3', amount: 300 })
    await sync.rollbackToLicenseKey()
    expect(sync.syncMode()).toBe('v1')
    expect(crypto2.isV2Blob(row.blob)).toBe(false)
    expect((await crypto2.decryptData(row.blob, license)).expenses.map((e) => e.id)).toEqual(['a1', 'a2', 'a3'])
  })

  it('restoreV1Snapshot devuelve exactamente la copia v1 previa', async () => {
    await seedRemoteV1(DATA_A, 500)
    const v1 = { ...row }
    setLocal(DATA_A); meta({ lastLocalChange: 100, lastPushedAt: 500 })
    await sync.migrateToPassphrase(PASS, { iterations: IT })
    await sync.restoreV1Snapshot()
    expect(row).toEqual(v1)
  })

  it('si la verificación falla, la nube vuelve a la copia v1 y el dispositivo sigue en v1', async () => {
    await seedRemoteV1(DATA_A, 500)
    const v1 = row.blob
    setLocal(DATA_A); meta({ lastLocalChange: 100, lastPushedAt: 500 })
    corruptNextPush = true
    await expect(sync.migrateToPassphrase(PASS, { iterations: IT })).rejects.toThrow('verify_failed')
    expect(row.blob).toBe(v1)
    expect(sync.syncMode()).toBe('v1')
    expect((await sync.pullAndApplyIfNewer()).blocked).toBeUndefined()
  })

  it('no migra sin la clave de licencia cruda si hay copia v1 (no se pierde lo remoto)', async () => {
    await seedRemoteV1(DATA_A, 500)
    license = await crypto2.licenseKeyHash(license)
    await expect(sync.migrateToPassphrase(PASS, { iterations: IT })).rejects.toThrow('license_key_required')
    expect(crypto2.isV2Blob(row.blob)).toBe(false)
  })

  it('rollback sin la clave cruda no hace nada', async () => {
    license = await crypto2.licenseKeyHash('FNOS-AAAA-BBBB-CCCC')
    await expect(sync.rollbackToLicenseKey()).rejects.toThrow('license_key_required')
  })
})

describe('un dispositivo sin la frase nunca sube encima de una copia con frase', () => {
  it('pushNow en v1 con la nube en v2 se niega', async () => {
    await seedRemoteV1(DATA_A, 500)
    setLocal(DATA_A); meta({ lastLocalChange: 100, lastPushedAt: 500 })
    await sync.migrateToPassphrase(PASS, { iterations: IT })
    const v2Blob = row.blob
    localStorage.removeItem('fnos_sync_v2')
    setLocal({ expenses: [{ id: 'b' }] }); meta({ lastLocalChange: Date.now() })
    await expect(sync.pushNow()).rejects.toThrow('passphrase_required')
    expect(row.blob).toBe(v2Blob)
  })
  it('pushNow con una llave v2 de otra frase (sal distinta) tampoco pisa', async () => {
    await sync.setupPassphrase(PASS, IT)
    setLocal(DATA_A); meta({ lastLocalChange: 5 })
    await sync.pushNow()
    const blob = row.blob
    localStorage.removeItem('fnos_sync_v2')
    row = null
    await sync.setupPassphrase('otra frase distinta larga', IT)
    row = { blob, updatedAt: 5 }
    await expect(sync.pushNow()).rejects.toThrow('passphrase_required')
    expect(row.blob).toBe(blob)
  })
})
