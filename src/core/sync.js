// src/core/sync.js
// Sincronización opcional entre dispositivos, ligada a la licencia y a la cuenta.
// - Identidad: hash de la licencia + sesión de la cuenta dueña (RPC sync_*).
// - Cifrado en el dispositivo (utils/syncCrypto.js), dos modelos:
//     v2 (D-05, desde el 20-oct-2026): frase de paso + PBKDF2. El servidor no
//        puede derivar la llave. Es el único modelo para activar el sync desde
//        cero, y al que se pasa con migrateToPassphrase() (opt-in).
//     v1: llave derivada de la clave de licencia. Se sigue leyendo y subiendo
//        para quien no migró ("el camino viejo funciona hasta que migra").
// - Estrategia: última edición gana (por timestamp de cambio local), con dos
//   protecciones: un blob que este dispositivo no puede descifrar NUNCA se pisa
//   (antes se subía lo local encima), y un dispositivo que nunca sincronizó y
//   está vacío siempre toma lo remoto.
// - Antes de aplicar datos remotos se guarda un respaldo local automático.
// Diseño, migración y rollback: docs/sync-frase-de-paso.md.

import { exportAllData, importAllData, DATA_STORES } from './db/index.js'
import { getLicenseKey } from '../utils/licenseValidator.js'
import {
  encryptData, decryptData, licenseKeyHash, LICENSE_HASH_RE,
  isV2Blob, parseV2Envelope, deriveV2KeyBytes, encryptV2, decryptV2, newV2Salt,
  bytesToB64, b64ToBytes, V2_ITERATIONS, MIN_PASSPHRASE_LENGTH, normalizePassphrase,
} from '../utils/syncCrypto.js'
import { authClient } from './authClient.js'
import { logClientError } from '../utils/errorLog.js'

const env = () => ({ url: import.meta.env.VITE_SUPABASE_URL, anon: import.meta.env.VITE_SUPABASE_ANON_KEY })

const LS_ON       = 'fnos_sync_on'
const LS_META     = 'fnos_sync_meta'          // { lastLocalChange, lastPushedAt, lastPulledAt }
const LS_BACKUP   = 'fnos_presync_backup'     // red de seguridad antes de aplicar remoto
const LS_V2       = 'fnos_sync_v2'            // { k, s, i }: llave v2 de este dispositivo
const LS_ROLLBACK = 'fnos_sync_v1_rollback'   // { blob, updatedAt, savedAt }: copia v1 previa a migrar

let pushTimer = null

// ── estado / meta ─────────────────────────────────────────────────────────────
const lsGet = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const lsSet = (k, v) => { try { localStorage.setItem(k, v) } catch { /* almacenamiento o API del navegador no disponible: se sigue sin ello */ } }
const lsDel = (k) => { try { localStorage.removeItem(k) } catch { /* almacenamiento o API del navegador no disponible: se sigue sin ello */ } }
const lsJSON = (k) => { try { return JSON.parse(lsGet(k) || 'null') } catch { return null } }

export function isSyncEnabled() { return lsGet(LS_ON) === '1' }
export function setSyncEnabled(on) { lsSet(LS_ON, on ? '1' : '0') }
export function syncMeta() { return lsJSON(LS_META) || {} }
function writeMeta(patch) { lsSet(LS_META, JSON.stringify({ ...syncMeta(), ...patch })) }
export function syncAvailable() {
  const { url, anon } = env()
  return !!(url && anon && getLicenseKey())
}

function v2Key() {
  const v = lsJSON(LS_V2)
  if (!v || typeof v.k !== 'string' || typeof v.s !== 'string' || !Number.isInteger(v.i)) return null
  try { return { key: b64ToBytes(v.k), salt: b64ToBytes(v.s), iterations: v.i } } catch { return null }
}
function storeV2Key(key, salt, iterations) {
  lsSet(LS_V2, JSON.stringify({ k: bytesToB64(key), s: bytesToB64(salt), i: iterations }))
}
export function syncMode() { return v2Key() ? 'v2' : 'v1' }
export function hasRollbackSnapshot() { return !!lsJSON(LS_ROLLBACK)?.blob }
// La llave v1 sale de la clave de licencia cruda; si el dispositivo solo tiene
// el hash (la cuenta lo devolvió así), no hay llave v1.
function rawLicenseKey() {
  const k = getLicenseKey()
  return k && !LICENSE_HASH_RE.test(k) ? k : null
}

// Las RPC de sync exigen la sesión de la cuenta (18-oct-2026).
async function accessToken() {
  const { data } = (await authClient?.auth.getSession()) || {}
  const token = data?.session?.access_token
  if (!token) throw new Error('no_session')
  return token
}

async function rpc(fn, body) {
  const { url, anon } = env()
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${fn} ${res.status}`)
  return res.json()
}

async function keyHash() { return licenseKeyHash(getLicenseKey()) }

async function remoteRaw() {
  const r = await rpc('sync_pull', { p_key: await keyHash() })
  if (!r || !r.ok) throw new Error(r?.error || 'pull_failed')
  if (r.empty || !r.blob) return { empty: true }
  return { blob: r.blob, updatedAt: Number(r.updated_at) || 0 }
}

async function rawPush(blob, updatedAt) {
  const r = await rpc('sync_push', { p_key: await keyHash(), p_blob: blob, p_updated_at: updatedAt })
  if (!(r && r.ok)) throw new Error(r?.error || 'push_failed')
}

// Descifra lo remoto con lo que este dispositivo tiene. Nunca lanza por un blob
// ajeno: devuelve { blocked } para que nadie lo pise.
async function decodeRemote(raw) {
  if (isV2Blob(raw.blob)) {
    const k = v2Key()
    if (!k) return { blocked: 'passphrase_required' }
    try { return { payload: await decryptV2(raw.blob, k.key, { minIterations: Math.min(k.iterations, V2_ITERATIONS) }) } } catch (e) { return { blocked: e.message === 'wrong_key' ? 'wrong_key' : 'corrupt' } }
  }
  const lic = rawLicenseKey()
  if (!lic) return { blocked: 'license_key_required' }
  try { return { payload: await decryptData(raw.blob, lic) } } catch { return { blocked: 'undecryptable' } }
}

async function encodeLocal(payload) {
  const k = v2Key()
  if (k) return encryptV2(payload, k.key, k.salt, k.iterations)
  const lic = rawLicenseKey()
  if (!lic) throw new Error('passphrase_required')
  return encryptData(payload, lic)
}

function isEmptyPayload(p) {
  return !p || DATA_STORES.every((s) => !Array.isArray(p[s]) || p[s].length === 0)
}
function countsOf(p) {
  return DATA_STORES.map((s) => (Array.isArray(p?.[s]) ? p[s].length : 0)).join(',')
}

// ── PUSH ──────────────────────────────────────────────────────────────────────
// Antes de subir se mira la nube: si ya tiene una copia con frase de paso que
// este dispositivo no puede abrir (no migró, o la frase/sal cambió en otro
// dispositivo), no se pisa. La UI pide la frase (unlockWithPassphrase).
async function guardRemote() {
  const raw = await remoteRaw()
  if (raw.empty || !isV2Blob(raw.blob)) return
  const k = v2Key()
  let saltB64 = null
  try { saltB64 = parseV2Envelope(raw.blob, { minIterations: 1 }).saltB64 } catch { saltB64 = null }
  if (!k || !saltB64 || bytesToB64(k.salt) !== saltB64) throw new Error('passphrase_required')
}

export async function pushNow() {
  if (!isSyncEnabled() || !syncAvailable()) return { skipped: true }
  await guardRemote()
  const payload = await exportAllData()
  const blob = await encodeLocal(payload)
  const updatedAt = syncMeta().lastLocalChange || Date.now()
  await rawPush(blob, updatedAt)
  writeMeta({ lastPushedAt: updatedAt })
  return { ok: true, updatedAt }
}

// ── PULL (payload remoto descifrado; null si no hay o no se puede leer) ──────
export async function pullNow() {
  if (!syncAvailable()) return null
  const raw = await remoteRaw()
  if (raw.empty) return null
  const d = await decodeRemote(raw)
  if (!d.payload || typeof d.payload !== 'object') return null
  return { payload: d.payload, updatedAt: raw.updatedAt }
}

// ── Marca un cambio local y agenda un push con debounce ───────────────────────
export function markLocalChange() {
  writeMeta({ lastLocalChange: Date.now() })
  if (!isSyncEnabled() || !syncAvailable()) return
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => { pushNow().catch(() => {}) }, 2500)
}

async function applyRemote(remote, onApplied) {
  try { localStorage.setItem(LS_BACKUP, JSON.stringify(await exportAllData())) } catch (e) { logClientError({ type: 'swallowed', message: String(e?.message || e), source: 'sync.preSyncBackup' }) }
  await importAllData(remote.payload)
  writeMeta({ lastLocalChange: remote.updatedAt, lastPulledAt: Date.now(), lastPushedAt: remote.updatedAt })
  if (onApplied) await onApplied()
}

// ── Baja remoto y aplica si corresponde. Backup local antes de aplicar. ───────
// onApplied() debe re-hidratar el estado de la app tras el import.
// Devuelve { applied } o { applied:false, blocked: motivo } (sin tocar la nube).
export async function pullAndApplyIfNewer(onApplied) {
  if (!isSyncEnabled() || !syncAvailable()) return { applied: false }
  const raw = await remoteRaw()
  if (raw.empty) { await pushNow().catch(() => {}); return { applied: false } }
  const d = await decodeRemote(raw)
  if (d.blocked) return { applied: false, blocked: d.blocked }
  const remote = { payload: d.payload, updatedAt: raw.updatedAt }
  const meta = syncMeta()
  const neverSynced = !meta.lastPushedAt && !meta.lastPulledAt
  const localVer = meta.lastLocalChange || 0
  if (remote.updatedAt > localVer || (neverSynced && isEmptyPayload(await exportAllData()))) {
    await applyRemote(remote, onApplied)
    return { applied: true }
  }
  await pushNow().catch(() => {})
  return { applied: false }
}

export async function initialSync(onApplied) {
  return pullAndApplyIfNewer(onApplied)
}

// ── Qué necesita este dispositivo para activar el sync ────────────────────────
// 'new_passphrase'  nube vacía: se crea una frase (v2).
// 'passphrase'      nube con frase: hay que escribirla.
// 'none'            nube v1 que este dispositivo puede leer (camino viejo).
// 'license_key'     nube v1 y el dispositivo solo tiene el hash de la licencia.
export async function syncRequirement() {
  const raw = await remoteRaw()
  if (raw.empty) return v2Key() ? 'none' : 'new_passphrase'
  if (isV2Blob(raw.blob)) return v2Key() ? 'none' : 'passphrase'
  return rawLicenseKey() ? 'none' : 'license_key'
}

function checkPassphrase(p) {
  if (normalizePassphrase(p).length < MIN_PASSPHRASE_LENGTH) throw new Error('passphrase_too_short')
}

// Nube vacía: crea la llave v2 de esta cuenta.
export async function setupPassphrase(passphrase, iterations = V2_ITERATIONS) {
  checkPassphrase(passphrase)
  const raw = await remoteRaw()
  if (!raw.empty) throw new Error('remote_exists')
  const salt = newV2Salt()
  storeV2Key(await deriveV2KeyBytes(passphrase, salt, iterations), salt, iterations)
}

// Nube con frase: deriva la llave con la sal del sobre y la prueba descifrando.
// Con una frase incorrecta no guarda nada y lanza 'wrong_key'.
export async function unlockWithPassphrase(passphrase, opts) {
  const raw = await remoteRaw()
  if (raw.empty || !isV2Blob(raw.blob)) throw new Error('not_v2')
  const env2 = parseV2Envelope(raw.blob, opts)
  const key = await deriveV2KeyBytes(passphrase, env2.salt, env2.iterations)
  await decryptV2(raw.blob, key, opts)
  storeV2Key(key, env2.salt, env2.iterations)
}

// ── Migración v1 → v2 (opt-in) ────────────────────────────────────────────────
// 1. Guarda la copia v1 de la nube tal cual (rollback del servidor).
// 2. Trae lo remoto si es más nuevo (con respaldo local previo).
// 3. Sube lo local cifrado con la frase y lo vuelve a bajar para verificarlo.
// 4. Si la verificación falla, devuelve la copia v1 a la nube y sigue en v1.
// La UI exige antes descargar un respaldo JSON (foto previa).
export async function migrateToPassphrase(passphrase, { onApplied, iterations = V2_ITERATIONS } = {}) {
  checkPassphrase(passphrase)
  if (!isSyncEnabled() || !syncAvailable()) throw new Error('sync_off')
  if (v2Key()) throw new Error('already_v2')
  const raw = await remoteRaw()
  if (!raw.empty) {
    if (isV2Blob(raw.blob)) throw new Error('already_v2')
    if (!rawLicenseKey()) throw new Error('license_key_required')
    lsSet(LS_ROLLBACK, JSON.stringify({ blob: raw.blob, updatedAt: raw.updatedAt, savedAt: Date.now() }))
    const r = await pullAndApplyIfNewer(onApplied)
    if (r.blocked) throw new Error(r.blocked)
  }
  const salt = newV2Salt()
  const key = await deriveV2KeyBytes(passphrase, salt, iterations)
  const local = await exportAllData()
  const updatedAt = Math.max(Date.now(), syncMeta().lastLocalChange || 0)
  await rawPush(await encryptV2(local, key, salt, iterations), updatedAt)
  try {
    const check = await remoteRaw()
    const back = await decryptV2(check.blob, key, { minIterations: Math.min(iterations, V2_ITERATIONS) })
    if (countsOf(back) !== countsOf(local)) throw new Error('verify_failed')
  } catch {
    if (hasRollbackSnapshot()) await restoreV1Snapshot().catch(() => {})
    else if (rawLicenseKey()) await rawPush(await encryptData(local, rawLicenseKey()), updatedAt).catch(() => {})
    throw new Error('verify_failed')
  }
  storeV2Key(key, salt, iterations)
  writeMeta({ lastLocalChange: updatedAt, lastPushedAt: updatedAt })
  return { ok: true }
}

// Devuelve a la nube la copia v1 guardada antes de migrar (solo si existe).
export async function restoreV1Snapshot() {
  const snap = lsJSON(LS_ROLLBACK)
  if (!snap?.blob) throw new Error('no_snapshot')
  await rawPush(snap.blob, snap.updatedAt)
  return { ok: true }
}

// ── Rollback v2 → v1 (a pedido) ───────────────────────────────────────────────
// Sube lo local cifrado otra vez con la llave de la licencia, lo verifica y
// olvida la llave v2 de este dispositivo. Necesita la clave de licencia cruda.
export async function rollbackToLicenseKey() {
  if (!isSyncEnabled() || !syncAvailable()) throw new Error('sync_off')
  const lic = rawLicenseKey()
  if (!lic) throw new Error('license_key_required')
  const local = await exportAllData()
  const updatedAt = Math.max(Date.now(), syncMeta().lastLocalChange || 0)
  await rawPush(await encryptData(local, lic), updatedAt)
  const check = await remoteRaw()
  const back = await decryptData(check.blob, lic)
  if (countsOf(back) !== countsOf(local)) throw new Error('verify_failed')
  lsDel(LS_V2)
  writeMeta({ lastLocalChange: updatedAt, lastPushedAt: updatedAt })
  return { ok: true }
}

// Olvida la llave v2 de este dispositivo (desactivar el sync con frase). No
// toca la nube: otro dispositivo con la frase sigue sincronizando.
export function forgetPassphraseOnDevice() { lsDel(LS_V2) }
