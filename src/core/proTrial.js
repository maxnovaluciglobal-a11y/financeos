// src/core/proTrial.js — 14 días de Pro sin tarjeta (modelo A, 26-nov-2026).
//
// El servidor manda (migración 20261126000000_reverse_trial.sql): la prueba es
// una licencia Pro con vencimiento que emite start_pro_trial() para la cuenta de
// la sesión, y pro_trial_status() dice si la cuenta puede empezarla, si está en
// curso o si ya terminó. Acá solo se guarda lo que la app necesita para sus
// avisos (oferta después del onboarding, días 10 y 13, vuelta a Starter) y qué
// herramientas de Pro abrió la persona durante la prueba. Ningún dato de este
// archivo abre Pro: lo abre la licencia validada (licenseValidator.js).
//
// La clave fos_pro_trial_v1 es de la cuenta (core/deviceOwner.js la guarda y la
// restaura al cambiar de cuenta), nunca del dispositivo.
import { useSyncExternalStore } from 'react'
import { authClient } from './authClient.js'
import { validateLicense, acknowledgeStarter, getLicenseKey, clearLicense, getServerEntitlement, hasProEntitlement, getLicenseInfo } from '../utils/licenseValidator.js'

export const TRIAL_STATE_KEY = 'fos_pro_trial_v1'
export const TRIAL_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000
const EVENT = 'fnos:pro-trial'

// Pantallas de Pro que cuentan como "usaste" en el resumen de los días 10 y 13.
export const TRIAL_FEATURE_PAGES = Object.freeze({
  advisor: 'advisor',
  cashflow: 'cashflow',
  projects: 'projects',
  reports: 'reports',
  apv: 'country', hipoteca: 'country', ppr: 'country', deducciones: 'country', ahorrofiscal: 'country',
  inflacion: 'country', resico: 'country', multidolar: 'country', irpfes: 'country', irspt: 'country',
  multimoneda: 'country', steuer: 'country',
})
// Orden fijo del resumen (y de la lista de la oferta).
export const TRIAL_FEATURES = Object.freeze(['sync', 'push', 'advisor', 'reports', 'cashflow', 'debtSim', 'country', 'projects'])

function storage() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null }
}

const EMPTY = Object.freeze({ status: null, seen: {}, used: [] })

export function readTrialState(store = storage()) {
  try {
    const raw = store?.getItem(TRIAL_STATE_KEY)
    const v = raw ? JSON.parse(raw) : null
    if (!v || typeof v !== 'object') return EMPTY
    return {
      status: v.status && typeof v.status === 'object' ? v.status : null,
      seen: v.seen && typeof v.seen === 'object' ? v.seen : {},
      used: Array.isArray(v.used) ? v.used.filter(f => TRIAL_FEATURES.includes(f)) : [],
    }
  } catch { return EMPTY }
}

let cached = null
function writeTrialState(state, store = storage()) {
  try { store?.setItem(TRIAL_STATE_KEY, JSON.stringify(state)) } catch { /* sin almacenamiento: los avisos se repiten, nada más */ }
  cached = null
  try { if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT)) } catch { /* sin window */ }
  return state
}

// Respuesta de pro_trial_status / start_pro_trial → estado guardado (sin la clave).
export function normalizeStatus(r) {
  if (!r || r.ok !== true) return null
  return {
    eligible: r.eligible === true,
    active: r.active === true,
    ended: r.ended === true,
    converted: r.converted === true,
    startedAt: Number(r.started_at) || null,
    endsAt: Number(r.ends_at) || null,
  }
}

// Día de la prueba (1 = el día en que empezó).
export function trialDay(startedAt, now = Date.now()) {
  if (!startedAt) return 0
  return Math.floor((now - startedAt) / DAY_MS) + 1
}

export function trialDaysLeft(endsAt, now = Date.now()) {
  if (!endsAt) return 0
  return Math.max(0, Math.ceil((endsAt - now) / DAY_MS))
}

// Qué aviso toca ahora (uno a la vez), o null.
//  - 'offer': la cuenta puede empezar la prueba y no respondió la hoja (solo web).
//  - 'day10' / 'day13': recordatorio con lo que usó de Pro (solo web: hablan de
//    comprar Pro).
//  - 'ended': la prueba terminó sin compra (también en la app de tienda, sin
//    precios ni enlaces).
export function dueTrialNotice(state, { now = Date.now(), web = true } = {}) {
  const st = state?.status
  const seen = state?.seen || {}
  if (!st) return null
  if (st.eligible && web && !seen.offer) return 'offer'
  if (st.active && web && st.startedAt && st.endsAt) {
    const d = trialDay(st.startedAt, now)
    if (d >= 13 && !seen.day13) return 'day13'
    if (d >= 10 && d < 13 && !seen.day10) return 'day10'
  }
  if (st.ended && !st.converted && st.startedAt && !seen.ended) return 'ended'
  return null
}

export function markTrialNoticeSeen(kind, store = storage()) {
  const cur = readTrialState(store)
  // Ver el del día 13 también da por visto el del 10 (no se muestran los dos).
  const extra = kind === 'day13' ? { day10: true } : {}
  return writeTrialState({ ...cur, seen: { ...cur.seen, ...extra, [kind]: true } }, store)
}

// Abrió una herramienta de Pro durante la prueba: queda en el resumen.
export function markTrialFeatureUsed(featureOrPage, store = storage()) {
  const cur = readTrialState(store)
  if (!cur.status?.active) return cur
  const f = TRIAL_FEATURES.includes(featureOrPage) ? featureOrPage : TRIAL_FEATURE_PAGES[featureOrPage]
  if (!f || cur.used.includes(f)) return cur
  return writeTrialState({ ...cur, used: [...cur.used, f] }, store)
}

async function defaultRpc(fn) {
  if (!authClient) return null
  const call = authClient.rpc(fn)
  const timeout = new Promise(resolve => setTimeout(() => resolve(null), 8000))
  const res = await Promise.race([call, timeout])
  if (!res || res.error) return null
  return res.data
}

// Una vez por sesión, con la cuenta ya confirmada en este dispositivo
// (App.jsx). Devuelve { status, changed }: changed = el plan de este
// dispositivo cambió (tomó la prueba empezada en otro, o la soltó al vencer).
export async function refreshProTrial({ userId = null, rpc = defaultRpc, validate = validateLicense, entitlement = getServerEntitlement, store = storage() } = {}) {
  let r = null
  try { r = await rpc('pro_trial_status') } catch { r = null }
  const status = normalizeStatus(r)
  if (!status) return { status: null, changed: false }
  const cur = readTrialState(store)
  writeTrialState({ ...cur, status }, store)

  let changed = false
  if (status.converted) {
    // B1: compró Pro (en otro dispositivo o en la web). Se decide por el estado del
    // servidor, no por lo que hay guardado acá: este dispositivo puede haber
    // soltado ya la licencia de prueba (venció en la caché) y quedar en Starter.
    // Si todavía no tiene la pagada, se toma la de la cuenta. Si esa consulta
    // falla, no se toca nada: la próxima sesión vuelve a intentar.
    if (!hasProEntitlement() || getLicenseInfo()?.noCard) {
      const ent = userId ? await entitlement(userId) : null
      if (ent?.plan === 'pro' && ent.license_key && await validate(ent.license_key)) { acknowledgeStarter(); changed = true }
    }
  } else if (status.active && r.license_key && getLicenseKey() !== r.license_key) {
    // Empezó la prueba en otro dispositivo: misma credencial de la cuenta.
    if (await validate(r.license_key)) { acknowledgeStarter(); changed = true }
  } else if (!status.active && getLicenseInfo()?.noCard) {
    // La prueba terminó sin compra: Starter.
    clearLicense()
    acknowledgeStarter()
    changed = true
  }
  return { status, changed }
}

// ¿La cuenta de la sesión puede empezar la prueba? Solo para mostrar o no la
// pista de LicenseGate; no toca la licencia de este dispositivo.
export async function fetchTrialEligibility({ rpc = defaultRpc } = {}) {
  let r = null
  try { r = await rpc('pro_trial_status') } catch { r = null }
  return r?.ok === true && r.eligible === true
}

// La persona aceptó la oferta. El servidor decide si puede y pone las fechas.
export async function startProTrial({ rpc = defaultRpc, validate = validateLicense, store = storage() } = {}) {
  let r = null
  try { r = await rpc('start_pro_trial') } catch { r = null }
  if (!r || r.ok !== true || !r.license_key) return { ok: false, error: r?.error || 'network' }
  if (!(await validate(r.license_key))) return { ok: false, error: 'validate' }
  // Si algún día la licencia de prueba no está, la app cae a Starter (no a la
  // pantalla de elegir plan).
  acknowledgeStarter()
  const cur = readTrialState(store)
  writeTrialState({
    ...cur,
    status: { eligible: false, active: true, ended: false, converted: false, startedAt: Number(r.started_at) || Date.now(), endsAt: Number(r.ends_at) || null },
    seen: { ...cur.seen, offer: true },
  }, store)
  return { ok: true, endsAt: Number(r.ends_at) || null }
}

// "Seguir con Starter": la hoja no vuelve; la prueba sigue disponible desde Pro.
export function declineProTrial(store = storage()) {
  return markTrialNoticeSeen('offer', store)
}

function subscribe(cb) {
  if (typeof window === 'undefined') return () => {}
  const onChange = () => { cached = null; cb() }
  window.addEventListener(EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener('storage', onChange) }
}
function snapshot() {
  if (!cached) cached = readTrialState()
  return cached
}
export function useProTrial() {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY)
}
