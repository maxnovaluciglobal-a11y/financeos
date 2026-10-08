// src/core/db/index.js — wiring de IndexedDB. Los pasos de esquema versionados
// viven en ./migrations.js (ver ahí antes de tocar DB_VERSION).

import { openDB } from 'idb'
import { DB_VERSION, runMigrations, PRE_RECURRING_SNAPSHOT_ID } from './migrations.js'
import { currentMonth, localDateStr } from '../../utils/index.js'
import { reconcileRules } from '../../utils/recurringSources.js'
import { buildConfirmedRecord, occurrenceRecordId } from '../../utils/recurring.js'
import { applyDebtPayment } from '../../utils/debtPayment.js'
import { stripDeviceOnlySettings, mergeIncomingSettings } from '../../utils/money.js'
import { regionDefaults } from '../../i18n/region.js'

const DB_NAME = 'financeos'

// Stores con datos del usuario que viajan en el respaldo JSON y en el sync
// cifrado. 'security' (PIN) y 'backups' (copias locales) quedan fuera a propósito.
export const DATA_STORES = ['incomes', 'expenses', 'budgets', 'debts', 'goals', 'subscriptions', 'importBatches', 'recurring']
let _db = null
let _useLocalStorage = false

// ─── localStorage fallback ────────────────────────────────────────────────────
function lsGet(store)       { try { return JSON.parse(localStorage.getItem(`fos_${store}`) || '[]') } catch { return [] } }
function lsSet(store, data) { try { localStorage.setItem(`fos_${store}`, JSON.stringify(data)) } catch {} }
function lsPut(store, item) { const a = lsGet(store).filter(r => r.id !== item.id); lsSet(store, [...a, item]) }
function lsDel(store, id)   { lsSet(store, lsGet(store).filter(r => r.id !== id)) }
function lsClear(store)     { try { localStorage.removeItem(`fos_${store}`) } catch {} }

// ─── getDB ────────────────────────────────────────────────────────────────────
export async function getDB() {
  if (_useLocalStorage) return null
  if (_db) return _db
  try {
    _db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        runMigrations(db, oldVersion, newVersion, transaction)
      },
      blocked()    { _db?.close(); _db = null },
      blocking()   { _db?.close(); _db = null },
      terminated() { _db = null },
    })
    return _db
  } catch (e) {
    console.warn('IndexedDB no disponible → localStorage fallback:', e.message)
    _useLocalStorage = true
    return null
  }
}

export const isUsingFallback = () => _useLocalStorage

// ─── CRUD genérico ────────────────────────────────────────────────────────────
export async function dbGetAll(store) {
  const db = await getDB()
  if (!db) return lsGet(store)
  return db.getAll(store)
}

export async function dbAdd(store, item) {
  const db = await getDB()
  if (!db) { lsPut(store, item); return item }
  await db.put(store, item)
  return item
}

export async function dbDelete(store, id) {
  const db = await getDB()
  if (!db) { lsDel(store, id); return }
  await db.delete(store, id)
}

// ─── Settings ─────────────────────────────────────────────────────────────────
const SETTINGS_KEY = 'main'
export const DEFAULT_SETTINGS = {
  currency: 'CLP',
  language: 'es',
  theme: 'light',
  savingGoalPct: 25,
  emergencyFundMonths: 5,
  activeMonth: currentMonth(),
  country: 'CL',
}

// Ajustes de un dispositivo que todavía no guardó nada: idioma, país y moneda
// salen del navegador (i18n/region.js) para que AuthGate, LicenseGate y el
// primer paso del onboarding ya se vean en el idioma del usuario. Con ajustes
// guardados esto no participa: lo guardado manda siempre.
export function firstRunSettings(locales) {
  return { ...DEFAULT_SETTINGS, ...regionDefaults(locales) }
}

export async function getSettings() {
  const db = await getDB()
  let saved = null
  if (!db) { try { saved = JSON.parse(localStorage.getItem('fos_settings')) } catch {} }
  else      { saved = await db.get('settings', SETTINGS_KEY) }
  if (!saved) return firstRunSettings()
  return { ...DEFAULT_SETTINGS, ...saved }
}

export async function saveSettings(settings) {
  const db = await getDB()
  if (!db) { try { localStorage.setItem('fos_settings', JSON.stringify(settings)) } catch {} }
  else     { await db.put('settings', settings, SETTINGS_KEY) }
  return settings
}

// ─── clearAllData ─────────────────────────────────────────────────────────────
export async function clearAllData() {
  // 'backups' también: "borrar todos los datos" no puede dejar una copia
  // completa escondida en el dispositivo.
  const stores = [...DATA_STORES, 'backups']
  const db = await getDB()
  if (!db) { stores.forEach(lsClear); return }
  const tx = db.transaction(stores, 'readwrite')
  await Promise.all(stores.map(s => tx.objectStore(s).clear()))
  await tx.done
}

// ─── Security (T14 · bloqueo) ─────────────────────────────────────────────────
// Store 'security' (migración v3): hash del PIN, credencial WebAuthn e
// intentos fallidos. Fuera de exportAllData/importAllData a propósito — ver
// el comentario del paso 3 en migrations.js.
const LS_SECURITY = 'fos_security'
function lsSecurity() { try { return JSON.parse(localStorage.getItem(LS_SECURITY) || '{}') || {} } catch { return {} } }

export async function securityGet(key) {
  const db = await getDB()
  if (!db) return lsSecurity()[key] ?? null
  return (await db.get('security', key)) ?? null
}

export async function securityPut(key, value) {
  const db = await getDB()
  if (!db) { try { localStorage.setItem(LS_SECURITY, JSON.stringify({ ...lsSecurity(), [key]: value })) } catch {} ; return value }
  await db.put('security', value, key)
  return value
}

export async function securityDelete(key) {
  const db = await getDB()
  if (!db) { const all = lsSecurity(); delete all[key]; try { localStorage.setItem(LS_SECURITY, JSON.stringify(all)) } catch {} ; return }
  await db.delete('security', key)
}

// ─── wipeLocalDevice ──────────────────────────────────────────────────────────
// Borrado TOTAL de lo que MOY IQ guarda en este dispositivo: todas las stores
// (incluidas 'settings' y 'security', que clearAllData() NO toca), las claves
// locales `fos_*` (fallback de localStorage, historial del IQ Score, última
// importación…) y la copia previa al sync (`fnos_presync_backup`, que es un
// respaldo completo en claro). Además apaga el sync: si quedara encendido, la
// próxima carga bajaría todo de la nube y "olvidé mi PIN" sería una forma de
// saltarse el bloqueo. La licencia (`fnos_license_v2`, `fnos_starter_ack`) se
// conserva: es de la cuenta, no son datos financieros, y para volver a
// entrar igual hace falta iniciar sesión (el flujo de AppLock cierra sesión).
//
// Lo usa solo el camino "Olvidé mi PIN" de AppLock. "Borrar todos los datos"
// de Ajustes sigue usando clearAllData(): ahí el usuario ya desbloqueó y
// quiere vaciar movimientos, no resetear el dispositivo.
export async function wipeLocalDevice() {
  const db = await getDB()
  if (db) {
    const names = [...db.objectStoreNames]
    if (names.length) {
      const tx = db.transaction(names, 'readwrite')
      await Promise.all(names.map(s => tx.objectStore(s).clear()))
      await tx.done
    }
  }
  try {
    const keys = []
    for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i))
    for (const k of keys) {
      if (k && (k.startsWith('fos_') || k === 'fnos_presync_backup' || k === 'fnos_sync_meta' || k === 'fnos_error_log')) {
        localStorage.removeItem(k)
      }
    }
    localStorage.setItem('fnos_sync_on', '0')
  } catch {}
}

// ─── Export / Import ──────────────────────────────────────────────────────────
export async function exportAllData() {
  const [incomes, expenses, budgets, debts, goals, subscriptions, settings] = await Promise.all([
    dbGetAll('incomes'), dbGetAll('expenses'), dbGetAll('budgets'),
    dbGetAll('debts'),   dbGetAll('goals'),   dbGetAll('subscriptions'), getSettings(),
  ])
  let importBatches = []
  try { importBatches = await dbGetAll('importBatches') } catch {}
  let recurring = []
  try { recurring = await dbGetAll('recurring') } catch {}
  // settings sin los ajustes de dispositivo (hideAmounts): este payload es el
  // mismo del respaldo JSON y del sync cifrado, ver utils/money.js.
  return { incomes, expenses, budgets, debts, goals, subscriptions, importBatches, recurring,
           settings: stripDeviceOnlySettings(settings),
           exportedAt: new Date().toISOString(), version: '1.2' }
}

export async function importAllData(data) {
  if (!data || typeof data !== 'object') throw new Error('Formato inválido')
  // Un respaldo (o un blob del sync) de una versión anterior no trae
  // 'recurring': en ese caso las reglas locales se conservan en vez de
  // vaciarse — si no, sincronizar con un dispositivo sin actualizar borraría
  // los fijos creados a mano. Las de Suscripciones/Deudas se vuelven a
  // alinear solas (reconcileRecurringSources).
  const stores = DATA_STORES.filter(s => s !== 'recurring' || Array.isArray(data.recurring))
  const db = await getDB()
  if (!db) {
    stores.forEach(lsClear)
    for (const store of stores) if (Array.isArray(data[store])) lsSet(store, data[store])
  } else {
    // Clear + repoblado en UNA sola transacción que abarca todas las stores: si algo
    // falla a mitad de camino (item malformado, cuota llena, pestaña cerrada),
    // IndexedDB aborta TODA la transacción y los datos reales quedan intactos.
    // Antes cada store tenía su propia transacción separada, así que una falla
    // a mitad de camino dejaba los datos reales ya borrados y solo parte de las
    // stores repuestas — sin rollback.
    const tx = db.transaction(stores, 'readwrite')
    await Promise.all(stores.map(s => tx.objectStore(s).clear()))
    for (const store of stores) {
      if (!Array.isArray(data[store])) continue
      for (const item of data[store]) await tx.objectStore(store).put(item)
    }
    await tx.done
  }
  if (data.settings) await saveSettings(mergeIncomingSettings(data.settings, await getSettings()))
}

// ─── Movimientos fijos ────────────────────────────────────────────────────────
// Unificación (decisión de Walter, 08-oct-2026): cada suscripción y cada deuda
// con cuota tiene su regla en 'recurring'. Corre al hidratar y después de cada
// cambio de suscripción/deuda. Lee y escribe en UNA transacción: si algo falla,
// no queda nada a medias, y la próxima pasada reintenta. Idempotente (ver
// utils/recurringSources.test.js): sin cambios de origen, no escribe nada.
// La foto previa de los datos la deja la migración v4 (migrations.js).
export async function reconcileRecurringSources({ today = localDateStr(), now = new Date().toISOString() } = {}) {
  const db = await getDB()
  if (!db) {
    const upserts = reconcileRules(lsGet('recurring'), lsGet('subscriptions'), lsGet('debts'), { today, now })
    upserts.forEach(r => lsPut('recurring', r))
    return upserts
  }
  const tx = db.transaction(['recurring', 'subscriptions', 'debts'], 'readwrite')
  const [rules, subs, debts] = await Promise.all([
    tx.objectStore('recurring').getAll(), tx.objectStore('subscriptions').getAll(), tx.objectStore('debts').getAll(),
  ])
  const upserts = reconcileRules(rules, subs, debts, { today, now })
  for (const r of upserts) await tx.objectStore('recurring').put(r)
  await tx.done
  return upserts
}

// Confirma ocurrencias (una o "Confirmar todos") en UNA transacción. Cada ítem:
// { rule, date, amount? }. Idempotente: si ya existe un registro de esa
// ocurrencia (mismo id determinista, o cualquiera con ese recurringId +
// occurrenceDate) no se crea otro ni se vuelve a bajar el saldo de la deuda.
// Para reglas de deuda reusa la lógica de "Registrar pago": crea el gasto Y
// baja el saldo (utils/debtPayment.js). Devuelve { records, debts } creados.
export async function confirmOccurrencesInDb(items, { today = localDateStr(), now = new Date().toISOString() } = {}) {
  const list = (items || []).filter(it => it && it.rule && it.date)
  if (!list.length) return { records: [], debts: [] }
  const db = await getDB()
  const outRecords = [], outDebts = []

  const plan = (existing, debtsById) => {
    const seen = new Set(existing.filter(r => r?.recurringId && r?.occurrenceDate).map(r => `${r.recurringId}|${r.occurrenceDate}`))
    const ids = new Set(existing.map(r => r?.id))
    const writes = []
    for (const { rule, date, amount } of list) {
      const key = `${rule.id}|${date}`
      if (seen.has(key) || ids.has(occurrenceRecordId(rule.id, date))) continue
      seen.add(key)
      let amt = amount
      let debt = null
      if (rule.source === 'debt' && rule.sourceId && debtsById.has(rule.sourceId)) {
        const res = applyDebtPayment(debtsById.get(rule.sourceId), amount)
        debt = res.debt; amt = res.amount
        debtsById.set(debt.id, debt)
      }
      if (rule.source === 'debt' && !(Number(amt) > 0) && amount == null) continue
      const record = buildConfirmedRecord(rule, date, { amount: amt, today, createdAt: now })
      writes.push({ store: rule.kind === 'income' ? 'incomes' : 'expenses', record, debt })
    }
    return writes
  }

  if (!db) {
    const existing = [...lsGet('incomes'), ...lsGet('expenses')]
    const debtsById = new Map(lsGet('debts').map(d => [d.id, d]))
    for (const w of plan(existing, debtsById)) {
      lsPut(w.store, w.record); outRecords.push(w.record)
      if (w.debt) { lsPut('debts', w.debt); outDebts.push(w.debt) }
    }
    return { records: outRecords, debts: outDebts }
  }

  const tx = db.transaction(['incomes', 'expenses', 'debts'], 'readwrite')
  const [inc, exp, debts] = await Promise.all([
    tx.objectStore('incomes').getAll(), tx.objectStore('expenses').getAll(), tx.objectStore('debts').getAll(),
  ])
  const debtsById = new Map(debts.map(d => [d.id, d]))
  for (const w of plan([...inc, ...exp], debtsById)) {
    await tx.objectStore(w.store).put(w.record); outRecords.push(w.record)
    if (w.debt) { await tx.objectStore('debts').put(w.debt); outDebts.push(w.debt) }
  }
  await tx.done
  return { records: outRecords, debts: outDebts }
}

// ─── Copias locales de seguridad ('backups') ─────────────────────────────────
// Solo metadatos (sin los datos) para mostrar en Ajustes.
export async function listSnapshots() {
  try {
    const all = await dbGetAll('backups')
    return (all || []).map(({ id, reason, createdAt, fromVersion, data }) => ({
      id, reason, createdAt, fromVersion,
      counts: Object.fromEntries(Object.entries(data || {}).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, v.length])),
    }))
  } catch { return [] }
}

// Vuelve los datos al estado de la foto (por defecto, la previa a los fijos).
// Las reglas se vacían: las de Suscripciones/Deudas se regeneran solas.
export async function restoreSnapshot(id = PRE_RECURRING_SNAPSHOT_ID) {
  const db = await getDB()
  const snap = db ? await db.get('backups', id) : lsGet('backups').find(b => b.id === id)
  if (!snap?.data) throw new Error('snapshot_not_found')
  const { settings, ...rest } = snap.data
  await importAllData({ ...rest, recurring: [], ...(settings ? { settings } : {}) })
  return snap
}
