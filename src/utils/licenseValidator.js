// src/utils/licenseValidator.js
// VALIDADOR v2.0 — Supabase. ACTIVO en producción (lo usan App.jsx, LicenseGate, Settings).
import { licenseKeyHash } from './syncCrypto.js'
import { authClient } from '../core/authClient.js'
// Valida la clave contra la RPC `validate_license` de Supabase y cachea en localStorage
// (fnos_license_v2). VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY están en Vercel.
//
// Características:
//   - bypass offline cerrado (sin red, solo acepta la clave si coincide con la cacheada)
//   - sin migración v1→v2 (deslogueaba usuarios activos) → ahora migra fnos_license_v1 → fnos_license_v2

const LS_V2 = 'fnos_license_v2'
const LS_V1 = 'fnos_license_v1'
const REVALIDATE_MS = 7 * 24 * 60 * 60 * 1000 // re-valida online cada 7 días
const KEY_RE = /^FNOS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

// Stripe Payment Link (Live) — cuenta propia MOY IQ (acct_1UEffP2L52ZuuTMr,
// separada de la cuenta compartida Maxnova Luci el 12-sep-2026). Pro mensual;
// el anual (US$39.99) se ofrece en moyiq.app/#pricing. Usado por LicenseGate
// y por el CTA de upgrade en Settings — un solo lugar para no desincronizar.
export const PRO_CHECKOUT_URL = 'https://buy.stripe.com/6oU9AM8Ht3aggzi8qZfnO00'

function readCache()  { try { return JSON.parse(localStorage.getItem(LS_V2) || 'null') } catch { return null } }
function writeCache(o) { try { localStorage.setItem(LS_V2, JSON.stringify(o)) } catch {} }

// Sin esto, una llamada colgada (red rara, Supabase caído) deja a quien la
// espera sin resolver nunca — App.jsx usa el resultado para decidir si
// mostrar la app, y sin timeout el usuario ve pantalla en blanco para
// siempre. Resuelve a `null` (mismo criterio en los dos call sites de abajo:
// "no sabemos" en vez de colgar) sin abortar la promesa original, que sigue
// corriendo en segundo plano por si el caller igual la usa (p.ej. writeCache
// en isLicenseActive, que no espera este helper).
function withTimeout(promiseLike, ms) {
  const timeout = new Promise(resolve => setTimeout(() => resolve(null), ms))
  return Promise.race([promiseLike, timeout])
}

// Migración v1 → v2 (no desloguear a quien ya activó en v1.x offline)
;(function migrateV1() {
  try {
    if (localStorage.getItem(LS_V2)) return
    const old = localStorage.getItem(LS_V1)
    if (old) writeCache({ key: old.trim().toUpperCase(), plan: 'personal', ts: 0 }) // ts:0 → revalida online pronto
  } catch {}
})()

async function verifyOnline(key) {
  if (!SUPABASE_URL || !SUPABASE_ANON) return { offline: true }
  try {
    const res = await withTimeout(fetch(`${SUPABASE_URL}/rest/v1/rpc/validate_license`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_key: await licenseKeyHash(key) }),
    }), 10000)
    if (!res) return { offline: true } // timeout: mismo criterio que el catch de abajo, tratar como sin red
    if (!res.ok) return { offline: true, httpError: res.status } // RPC 404 / red → tratar como offline
    const data = await res.json()
    if (data && data.valid) return { valid: true, plan: data.plan || 'personal', exp: data.expires_at ? Number(data.expires_at) : null }
    return { valid: false }
  } catch { return { offline: true } }
}

// Activación: el usuario ingresa una clave (LicenseGate)
export async function validateLicense(key) {
  if (!key) return false
  const clean = key.trim().toUpperCase()
  if (!KEY_RE.test(clean)) return false

  const r = await verifyOnline(clean)
  if (r.valid) { writeCache({ key: clean, plan: r.plan, exp: r.exp ?? null, ts: Date.now() }); return true }
  if (r.offline) {
    // Sin red / RPC caída: aceptar SOLO si coincide con la clave ya activada (no "hay cualquier cache")
    const c = readCache()
    return !!(c && c.key === clean)
  }
  return false // online respondió: clave inválida
}

// ¿Hay sesión activa? (App.jsx la usa en init — debe ser SÍNCRONA)
export function isLicenseActive() {
  const c = readCache()
  if (!c || !c.key) return false
  // Expiración (licencias de prueba): si venció, desloguear de inmediato — sin llamar al server
  if (c.exp && Date.now() > c.exp) { clearLicense(); return false }
  // Re-validación silenciosa en background si venció el TTL (no bloquea el arranque)
  if (Date.now() - (c.ts || 0) > REVALIDATE_MS) {
    verifyOnline(c.key).then(r => {
      if (r.valid) writeCache({ key: c.key, plan: r.plan, exp: r.exp ?? null, ts: Date.now() })
      else if (r.valid === false) clearLicense() // revocada o vencida → desloguear
      // offline: dejar la cache como está
    }).catch(() => {})
  }
  return true
}

export function saveLicense(_key) {}                       // no-op: validateLicense persiste
export function getLicenseKey()  { return readCache()?.key  || '' }
export function getLicensePlan() { return readCache()?.plan || 'starter' }
export function clearLicense()   { try { localStorage.removeItem(LS_V2) } catch {} }

// Starter (gratis, sin clave): un flag propio, separado de fnos_license_v2 a
// propósito — isLicenseActive() exige un `key` real y no debe empezar a
// aceptar "sin clave" como sesión válida, eso rompería la semántica de
// "licencia activa" para todo lo que ya la usa. LicenseGate llama a esto
// cuando el usuario elige "Empezar gratis" en vez de comprar o activar.
const LS_STARTER = 'fnos_starter_ack'
export function isStarterAcknowledged() { try { return localStorage.getItem(LS_STARTER) === '1' } catch { return false } }
export function acknowledgeStarter()    { try { localStorage.setItem(LS_STARTER, '1') } catch {} }
export function clearStarterAck()       { try { localStorage.removeItem(LS_STARTER) } catch {} }

// Asocia un email a la licencia activa (best-effort: no bloquea la activación si falla).
// Se usa en el momento de activar la clave, para poder contactar al cliente
// (avisos de vencimiento en pruebas, novedades, soporte).
export async function setLicenseEmail(email) {
  const clean = String(email || '').trim()
  if (!clean || !SUPABASE_URL || !SUPABASE_ANON) return false
  const key = getLicenseKey()
  if (!key) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/set_license_email`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_key: await licenseKeyHash(key), p_email: clean }),
    })
    if (!res.ok) return false
    const data = await res.json()
    return !!(data && data.ok)
  } catch { return false }
}

// Registra el email de quien elige Starter (best-effort: no bloquea la
// activación si falla). Starter no tiene clave, así que no puede pasar por
// setLicenseEmail — sin esto, nadie que arranca gratis quedaba registrado.
export async function registerStarterLead(email) {
  const clean = String(email || '').trim()
  if (!clean || !SUPABASE_URL || !SUPABASE_ANON) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/register_starter_lead`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_email: clean }),
    })
    if (!res.ok) return false
    const data = await res.json()
    // Mismo patrón que diagnostico.html: si el registro devolvió id, se
    // dispara el email 1 (bienvenida) de la secuencia de nurture de Starter
    // sin bloquear la activación — best-effort, nunca puede tumbar el flujo
    // de "Empezar gratis". Sin esto el gap era real: el cron (ver
    // 20260918000500) solo manda los emails 2/3, nunca el 1.
    if (data && data.ok && data.id) {
      fetch(`${SUPABASE_URL}/functions/v1/send-nurture-starter-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'welcome', leadId: data.id }),
      }).catch(() => {})
    }
    return !!(data && data.ok)
  } catch { return false }
}

// Registra el lead del gate de demo (email + nombre, ver DemoGate.jsx).
// Best-effort: si falla, DemoGate deja pasar igual — el gate es para
// capturar el lead, no para bloquear a nadie por un problema de red.
export async function registerDemoLead(email, nombre, consentMarketing) {
  const cleanEmail = String(email || '').trim()
  const cleanNombre = String(nombre || '').trim()
  if (!cleanEmail || !cleanNombre || !SUPABASE_URL || !SUPABASE_ANON) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/register_demo_lead`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_email: cleanEmail,
        p_nombre: cleanNombre,
        p_consent_marketing: !!consentMarketing,
      }),
    })
    if (!res.ok) return false
    const data = await res.json()
    return !!(data && data.ok)
  } catch { return false }
}

// ── Entitlement por cuenta (user_entitlements) ──────────────────────────
// El login es obligatorio desde el 12-sep-2026, pero Starter/Pro seguían
// viviendo solo en localStorage (arriba) — por dispositivo, no por cuenta.
// Estas dos funciones sincronizan la elección de plan contra la cuenta
// autenticada (authClient, con el JWT real del usuario — no el anon key
// suelto que usa el resto de este archivo) para que un login en un
// dispositivo nuevo no vuelva a preguntar. Best-effort: si fallan, el
// usuario simplemente ve LicenseGate como si fuera la primera vez.
export async function getServerEntitlement(userId) {
  if (!authClient || !userId) return null
  try {
    const result = await withTimeout(
      authClient.from('user_entitlements').select('plan, license_key').eq('user_id', userId).maybeSingle(),
      8000
    )
    if (!result) return null // timeout: no sabemos el entitlement, App.jsx lo trata como "sin plan todavía"
    const { data, error } = result
    if (error || !data) return null
    return data
  } catch { return null }
}

export async function setServerEntitlement(userId, plan, licenseKey) {
  if (!authClient || !userId) return false
  try {
    const { error } = await authClient
      .from('user_entitlements')
      .upsert({ user_id: userId, plan, license_key: licenseKey || null, updated_at: new Date().toISOString() })
    return !error
  } catch { return false }
}

// Borra el entitlement de la cuenta (no solo el local storage del
// dispositivo). Necesario para que "Desactivar licencia" en Settings
// funcione de verdad — sin esto, el useEffect de sincronización de App.jsx
// repone el plan viejo desde el servidor antes de que el usuario llegue a
// ver LicenseGate. Requiere la policy DELETE de user_entitlements.
export async function clearServerEntitlement(userId) {
  if (!authClient || !userId) return false
  try {
    const { error } = await authClient.from('user_entitlements').delete().eq('user_id', userId)
    return !error
  } catch { return false }
}
