// src/utils/deepLink.js — destino que abren los botones de los correos.
//
// Los correos de MOY IQ (nurture de Starter y del Diagnóstico) enlazan a
// https://app.moyiq.app/app/?open=<destino>&ref=<origen>. La app vive bajo /app/
// y navega por estado, no por ruta, así que el destino viaja en ?open=. Un valor
// desconocido se ignora: la app abre donde abriría sin él. Antes de la auditoría
// 360 (COM-2) esos botones apuntaban a /import, /dashboard, /upgrade y /signup,
// rutas que no existen. El contrato con los correos (supabase/functions/_shared/
// appLinks.ts) y con las redirecciones de vercel.json lo cubre deepLink.test.js.

// ?open=<destino> -> id de página de la app. "upgrade" abre Modo Asesor: para quien
// no es Pro es la pantalla de ProGate (qué incluye Pro, precio y prueba de 14 días).
// "delete-account" (C-22) abre Ajustes con la sección de borrar la cuenta desplegada.
const PAGE_BY_OPEN = { import: 'import', dashboard: 'dashboard', upgrade: 'advisor', 'delete-account': 'settings' }

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

// El retorno de Google (OAuth) vuelve a origin + pathname, sin la query: el
// destino de ?open= se guarda en sessionStorage antes de salir y se recupera
// en la primera carga de vuelta (APP-N2). Caduca a los 15 minutos.
const OAUTH_OPEN_KEY = 'fnos_oauth_open'
const OAUTH_OPEN_TTL_MS = 15 * 60 * 1000

function sessionStore() {
  try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null } catch { return null }
}

export function stashOpenForOAuth(search, storage = sessionStore(), now = Date.now()) {
  const target = openParam(search)
  if (!storage || target === null || !hasOwn(PAGE_BY_OPEN, target)) return
  try { storage.setItem(OAUTH_OPEN_KEY, JSON.stringify({ open: target, at: now })) } catch {}
}

// Search efectiva para elegir la página inicial: la de la URL si trae ?open=;
// si no, la guardada antes del OAuth (y se borra en cualquier caso).
// Tolera que React llame dos veces al inicializador (StrictMode): el resultado
// se recuerda por search.
let lastInitial = null

export function initialSearch(search, storage = sessionStore(), now = Date.now()) {
  if (lastInitial && lastInitial.search === search && lastInitial.storage === storage) return lastInitial.result
  const result = computeInitialSearch(search, storage, now)
  lastInitial = { search, storage, result }
  return result
}

function computeInitialSearch(search, storage, now) {
  let stashed = null
  if (storage) {
    try {
      stashed = JSON.parse(storage.getItem(OAUTH_OPEN_KEY) || 'null')
      storage.removeItem(OAUTH_OPEN_KEY)
    } catch { stashed = null }
  }
  if (openParam(search) !== null) return search
  if (stashed && hasOwn(PAGE_BY_OPEN, stashed.open) && now - Number(stashed.at) < OAUTH_OPEN_TTL_MS) {
    return `?open=${stashed.open}`
  }
  return search
}

// ?open=delete-account (C-22): Ajustes abre la confirmación de borrado.
export function wantsDeleteAccount(search) {
  return openParam(search) === 'delete-account'
}
