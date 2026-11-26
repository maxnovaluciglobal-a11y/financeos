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

// El guardado en la cuenta avisa cuando terminó de traer lo de otros
// dispositivos: la pregunta de la primera visita espera eso (con tope), para no
// ofrecer un recorrido que la persona ya vio en el teléfono.
let readyResolve
let readyPromise = new Promise(r => { readyResolve = r })
export function markHelpSyncReady() { readyResolve?.() }
export function helpSyncReady(timeoutMs = 2500) {
  return Promise.race([readyPromise, new Promise(r => setTimeout(r, timeoutMs))])
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
