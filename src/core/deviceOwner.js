// src/core/deviceOwner.js
// Aislamiento por cuenta en el dispositivo (18-oct-2026).
//
// MOY IQ guarda las finanzas solo en el dispositivo (IndexedDB) y la licencia,
// el Starter elegido y los ajustes locales en localStorage. Antes nada de eso
// estaba atado a una cuenta: si en el mismo navegador entraba otra cuenta,
// veía los datos y hasta el plan de la anterior. Ahora cada cuenta tiene su
// propio espacio y nunca se mezclan ni se borran:
//
// - IndexedDB: una base por cuenta. La base histórica 'financeos' queda para
//   la cuenta que ya la usaba (LEGACY_KEY); cualquier otra abre
//   'financeos__<uid>' (dbNameForActiveAccount, lo usa core/db/index.js).
// - localStorage: las claves de la cuenta activa (fos_*, fnos_* salvo las de
//   dispositivo) se guardan en una bolsa 'fnos_acct__<uid>' al cambiar de
//   cuenta y se restauran las de la cuenta que entra. Después se recarga la
//   página para que todo arranque limpio con la cuenta nueva.
//
// App.jsx decide con planAccountSwitch() (función pura, testeada) antes de
// mostrar cualquier dato: mientras no se sabe de quién es el dispositivo, no
// se pinta nada de la app.
//
// Este archivo no importa nada a propósito: db/index.js lo importa para saber
// qué base abrir, y un ciclo de imports lo rompería.

export const OWNER_KEY = 'fnos_device_owner'   // cuenta activa: { uid, email, at }
export const LEGACY_KEY = 'fnos_db_legacy_uid' // dueña de la base 'financeos' ('?' = desconocida)
export const VAULT_PREFIX = 'fnos_acct__'
export const LEGACY_DB = 'financeos'
export const UNKNOWN = '?'
const LEGACY_BAG = 'legacy'

// Claves de dispositivo: no son de ninguna cuenta (cotizaciones públicas,
// registro de errores, el propio estado de cuentas). Todo lo demás con
// prefijo fos_/fnos_ es de la cuenta activa.
const DEVICE_KEYS = new Set([
  OWNER_KEY, LEGACY_KEY,
  'fnos_tasa_ar_v1', 'fnos_tasa_fixer_v1', 'fnos_tasa_ve_v1', 'fnos_indicadores_v1',
  'fnos_error_log', 'fnos_demo_tour_done', 'fnos_demo_gate_passed',
])

export function isAccountKey(k) {
  if (typeof k !== 'string' || DEVICE_KEYS.has(k) || k.startsWith(VAULT_PREFIX)) return false
  return k.startsWith('fos_') || k.startsWith('fnos_')
}

function lsGet(k) { try { return localStorage.getItem(k) } catch { return null } }
function lsJSON(k) { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch { return null } }

export function readDeviceOwner() { return lsJSON(OWNER_KEY) }
export function readLegacyUid() { return lsGet(LEGACY_KEY) }

export function writeDeviceOwner(user) {
  if (!user?.id) return
  localStorage.setItem(OWNER_KEY, JSON.stringify({ uid: user.id, email: user.email || null, at: Date.now() }))
}

// Nombre de la base IndexedDB de una cuenta. Sin cuenta conocida (primer
// arranque, antes del login) se usa la histórica: así nadie que ya usaba la
// app pierde sus datos con el cambio.
export function dbNameFor(uid, legacyUid) {
  // legacyUid null = todavía no se asignó: la base histórica es de quien ya
  // estaba registrado (o de quien la adopte).
  if (!uid || legacyUid == null || uid === legacyUid) return LEGACY_DB
  return `${LEGACY_DB}__${uid}`
}

export function dbNameForActiveAccount() {
  return dbNameFor(readDeviceOwner()?.uid || null, readLegacyUid())
}

// Decisión pura (deviceOwner.test.js). Devuelve qué hacer cuando entra userId:
// - { action: 'none' }   el dispositivo ya está en esta cuenta.
// - { action: 'adopt' }  dispositivo sin cuenta registrada y nada indica que
//                        sea de otra: esta cuenta queda como dueña (usuarios
//                        que ya usaban la app antes del cambio).
// - { action: 'switch', stashAs, restoreFrom }  guardar lo de la cuenta
//   anterior en su bolsa (stashAs: uid, o 'legacy' si no se sabe de quién es)
//   y restaurar lo de la cuenta que entra (restoreFrom: su uid, 'legacy' si
//   esta cuenta demuestra ser la dueña desconocida, o null = empieza en cero).
// Para saber si unos datos sin dueño son de esta cuenta, la única señal
// fuerte es una licencia Pro guardada que en el servidor es suya.
export function planAccountSwitch({ owner, legacyUid, userId, deviceLicenseKey, serverEntitlement, hasVault, legacyBagLicenseKey }) {
  const ownsKey = (key) => !!key && serverEntitlement?.plan === 'pro' && serverEntitlement?.license_key === key
  if (owner?.uid === userId) return { action: 'none' }
  let stashAs
  if (owner?.uid) stashAs = owner.uid
  else if (deviceLicenseKey && !ownsKey(deviceLicenseKey)) stashAs = LEGACY_BAG
  else return { action: 'adopt' }
  let restoreFrom = null
  if (hasVault) restoreFrom = userId
  else if (legacyUid === UNKNOWN && ownsKey(legacyBagLicenseKey)) restoreFrom = LEGACY_BAG
  return { action: 'switch', stashAs, restoreFrom }
}

// La licencia guardada en la bolsa de datos sin dueño, para poder reclamarla.
export function legacyBagLicenseKey() {
  const bag = lsJSON(VAULT_PREFIX + LEGACY_BAG)
  try { return JSON.parse(bag?.fnos_license_v2 || 'null')?.key || null } catch { return null }
}

export function hasVault(uid) { return lsGet(VAULT_PREFIX + uid) != null }

// Aplica el plan. Primero escribe la bolsa de la cuenta saliente y recién
// después borra sus claves: si localStorage está lleno, falla antes de tocar
// nada (App.jsx muestra DeviceSwitch y no se pierde ningún dato).
export function applyAccountSwitch(user, plan) {
  if (plan.action === 'none') {
    if (readLegacyUid() == null) localStorage.setItem(LEGACY_KEY, user.id)
    return
  }
  if (plan.action === 'adopt') {
    if (readLegacyUid() == null) localStorage.setItem(LEGACY_KEY, user.id)
    writeDeviceOwner(user)
    return
  }
  const keys = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (isAccountKey(k)) keys.push(k)
  }
  const bag = {}
  for (const k of keys) bag[k] = localStorage.getItem(k)
  localStorage.setItem(VAULT_PREFIX + plan.stashAs, JSON.stringify(bag))
  for (const k of keys) localStorage.removeItem(k)

  if (plan.stashAs === LEGACY_BAG) localStorage.setItem(LEGACY_KEY, UNKNOWN)
  else if (readLegacyUid() == null) localStorage.setItem(LEGACY_KEY, plan.stashAs)

  if (plan.restoreFrom) {
    const incoming = lsJSON(VAULT_PREFIX + plan.restoreFrom) || {}
    for (const [k, v] of Object.entries(incoming)) if (isAccountKey(k) && typeof v === 'string') localStorage.setItem(k, v)
    localStorage.removeItem(VAULT_PREFIX + plan.restoreFrom)
    if (plan.restoreFrom === LEGACY_BAG) localStorage.setItem(LEGACY_KEY, user.id)
  }
  writeDeviceOwner(user)
}

export function maskEmail(email) {
  if (typeof email !== 'string' || !email.includes('@')) return null
  const [user, domain] = email.split('@')
  return `${user.slice(0, 1)}${'•'.repeat(Math.max(2, Math.min(6, user.length - 1)))}@${domain}`
}
