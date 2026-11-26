// src/components/help/helpCore.js — lo mínimo de la ayuda que va en el JS
// inicial (26-nov-2026): eventos, la copia local del progreso y la regla de la
// primera visita. El panel, los recorridos, las guías, las novedades y el
// guardado en la cuenta llegan con import() (HelpHost.jsx, progressSync.js).
// Sin React ni DOM obligatorio: se prueba en node.
import { hasOpenDismissers } from '../../native/backStack.js'

export const HELP_OPEN_EVENT = 'fos:help-open'
export const HELP_PROGRESS_EVENT = 'fos:help-progress'
export const TOUR_REPLAY_EVENT = 'fos:tour-replay'
export const TOUR_REPLAY_KEY = 'fos_tour_replay'

// Copia local del progreso (por cuenta: deviceOwner.js guarda las claves fos_*
// de cada cuenta). fos_tours_seen ya existía (R08) y se conserva tal cual.
export const TOURS_SEEN_KEY = 'fos_tours_seen'
export const NEWS_READ_KEY = 'fos_news_read'
// "Hay cambios que la cuenta todavía no tiene" (sin red, o la página se cerró
// antes de guardar): el próximo arranque los manda.
export const HELP_DIRTY_KEY = 'fos_help_dirty'

// Pantallas con recorrido. Tiene que coincidir con PAGE_TOURS (pageTours.js),
// que es lazy; help.test.js lo verifica.
export const TOUR_PAGES = [
  'dashboard', 'panorama', 'movements', 'income', 'recurring', 'import', 'subscriptions',
  'budgets', 'debts', 'goals', 'projects', 'networth', 'coach', 'reports', 'cashflow',
  'investments', 'advisor', 'settings',
]

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/
const local = () => { try { return globalThis.localStorage || null } catch { return null } }
const sess = () => { try { return globalThis.sessionStorage || null } catch { return null } }

export function parseList(raw) {
  try {
    const v = JSON.parse(raw || '[]')
    return Array.isArray(v) ? [...new Set(v.filter(x => typeof x === 'string' && ID.test(x)))] : []
  } catch { return [] }
}
export function readList(key, storage = local()) {
  try { return parseList(storage?.getItem(key)) } catch { return [] }
}
/** Suma ids a una lista local. Devuelve true si algo cambió. */
export function addToList(key, ids, storage = local()) {
  const cur = readList(key, storage)
  const next = [...new Set([...cur, ...ids.filter(x => typeof x === 'string' && ID.test(x))])]
  if (next.length === cur.length) return false
  try {
    storage?.setItem(key, JSON.stringify(next))
    storage?.setItem(HELP_DIRTY_KEY, '1')
  } catch { /* modo privado: queda en memoria de la sesión */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(HELP_PROGRESS_EVENT))
  return true
}

export const readSeen = (storage) => readList(TOURS_SEEN_KEY, storage)
export const markSeen = (page, storage) => addToList(TOURS_SEEN_KEY, [page], storage)
export const readNewsRead = (storage) => readList(NEWS_READ_KEY, storage)
export const markNewsRead = (ids, storage) => addToList(NEWS_READ_KEY, ids, storage)

// ── Cuentas de antes de la ayuda (decisión del 26-nov-2026) ──
// A quien ya usaba la app no se le pregunta "¿Primera vez en X?": todos los
// recorridos cuentan como vistos. Dos señales, cualquiera alcanza:
//  1. la cuenta se creó antes del lanzamiento (created_at del usuario de la
//     sesión, progressSync.js), que vale en cualquier dispositivo;
//  2. la primera vez que este código corre en este dispositivo y cuenta, ya
//     había datos de la app de antes (el "visto" de R08 o la marca de la hoja
//     de Novedades): sirve sin red.
// Las novedades siguen sin leer para todos. La unión con la cuenta se mantiene.
// HELP_RELEASE_AT: fin del día del despliegue (26-nov-2026) en Chile; una
// cuenta nueva creada ese mismo día después del despliegue tampoco ve la pregunta.
export const HELP_RELEASE_AT = '2026-11-27T03:00:00Z'
export const HELP_INIT_KEY = 'fos_help_init'
const PRIOR_KEYS = [TOURS_SEEN_KEY, 'fos_release_seen']

export function isPreReleaseAccount(createdAt, releaseAt = HELP_RELEASE_AT) {
  const t = Date.parse(createdAt || '')
  return Number.isFinite(t) && t < Date.parse(releaseAt)
}
export const seedAllToursSeen = (storage = local()) => addToList(TOURS_SEEN_KEY, TOUR_PAGES, storage)

/** Una vez por cuenta y dispositivo: si ya había datos de la app, todo visto. */
export function initHelpDevice(storage = local()) {
  try {
    if (!storage || storage.getItem(HELP_INIT_KEY)) return false
    const prior = PRIOR_KEYS.some(k => storage.getItem(k) != null)
    storage.setItem(HELP_INIT_KEY, '1')
    if (prior) seedAllToursSeen(storage)
    return prior
  } catch { return false }
}

// Contador de novedades sin leer, compartido entre el "?" de la barra y el del
// Inicio del teléfono (useHelp lo escribe).
let unreadValue = 0
const unreadListeners = new Set()
export const getHelpUnread = () => unreadValue
export function setHelpUnread(n) {
  if (n === unreadValue) return
  unreadValue = n
  unreadListeners.forEach(f => f())
}
export function subscribeHelpUnread(f) { unreadListeners.add(f); return () => unreadListeners.delete(f) }

// El guardado en la cuenta avisa cuando terminó de traer lo de otros
// dispositivos: la pregunta de la primera visita espera eso (con tope), para no
// ofrecer un recorrido que la persona ya vio en el teléfono.
// Si no termina a tiempo, la pregunta no se hace esta vez (se ofrece en otra
// visita): mejor eso que preguntarle a alguien que ya lo vio.
let readyResolve
let readyPromise = new Promise(r => { readyResolve = r })
export function markHelpSyncReady() { readyResolve?.(true) }
/** true si el guardado en la cuenta ya trajo lo suyo; false si venció el tope. */
export function helpSyncReady(timeoutMs = 2500) {
  return Promise.race([readyPromise, new Promise(r => setTimeout(() => r(false), timeoutMs))])
}
/** Solo para tests. */
export function _resetHelpSync() { readyPromise = new Promise(r => { readyResolve = r }) }

/** ¿Hay algo abierto encima (hoja, diálogo, menú) o una primera entrada guiada? */
export function isUiBusy(doc = globalThis.document) {
  if (hasOpenDismissers()) return true
  if (!doc?.querySelector) return false
  return !!(doc.querySelector('[role="dialog"][aria-modal="true"]') || doc.querySelector('[data-empty-guided]'))
}

/**
 * Primera visita a una pantalla con recorrido: se pregunta "¿Primera vez en X?"
 * (no arranca solo). Nunca en el demo (tiene su propio recorrido), nunca con
 * otra hoja o diálogo abierto, y una sola vez: "Ver el recorrido" y "Ahora no"
 * lo marcan como visto. Pura.
 */
export function shouldOfferTour({ page, seen = [], isDemo = false, busy = false }) {
  return !isDemo && !busy && TOUR_PAGES.includes(page) && !seen.includes(page)
}

export function openHelp(page) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(HELP_OPEN_EVENT, { detail: { page } }))
}

/** Pide el recorrido de `page`: si ya se está ahí arranca ahora; si no, al llegar. */
export function requestTourReplay(page, storage = sess()) {
  try { storage?.setItem(TOUR_REPLAY_KEY, page) } catch { /* modo privado: solo vale el evento */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(TOUR_REPLAY_EVENT, { detail: { page } }))
}

/** ¿Hay un recorrido pedido para `page`? Lo consume (una sola vez). Pura. */
export function takeTourReplay(page, storage = sess()) {
  try {
    if (storage?.getItem(TOUR_REPLAY_KEY) !== page) return false
    storage.removeItem(TOUR_REPLAY_KEY)
    return true
  } catch { return false }
}
