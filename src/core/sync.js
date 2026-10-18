// src/core/sync.js
// Sincronización opcional entre dispositivos, ligada a la licencia.
// - Identidad: derivada de la clave FNOS (RPC valida la licencia server-side).
// - Cifrado E2E: el blob viaja y se guarda cifrado (syncCrypto).
// - Estrategia: última edición gana (por timestamp de cambio local).
// - Seguridad: opt-in (apagado por defecto); antes de aplicar datos remotos se
//   guarda un backup local automático. Si está apagado, TODO es no-op.

import { exportAllData, importAllData } from './db/index.js'
import { getLicenseKey } from '../utils/licenseValidator.js'
import { encryptData, decryptData, licenseKeyHash } from '../utils/syncCrypto.js'
import { authClient } from './authClient.js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

const LS_ON     = 'fnos_sync_on'
const LS_META   = 'fnos_sync_meta'      // { lastLocalChange, lastPushedAt, lastPulledAt }
const LS_BACKUP = 'fnos_presync_backup' // red de seguridad antes de aplicar remoto

let pushTimer = null

// ── estado / meta ─────────────────────────────────────────────────────────────
export function isSyncEnabled() {
  try { return localStorage.getItem(LS_ON) === '1' } catch { return false }
}
export function setSyncEnabled(on) {
  try { localStorage.setItem(LS_ON, on ? '1' : '0') } catch {}
}
export function syncMeta() {
  try { return JSON.parse(localStorage.getItem(LS_META) || '{}') } catch { return {} }
}
function writeMeta(patch) {
  try { localStorage.setItem(LS_META, JSON.stringify({ ...syncMeta(), ...patch })) } catch {}
}
export function syncAvailable() {
  return !!(SUPABASE_URL && SUPABASE_ANON && getLicenseKey())
}

// Las RPC de sync exigen la sesión de la cuenta (18-oct-2026): el servidor
// solo acepta la licencia si está asociada a auth.uid(), así que otra cuenta
// con la misma clave no puede leer ni pisar el respaldo. Sin sesión, no hay sync.
async function accessToken() {
  const { data } = (await authClient?.auth.getSession()) || {}
  const token = data?.session?.access_token
  if (!token) throw new Error('no_session')
  return token
}

async function rpc(fn, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${await accessToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${fn} ${res.status}`)
  return res.json()
}

// ── PUSH ──────────────────────────────────────────────────────────────────────
export async function pushNow() {
  if (!isSyncEnabled() || !syncAvailable()) return { skipped: true }
  const key = getLicenseKey()
  const payload = await exportAllData()
  const blob = await encryptData(payload, key)
  const keyHash = await licenseKeyHash(key)
  const updatedAt = syncMeta().lastLocalChange || Date.now()
  const r = await rpc('sync_push', { p_key: keyHash, p_blob: blob, p_updated_at: updatedAt })
  if (r && r.ok) { writeMeta({ lastPushedAt: updatedAt }); return { ok: true, updatedAt } }
  throw new Error(r?.error || 'push_failed')
}

// ── PULL (devuelve el payload remoto descifrado, o null) ──────────────────────
export async function pullNow() {
  if (!syncAvailable()) return null
  const key = getLicenseKey()
  const keyHash = await licenseKeyHash(key)
  const r = await rpc('sync_pull', { p_key: keyHash })
  if (!r || !r.ok || r.empty || !r.blob) return null
  try {
    const payload = await decryptData(r.blob, key)
    if (!payload || typeof payload !== 'object') return null
    return { payload, updatedAt: Number(r.updated_at) || 0 }
  } catch {
    // Blob no descifrable (ajeno/corrupto): lo ignoramos y dejamos que gane lo local
    return null
  }
}

// ── Marca un cambio local y agenda un push con debounce ───────────────────────
export function markLocalChange() {
  writeMeta({ lastLocalChange: Date.now() })
  if (!isSyncEnabled() || !syncAvailable()) return
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => { pushNow().catch(() => {}) }, 2500)
}

// ── Baja remoto y aplica SOLO si es más nuevo. Backup local antes de aplicar. ──
// onApplied() debe re-hidratar el estado de la app tras el import.
export async function pullAndApplyIfNewer(onApplied) {
  if (!isSyncEnabled() || !syncAvailable()) return { applied: false }
  const remote = await pullNow()
  if (!remote) { await pushNow().catch(() => {}); return { applied: false } } // nube vacía → sube lo local
  const localVer = syncMeta().lastLocalChange || 0
  if (remote.updatedAt > localVer) {
    // Red de seguridad: respaldo de lo local ANTES de sobrescribir
    try { localStorage.setItem(LS_BACKUP, JSON.stringify(await exportAllData())) } catch {}
    await importAllData(remote.payload)
    writeMeta({ lastLocalChange: remote.updatedAt, lastPulledAt: Date.now(), lastPushedAt: remote.updatedAt })
    if (onApplied) await onApplied()
    return { applied: true }
  }
  // Lo local es más nuevo o igual → asegura que la nube quede al día
  await pushNow().catch(() => {})
  return { applied: false }
}

// ── Primer sync al activar: decide dirección por timestamp ────────────────────
export async function initialSync(onApplied) {
  return pullAndApplyIfNewer(onApplied)
}
