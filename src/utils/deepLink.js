// src/utils/deepLink.js — destino que abren los botones de los correos.
//
// Los correos de moyiq (nurture de Starter y del Diagnóstico) enlazan a
// https://app.moyiq.app/app/?open=<destino>&ref=<origen>. La app vive bajo /app/
// y navega por estado, no por ruta, así que el destino viaja en ?open=. Un valor
// desconocido se ignora: la app abre donde abriría sin él. Antes de la auditoría
// 360 (COM-2) esos botones apuntaban a /import, /dashboard, /upgrade y /signup,
// rutas que no existen. El contrato con los correos (supabase/functions/_shared/
// appLinks.ts) y con las redirecciones de vercel.json lo cubre deepLink.test.js.

// ?open=<destino> -> id de página de la app. "upgrade" abre Modo Asesor: para quien
// no es Pro es la pantalla de ProGate (qué incluye Pro, precio y prueba de 14 días).
// "delete-account" (C-22) abre Ajustes con la sección de borrar la cuenta desplegada.
// "plan" abre Ajustes, donde está "Suscripción y plan" (correo de la prueba de Pro).
// Inversiones (F0, 20-nov-2026): "invest" y una por pestaña; la pestaña la lee
// utils/investNav.js (tabFromSearch) y solo cuenta con UI_FLAGS.investFull.
const PAGE_BY_OPEN = {
  import: 'import', dashboard: 'dashboard', upgrade: 'advisor', 'delete-account': 'settings', plan: 'settings',
  invest: 'investments', 'invest-resumen': 'investments', 'invest-portafolio': 'investments', 'invest-siguiendo': 'investments',
  'invest-hoy': 'investments', 'invest-lista': 'investments', // nombres de antes del 20-nov-2026: redirigen
  'invest-planificar': 'investments', 'invest-mercado': 'investments',
  'invest-alertas': 'investments', // Siguiendo › Mi lista con las alertas (aviso push de una alerta de precio)
}

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key)

function openParam(search) {
  try { return new URLSearchParams(search || '').get('open') } catch { return null }
}

// Página a abrir al cargar (la que usa usePersistedPage), o null.
export function pageFromSearch(search) {
  const target = openParam(search)
  return target !== null && hasOwn(PAGE_BY_OPEN, target) ? PAGE_BY_OPEN[target] : null
}

// Pestaña inicial de la pantalla de acceso: "signup" si el enlace pidió crear
// cuenta (?open=signup de los correos, ?signup de los CTA de la landing o
// #signup), "login" en cualquier otro caso.
export function authTabFromSearch(search, hash = '') {
  if (openParam(search) === 'signup' || String(hash || '').toLowerCase() === '#signup') return 'signup'
  try { return new URLSearchParams(search || '').has('signup') ? 'signup' : 'login' } catch { return 'login' }
}

// ?plan=annual|monthly (landing, "Probar 14 días"): período que ProGate
// preselecciona. Cualquier otro valor se ignora.
const PLANS = new Set(['annual', 'monthly'])
export function planParam(search) {
  try { const p = new URLSearchParams(search || '').get('plan'); return PLANS.has(p) ? p : null } catch { return null }
}

// El retorno de Google (OAuth) vuelve a origin + pathname, sin la query: el
// destino de ?open= (y ?plan=) se guarda en sessionStorage antes de salir y se
// recupera en la primera carga de vuelta (APP-N2). Caduca a los 15 minutos.
// El enlace de confirmación del correo de registro (APP-N12) también vuelve
// sin la query y suele abrirse en otra pestaña, donde sessionStorage está
// vacío: ese destino va a localStorage, dura 48 horas y solo se consume en la
// carga que vuelve de Auth (hash con access_token o ?code=).
const OAUTH_OPEN_KEY = 'fnos_oauth_open'
const OAUTH_OPEN_TTL_MS = 15 * 60 * 1000
export const SIGNUP_OPEN_KEY = 'fnos_signup_open'
const SIGNUP_OPEN_TTL_MS = 48 * 60 * 60 * 1000

function sessionStore() {
  try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null } catch { return null }
}
function localStore() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null }
}
// Marca de "vuelve de Auth" leída al evaluar el módulo: supabase-js limpia el
// hash (#access_token) o el ?code= de la URL apenas procesa la sesión, que
// puede ser antes del primer render.
const BOOT_AUTH_MARK = (() => {
  try {
    if (typeof window === 'undefined') return ''
    const { hash = '', search = '' } = window.location
    return /[?&]code=/.test(search) ? `${hash}&code=1` : hash
  } catch { return '' }
})()

function stashRecord(search, now) {
  const target = openParam(search)
  if (target === null || !hasOwn(PAGE_BY_OPEN, target)) return null
  const plan = planParam(search)
  return JSON.stringify({ open: target, ...(plan ? { plan } : {}), at: now })
}

export function stashOpenForOAuth(search, storage = sessionStore(), now = Date.now()) {
  const rec = stashRecord(search, now)
  if (!storage || !rec) return
  try { storage.setItem(OAUTH_OPEN_KEY, rec) } catch { /* almacenamiento o API del navegador no disponible: se sigue sin ello */ }
}

export function stashOpenForSignup(search, storage = localStore(), now = Date.now()) {
  const rec = stashRecord(search, now)
  if (!storage || !rec) return
  try { storage.setItem(SIGNUP_OPEN_KEY, rec) } catch { /* almacenamiento o API del navegador no disponible: se sigue sin ello */ }
}

export function clearSignupStash(storage = localStore()) {
  try { storage?.removeItem(SIGNUP_OPEN_KEY) } catch { /* almacenamiento o API del navegador no disponible: se sigue sin ello */ }
}

const isAuthReturn = (search, hash) => /(^|[#&?])(access_token|code)=/.test(hash || '') || /[?&]code=/.test(search || '')

// Search efectiva para elegir la página inicial: la de la URL si trae ?open=;
// si no, la guardada antes del OAuth o del registro (y se borra al usarla).
// Tolera que React llame dos veces al inicializador (StrictMode): el resultado
// se recuerda por search.
let lastInitial = null

export function initialSearch(search, storage = sessionStore(), now = Date.now(), { local = localStore(), hash = BOOT_AUTH_MARK } = {}) {
  if (lastInitial && lastInitial.search === search && lastInitial.storage === storage && lastInitial.local === local && lastInitial.hash === hash) return lastInitial.result
  const result = computeInitialSearch(search, storage, now, local, hash)
  lastInitial = { search, storage, local, hash, result }
  return result
}

// La search efectiva que se resolvió al arrancar (o null si todavía no se
// llamó). Inversiones la usa para abrir la pestaña de ?open=invest-<pestaña>
// también cuando el destino volvió de OAuth o del correo de confirmación.
export function bootInitialSearch() {
  return lastInitial ? lastInitial.result : null
}

// ¿Esta carga vuelve de Auth (OAuth de Google o enlace de un correo)?
export function bootIsAuthReturn() {
  return isAuthReturn('', BOOT_AUTH_MARK)
}

function readStash(store, key, consume) {
  if (!store) return null
  try {
    const v = JSON.parse(store.getItem(key) || 'null')
    if (consume) store.removeItem(key)
    return v
  } catch { return null }
}

const toSearch = (st) => `?open=${st.open}${PLANS.has(st.plan) ? `&plan=${st.plan}` : ''}`

function computeInitialSearch(search, storage, now, local, hash) {
  const oauth = readStash(storage, OAUTH_OPEN_KEY, true)
  const authReturn = isAuthReturn(search, hash)
  const signup = readStash(local, SIGNUP_OPEN_KEY, authReturn)
  if (openParam(search) !== null) return search
  if (oauth && hasOwn(PAGE_BY_OPEN, oauth.open) && now - Number(oauth.at) < OAUTH_OPEN_TTL_MS) return toSearch(oauth)
  if (authReturn && signup && hasOwn(PAGE_BY_OPEN, signup.open) && now - Number(signup.at) < SIGNUP_OPEN_TTL_MS) return toSearch(signup)
  return search
}

// ?open=delete-account (C-22): Ajustes abre la confirmación de borrado.
export function wantsDeleteAccount(search) {
  return openParam(search) === 'delete-account'
}

// Enlace de un correo de Auth vencido o ya usado (auditoría de correos
// 18-nov-2026). Supabase vuelve a la app con el error en el hash
// (#error=access_denied&error_code=otp_expired&error_description=…) o, en el
// flujo PKCE, en la query. Antes la app lo ignoraba y la persona caía en el
// login sin saber que su enlace había vencido. Devuelve el código de error o
// null si la URL no trae ninguno.
const AUTH_ERROR_PARAMS = ['error', 'error_code', 'error_description']

function authErrorParams(search, hash) {
  const out = []
  for (const raw of [String(hash || '').replace(/^#/, ''), String(search || '').replace(/^\?/, '')]) {
    try { out.push(new URLSearchParams(raw)) } catch { /* URL malformada: se ignora */ }
  }
  return out
}

export function authLinkErrorFrom(search, hash = '') {
  for (const p of authErrorParams(search, hash)) {
    const code = p.get('error_code')
    if (code === 'otp_expired') return 'otp_expired'
    if (p.get('error') === 'access_denied') return code || 'access_denied'
  }
  return null
}

// Leído al evaluar el módulo, como BOOT_AUTH_MARK: supabase-js puede limpiar
// la URL antes de que se monte la pantalla de acceso.
const BOOT_AUTH_LINK_ERROR = (() => {
  try {
    if (typeof window === 'undefined') return null
    return authLinkErrorFrom(window.location.search, window.location.hash)
  } catch { return null }
})()

export function bootAuthLinkError() {
  return BOOT_AUTH_LINK_ERROR
}

// Saca los parámetros de error de la URL visible (sin recargar) para que el
// aviso no vuelva a salir al recargar ni quede en un enlace copiado. Devuelve
// la URL nueva, o null si no había nada que limpiar.
export function urlWithoutAuthError(href) {
  let url
  try { url = new URL(href) } catch { return null }
  let changed = false
  for (const k of AUTH_ERROR_PARAMS) if (url.searchParams.has(k)) { url.searchParams.delete(k); changed = true }
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  if (AUTH_ERROR_PARAMS.some(k => hash.has(k))) {
    for (const k of AUTH_ERROR_PARAMS) hash.delete(k)
    const rest = hash.toString()
    url.hash = rest ? `#${rest}` : ''
    changed = true
  }
  return changed ? url.toString() : null
}
