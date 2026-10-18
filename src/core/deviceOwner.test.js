// Aislamiento por cuenta en el dispositivo (core/deviceOwner.js): cada cuenta
// tiene su base IndexedDB y sus claves locales, y cambiar de cuenta nunca
// muestra ni borra lo de la otra. Corre contra fake-indexeddb y un
// localStorage en memoria.
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

const own = await import('./deviceOwner.js')
const db = await import('./db/index.js')
const { planAccountSwitch, applyAccountSwitch, dbNameFor, isAccountKey, maskEmail } = own

const A = { id: 'uid-a', email: 'a@x.com' }
const B = { id: 'uid-b', email: 'b@x.com' }
const KEY_A = 'FNOS-AAAA-BBBB-CCCC'
const licenseJSON = (key) => JSON.stringify({ key, plan: 'pro' })

// Lo que hace App.jsx al iniciar sesión, sin React ni recarga.
function signIn(user, serverEntitlement = null) {
  const plan = planAccountSwitch({
    owner: own.readDeviceOwner(), legacyUid: own.readLegacyUid(), userId: user.id,
    deviceLicenseKey: (() => { try { return JSON.parse(localStorage.getItem('fnos_license_v2') || 'null')?.key || '' } catch { return '' } })(),
    serverEntitlement, hasVault: own.hasVault(user.id), legacyBagLicenseKey: own.legacyBagLicenseKey(),
  })
  applyAccountSwitch(user, plan)
  return plan
}

async function deleteAllDbs() {
  for (const d of await indexedDB.databases()) {
    await new Promise((res) => { const r = indexedDB.deleteDatabase(d.name); r.onsuccess = r.onerror = r.onblocked = () => res() })
  }
}

beforeEach(async () => {
  db.closeDB()
  mem.clear()
  await deleteAllDbs()
})

describe('planAccountSwitch', () => {
  it('misma cuenta → none', () => {
    expect(planAccountSwitch({ owner: { uid: 'a' }, userId: 'a' })).toEqual({ action: 'none' })
  })

  it('dispositivo sin dueño ni licencia → adopt (usuarios existentes no pierden nada)', () => {
    expect(planAccountSwitch({ owner: null, userId: 'b', deviceLicenseKey: '' })).toEqual({ action: 'adopt' })
  })

  it('sin dueño, con licencia Pro de esta cuenta en el servidor → adopt', () => {
    expect(planAccountSwitch({
      owner: null, userId: 'a', deviceLicenseKey: KEY_A,
      serverEntitlement: { plan: 'pro', license_key: KEY_A },
    })).toEqual({ action: 'adopt' })
  })

  it('sin dueño, con licencia que esta cuenta no tiene → guarda lo anterior como "sin dueño" y empieza en cero', () => {
    expect(planAccountSwitch({ owner: null, userId: 'b', deviceLicenseKey: KEY_A, serverEntitlement: { plan: 'starter' } }))
      .toEqual({ action: 'switch', stashAs: 'legacy', restoreFrom: null })
  })

  it('otra cuenta registrada → switch; restaura la bolsa propia si existe', () => {
    expect(planAccountSwitch({ owner: { uid: 'a' }, userId: 'b', hasVault: false })).toEqual({ action: 'switch', stashAs: 'a', restoreFrom: null })
    expect(planAccountSwitch({ owner: { uid: 'a' }, userId: 'b', hasVault: true })).toEqual({ action: 'switch', stashAs: 'a', restoreFrom: 'b' })
  })

  it('la cuenta dueña de los datos "sin dueño" los recupera demostrando su licencia', () => {
    expect(planAccountSwitch({
      owner: { uid: 'b' }, legacyUid: '?', userId: 'a', hasVault: false,
      legacyBagLicenseKey: KEY_A, serverEntitlement: { plan: 'pro', license_key: KEY_A },
    })).toEqual({ action: 'switch', stashAs: 'b', restoreFrom: 'legacy' })
    // Sin la licencia en el servidor, no.
    expect(planAccountSwitch({
      owner: { uid: 'b' }, legacyUid: '?', userId: 'c', hasVault: false,
      legacyBagLicenseKey: KEY_A, serverEntitlement: { plan: 'starter' },
    })).toEqual({ action: 'switch', stashAs: 'b', restoreFrom: null })
  })
})

describe('dbNameFor / isAccountKey', () => {
  it('la base histórica queda para su dueña; cualquier otra cuenta tiene la suya', () => {
    expect(dbNameFor(null, null)).toBe('financeos')
    expect(dbNameFor('a', null)).toBe('financeos')
    expect(dbNameFor('a', 'a')).toBe('financeos')
    expect(dbNameFor('b', 'a')).toBe('financeos__b')
    expect(dbNameFor('a', '?')).toBe('financeos__a')
  })

  it('las claves de dispositivo no viajan con la cuenta', () => {
    expect(isAccountKey('fnos_license_v2')).toBe(true)
    expect(isAccountKey('fnos_starter_ack')).toBe(true)
    expect(isAccountKey('fos_settings')).toBe(true)
    expect(isAccountKey('fnos_device_owner')).toBe(false)
    expect(isAccountKey('fnos_acct__uid-a')).toBe(false)
    expect(isAccountKey('fnos_tasa_ve_v1')).toBe(false)
    expect(isAccountKey('sb-xyz-auth-token')).toBe(false)
  })
})

describe('dos cuentas en el mismo navegador', () => {
  it('B empieza en cero, A recupera todo lo suyo al volver, y nunca se cruzan', async () => {
    // A usa la app: movimiento, licencia Pro y un ajuste local.
    signIn(A)
    expect(own.readLegacyUid()).toBe(A.id)
    await db.dbAdd('expenses', { id: 'e1', amount: 1000, description: 'de A' })
    localStorage.setItem('fnos_license_v2', licenseJSON(KEY_A))
    localStorage.setItem('fos_dash_compact', '1')

    // Entra B (App.jsx recarga: se simula cerrando la conexión).
    db.closeDB()
    expect(signIn(B).action).toBe('switch')
    expect(own.dbNameForActiveAccount()).toBe('financeos__uid-b')
    expect(await db.dbGetAll('expenses')).toEqual([])
    expect(localStorage.getItem('fnos_license_v2')).toBeNull()
    expect(localStorage.getItem('fos_dash_compact')).toBeNull()
    await db.dbAdd('expenses', { id: 'e2', amount: 5, description: 'de B' })

    // Vuelve A: recupera su base, su licencia y sus ajustes; no ve nada de B.
    db.closeDB()
    expect(signIn(A)).toEqual({ action: 'switch', stashAs: B.id, restoreFrom: A.id })
    expect(own.dbNameForActiveAccount()).toBe('financeos')
    expect((await db.dbGetAll('expenses')).map(e => e.id)).toEqual(['e1'])
    expect(JSON.parse(localStorage.getItem('fnos_license_v2')).key).toBe(KEY_A)
    expect(localStorage.getItem('fos_dash_compact')).toBe('1')

    // Y B al volver encuentra solo lo suyo.
    db.closeDB()
    signIn(B)
    expect((await db.dbGetAll('expenses')).map(e => e.id)).toEqual(['e2'])
    expect(localStorage.getItem('fnos_license_v2')).toBeNull()
  })

  it('getDB nunca sigue usando la base de la cuenta anterior aunque no se recargue', async () => {
    signIn(A)
    await db.dbAdd('expenses', { id: 'e1', amount: 1 })
    signIn(B) // sin cerrar la conexión
    expect(await db.dbGetAll('expenses')).toEqual([])
  })

  it('datos sin dueño (de antes del cambio) quedan aparte y solo los recupera su cuenta', async () => {
    await db.dbAdd('expenses', { id: 'old', amount: 1 })
    localStorage.setItem('fnos_license_v2', licenseJSON(KEY_A))
    db.closeDB()

    // Entra B, sin esa licencia: no ve nada.
    expect(signIn(B, { plan: 'starter' })).toEqual({ action: 'switch', stashAs: 'legacy', restoreFrom: null })
    expect(own.readLegacyUid()).toBe('?')
    expect(await db.dbGetAll('expenses')).toEqual([])

    // Entra A, que sí tiene esa licencia: recupera la base histórica.
    db.closeDB()
    expect(signIn(A, { plan: 'pro', license_key: KEY_A })).toEqual({ action: 'switch', stashAs: B.id, restoreFrom: 'legacy' })
    expect(own.readLegacyUid()).toBe(A.id)
    expect((await db.dbGetAll('expenses')).map(e => e.id)).toEqual(['old'])
  })

  it('si localStorage está lleno, falla antes de tocar nada', () => {
    signIn(A)
    localStorage.setItem('fos_settings', '{"x":1}')
    const realSet = localStorage.setItem
    localStorage.setItem = (k, v) => { if (k.startsWith('fnos_acct__')) throw new Error('QuotaExceededError'); realSet(k, v) }
    try {
      expect(() => signIn(B)).toThrow()
    } finally { localStorage.setItem = realSet }
    expect(localStorage.getItem('fos_settings')).toBe('{"x":1}')
    expect(own.readDeviceOwner().uid).toBe(A.id)
  })
})

describe('maskEmail', () => {
  it('enmascara el usuario y deja el dominio', () => {
    expect(maskEmail('walterlamadriz@gmail.com')).toBe('w••••••@gmail.com')
    expect(maskEmail('ab@x.com')).toBe('a••@x.com')
  })
  it('devuelve null si no es un email', () => {
    expect(maskEmail(null)).toBeNull()
    expect(maskEmail('sin-arroba')).toBeNull()
  })
})
