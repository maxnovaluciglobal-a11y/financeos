// src/core/db/index.js — wiring de IndexedDB. Los pasos de esquema versionados
// viven en ./migrations.js (ver ahí antes de tocar DB_VERSION).

import { openDB } from 'idb'
import { DB_VERSION, runMigrations } from './migrations.js'
import { currentMonth } from '../../utils/index.js'

const DB_NAME = 'financeos'
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

export async function getSettings() {
  const db = await getDB()
  let saved = null
  if (!db) { try { saved = JSON.parse(localStorage.getItem('fos_settings')) } catch {} }
  else      { saved = await db.get('settings', SETTINGS_KEY) }
  return { ...DEFAULT_SETTINGS, ...(saved || {}) }
}

export async function saveSettings(settings) {
  const db = await getDB()
  if (!db) { try { localStorage.setItem('fos_settings', JSON.stringify(settings)) } catch {} }
  else     { await db.put('settings', settings, SETTINGS_KEY) }
  return settings
}

// ─── clearAllData ─────────────────────────────────────────────────────────────
export async function clearAllData() {
  const stores = ['incomes', 'expenses', 'budgets', 'debts', 'goals', 'subscriptions', 'importBatches']
  const db = await getDB()
  if (!db) { stores.forEach(lsClear); return }
  const tx = db.transaction(stores, 'readwrite')
  await Promise.all(stores.map(s => tx.objectStore(s).clear()))
  await tx.done
}

// ─── Export / Import ──────────────────────────────────────────────────────────
export async function exportAllData() {
  const [incomes, expenses, budgets, debts, goals, subscriptions, settings] = await Promise.all([
    dbGetAll('incomes'), dbGetAll('expenses'), dbGetAll('budgets'),
    dbGetAll('debts'),   dbGetAll('goals'),   dbGetAll('subscriptions'), getSettings(),
  ])
  let importBatches = []
  try { importBatches = await dbGetAll('importBatches') } catch {}
  return { incomes, expenses, budgets, debts, goals, subscriptions, importBatches, settings,
           exportedAt: new Date().toISOString(), version: '1.2' }
}

export async function importAllData(data) {
  if (!data || typeof data !== 'object') throw new Error('Formato inválido')
  const stores = ['incomes', 'expenses', 'budgets', 'debts', 'goals', 'subscriptions', 'importBatches']
  const db = await getDB()
  if (!db) {
    stores.forEach(lsClear)
    for (const store of stores) if (Array.isArray(data[store])) lsSet(store, data[store])
  } else {
    // Clear + repoblado en UNA sola transacción que abarca las 7 stores: si algo
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
  if (data.settings) await saveSettings(data.settings)
}
