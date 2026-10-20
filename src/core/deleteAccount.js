// src/core/deleteAccount.js — borrado de la cuenta por autoservicio
// (auditoría 360, C-22 / SEG-5). La Edge Function delete-account borra todo lo
// que el servidor guarda de la cuenta (las dos apps: MOY IQ e Invest) y la
// cuenta de Auth. Después, este dispositivo borra lo local de ESA cuenta (su
// base IndexedDB y sus claves): nunca lo de otra cuenta del mismo navegador.
import { closeDB } from './db/index.js'
import {
  isAccountKey, dbNameFor, readDeviceOwner, readLegacyUid,
  OWNER_KEY, LEGACY_KEY, VAULT_PREFIX,
} from './deviceOwner.js'

export const CONFIRM_WORD = 'DELETE'

function functionsUrl() {
  return (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '') + '/functions/v1/delete-account'
}

// Errores: session_required · confirmation_required · data_delete_failed ·
// auth_delete_failed · network · http_<status>.
export async function requestAccountDeletion(accessToken, fetchImpl = fetch) {
  if (!accessToken) return { ok: false, error: 'session_required' }
  let res
  try {
    res = await fetchImpl(functionsUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ confirm: CONFIRM_WORD }),
    })
  } catch {
    return { ok: false, error: 'network' }
  }
  let body = null
  try { body = await res.json() } catch { body = null }
  if (res.ok && body?.ok === true) return { ok: true }
  return { ok: false, error: (body && typeof body.error === 'string' && body.error) || `http_${res.status}` }
}

function deleteDatabase(name) {
  return new Promise((resolve) => {
    try {
      const r = indexedDB.deleteDatabase(name)
      r.onsuccess = r.onerror = r.onblocked = () => resolve()
    } catch { resolve() }
  })
}

function clearAccountKeys(uid, active, legacyUid) {
  try {
    if (active) {
      const keys = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (isAccountKey(k)) keys.push(k)
      }
      for (const k of keys) localStorage.removeItem(k)
      localStorage.removeItem(OWNER_KEY)
    }
    localStorage.removeItem(VAULT_PREFIX + uid)
    if (legacyUid === uid) localStorage.removeItem(LEGACY_KEY)
  } catch { /* sin acceso a localStorage: no hay claves locales que borrar */ }
}

// Borra del dispositivo lo de la cuenta uid (que acaba de dejar de existir).
// La base 'financeos' histórica solo se borra si era de esta cuenta. Las claves
// se vuelven a limpiar al descargar la página: entre el borrado y la recarga
// la app todavía montada puede escribir alguna (p. ej. fnos_sync_meta), y la
// heredaría la próxima cuenta que entre en este navegador.
export async function wipeAccountFromDevice(uid) {
  if (!uid) return
  const owner = readDeviceOwner()
  const legacyUid = readLegacyUid()
  const active = owner?.uid === uid
  closeDB()
  clearAccountKeys(uid, active, legacyUid)
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('pagehide', () => clearAccountKeys(uid, active, legacyUid), { once: true })
  }
  if (typeof indexedDB !== 'undefined') await deleteDatabase(dbNameFor(uid, legacyUid))
}
