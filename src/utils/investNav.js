// src/utils/investNav.js — direcciones de Inversiones completo (F0).
//
// moyiq no enruta por URL: cada pantalla es un id de página y el historial
// guarda { fosPage, fosDepth, fosFrom } en history.state (usePageStack.js).
// Sobre eso, Inversiones agrega dos datos a SU entrada del historial:
//  · invTab: la pestaña (Resumen · Portafolio · Siguiendo · Planificar ·
//    Mercado; hasta el 20-nov-2026 'hoy' y 'lista', que siguen valiendo).
//    Cambiar de pestaña reemplaza la entrada (como una pestaña nativa: no se
//    apila), así Atrás desde la ficha vuelve a la pestaña de donde se vino.
//  · invTicker: el activo de la ficha ('investAsset', pantalla empujada).
// history.state vive solo en esta pestaña del navegador (no se manda a ningún
// lado). La pestaña elegida además queda en `fos_invest_tab` (clave de la
// cuenta, core/deviceOwner.js); el ticker de la ficha NO se guarda en el
// dispositivo.
// Enlaces: ?open=invest-resumen | invest-portafolio | invest-siguiendo |
// invest-planificar | invest-mercado | invest-alertas (Siguiendo › Alertas,
// el aviso push de una alerta) (utils/deepLink.js). Los viejos
// invest-hoy e invest-lista redirigen a Resumen y Siguiendo (LEGACY_TABS). La search que se
// lee es la que resolvió deepLink.initialSearch() al arrancar, así el enlace
// sobrevive a la vuelta de OAuth o del correo de confirmación.
// F1: Portafolio tiene 4 sub-pestañas (invSub en la misma entrada del
// historial y `fos_invest_port_tab`, también clave de la cuenta).
// F4: Siguiendo tiene 4 (invFollow y `fos_invest_follow_tab`). Desde la ficha
// se puede pedir "Comparar" con ese activo (queueFollow, una vez, en memoria).
import { bootInitialSearch } from './deepLink.js'

export const INVEST_TABS = ['resumen', 'portafolio', 'siguiendo', 'planificar', 'mercado']
export const DEFAULT_TAB = 'resumen'
// Nombres anteriores (20-nov-2026, coherencia 360 I-7): enlaces, historial y
// la pestaña guardada en el dispositivo con el nombre viejo abren la nueva.
export const LEGACY_TABS = { hoy: 'resumen', lista: 'siguiendo' }
export const TAB_KEY = 'fos_invest_tab'
export const ASSET_PAGE = 'investAsset'
export const ASSET_EVENT = 'fos:invest-asset'
const TICKER_RE = /^[\^A-Z0-9.\-=]{1,15}$/

export const PORT_TABS = ['posiciones', 'movimientos', 'dividendos', 'objetivos']
export const DEFAULT_PORT_TAB = 'posiciones'
export const PORT_TAB_KEY = 'fos_invest_port_tab'

export const FOLLOW_TABS = ['lista', 'alertas', 'descubrir', 'comparar']
export const DEFAULT_FOLLOW_TAB = 'lista'
export const FOLLOW_TAB_KEY = 'fos_invest_follow_tab'
export const isFollowTab = (t) => FOLLOW_TABS.includes(t)

export const isTab = (t) => INVEST_TABS.includes(t)
// Pestaña con su nombre actual: la vieja se traduce; cualquier otra cosa, null.
export function normTab(t) {
  if (isTab(t)) return t
  return Object.prototype.hasOwnProperty.call(LEGACY_TABS, t) ? LEGACY_TABS[t] : null
}
export const isPortTab = (t) => PORT_TABS.includes(t)
export function normAssetTicker(t) {
  const s = String(t ?? '').toUpperCase().trim()
  return TICKER_RE.test(s) ? s : null
}

// Enlaces a una sub-pestaña: ?open=invest-alertas (el aviso push de una
// alerta de precio) abre Siguiendo › Alertas.
export const OPEN_SUBS = { alertas: { tab: 'siguiendo', follow: 'alertas' } }
const openName = (open) => /^invest-([a-z]+)$/.exec(String(open || ''))?.[1] ?? null

// ?open=invest-<pestaña> → pestaña, o null.
export function tabFromOpen(open) {
  const m = openName(open)
  if (!m) return null
  return Object.prototype.hasOwnProperty.call(OPEN_SUBS, m) ? OPEN_SUBS[m].tab : normTab(m)
}
// ?open=invest-<sub> → sub-pestaña de Siguiendo pedida por el enlace, o null.
export function followFromOpen(open) {
  const m = openName(open)
  return m && Object.prototype.hasOwnProperty.call(OPEN_SUBS, m) ? OPEN_SUBS[m].follow : null
}
export function followFromSearch(search) {
  try { return followFromOpen(new URLSearchParams(search || '').get('open')) } catch { return null }
}
export function tabFromSearch(search) {
  try { return tabFromOpen(new URLSearchParams(search || '').get('open')) } catch { return null }
}

// Pestaña inicial: la de esta entrada del historial → la del enlace (una sola
// vez por carga) → la guardada → Resumen. Los nombres viejos valen.
export function initialTab({ state = null, linkTab = null, saved = null } = {}) {
  return normTab(state?.invTab) || normTab(linkTab) || normTab(saved) || DEFAULT_TAB
}

// Navegación con flechas, Inicio y Fin en la fila de pestañas (patrón APG).
export function tabKeyTarget(key, current, tabs = INVEST_TABS) {
  const i = tabs.indexOf(current)
  const n = tabs.length
  if (key === 'ArrowRight') return tabs[(i + 1) % n]
  if (key === 'ArrowLeft') return tabs[(i - 1 + n) % n]
  if (key === 'Home') return tabs[0]
  if (key === 'End') return tabs[n - 1]
  return null
}

// ── Navegador (no puro) ───────────────────────────────────────────
let linkUsed = false
let memTicker = null
// Destino pedido desde otra pantalla de moyiq (p. ej. "Registrar el aporte"
// en Panorama): se usa una vez, al montar Inversiones.
let queued = null
export function queueInvestTab(tab, sub = null) {
  const tb = normTab(tab)
  queued = tb ? { tab: tb, sub: isPortTab(sub) ? sub : null } : null
}

function readHistoryState() {
  try { return typeof history !== 'undefined' ? history.state : null } catch { return null }
}
function mergeHistoryState(patch) {
  try {
    if (typeof history === 'undefined') return
    history.replaceState({ ...(history.state || {}), ...patch }, '')
  } catch { /* historial no disponible: vale solo en memoria */ }
}

const bootSearch = () => bootInitialSearch() ?? (typeof location !== 'undefined' ? location.search : '')

export function bootTab({ search = bootSearch(), storage = null } = {}) {
  if (queued) { const t = queued.tab; queued = queued.sub ? { sub: queued.sub } : null; mergeHistoryState({ invTab: t }); return t }
  const linkTab = linkUsed ? null : tabFromSearch(search)
  const linkFollow = linkUsed ? null : followFromSearch(search)
  linkUsed = true
  // Como cualquier enlace: si esta entrada del historial ya tiene pestaña
  // (recarga, Atrás), manda esa. Si no, el aviso abre Siguiendo › Alertas.
  if (linkFollow && !normTab(readHistoryState()?.invTab)) {
    followQueued = { sub: linkFollow, compare: null }
    mergeHistoryState({ invTab: linkTab })
    return linkTab
  }
  let saved = null
  try { saved = storage?.getItem(TAB_KEY) ?? null } catch { saved = null }
  return initialTab({ state: readHistoryState(), linkTab, saved })
}

export function rememberTab(tab, storage = null) {
  if (!isTab(tab)) return
  mergeHistoryState({ invTab: tab })
  try { storage?.setItem(TAB_KEY, tab) } catch { /* modo privado: queda en el historial de la pestaña */ }
}

// Sub-pestaña de Portafolio: la pedida desde otra pantalla → la de esta
// entrada del historial → la guardada → Posiciones.
export function bootPortTab({ storage = null } = {}) {
  if (queued?.sub) { const sub = queued.sub; queued = null; return sub }
  const st = readHistoryState()?.invSub
  if (isPortTab(st)) return st
  let saved = null
  try { saved = storage?.getItem(PORT_TAB_KEY) ?? null } catch { saved = null }
  return isPortTab(saved) ? saved : DEFAULT_PORT_TAB
}
export function rememberPortTab(sub, storage = null) {
  if (!isPortTab(sub)) return
  mergeHistoryState({ invSub: sub })
  try { storage?.setItem(PORT_TAB_KEY, sub) } catch { /* modo privado */ }
}

// Sub-pestaña de Siguiendo: la pedida (queueFollow) → la de esta entrada del
// historial → la guardada → Mi lista.
let followQueued = null
export function queueFollow({ sub = null, compare = null } = {}) {
  const list = Array.isArray(compare) ? compare.map(normAssetTicker).filter(Boolean).slice(0, 4) : null
  followQueued = { sub: isFollowTab(sub) ? sub : null, compare: list && list.length ? list : null }
  queueInvestTab('siguiendo')
}
// Lo pedido para Comparar (se lee una sola vez).
export function takeQueuedCompare() {
  const c = followQueued?.compare || null
  if (followQueued) followQueued = { ...followQueued, compare: null }
  return c
}
export function bootFollowTab({ storage = null } = {}) {
  if (followQueued?.sub) { const sub = followQueued.sub; followQueued = { ...followQueued, sub: null }; mergeHistoryState({ invFollow: sub }); return sub }
  const st = readHistoryState()?.invFollow
  if (isFollowTab(st)) return st
  let saved = null
  try { saved = storage?.getItem(FOLLOW_TAB_KEY) ?? null } catch { saved = null }
  return isFollowTab(saved) ? saved : DEFAULT_FOLLOW_TAB
}
export function rememberFollowTab(sub, storage = null) {
  if (!isFollowTab(sub)) return
  mergeHistoryState({ invFollow: sub })
  try { storage?.setItem(FOLLOW_TAB_KEY, sub) } catch { /* modo privado */ }
}

export function currentAssetTicker() {
  return normAssetTicker(readHistoryState()?.invTicker) || memTicker
}

// Abre la ficha de un ticker. setPage es el `go` de usePageStack: empuja la
// pantalla (o no hace nada si ya estamos en la ficha) y después se anota el
// ticker en esa misma entrada del historial.
// opts.tab: pestaña inicial de la ficha ('mine' desde Portafolio, F3).
export function openAsset(setPage, ticker, { tab = null } = {}) {
  const t = normAssetTicker(ticker)
  if (!t || typeof setPage !== 'function') return false
  memTicker = t
  setPage(ASSET_PAGE)
  // Ticker nuevo: la vista (pestaña y rango) arranca de cero.
  mergeHistoryState({ invTicker: t, invAssetTab: ASSET_VIEW_TABS.includes(tab) ? tab : null, invAssetRange: null })
  try { window.dispatchEvent(new CustomEvent(ASSET_EVENT, { detail: { ticker: t } })) } catch { /* SSR/test */ }
  return true
}

// Vista de la ficha (F3): pestaña y rango en la entrada del historial, así
// Atrás/Adelante vuelve a lo que se estaba mirando. Nada se guarda en el
// dispositivo.
export const ASSET_VIEW_TABS = ['ind', 'fund', 'mine', 'news']
export const ASSET_VIEW_RANGES = ['1M', '3M', '6M', '1A', '3A']
export function assetView(state = readHistoryState()) {
  return {
    tab: ASSET_VIEW_TABS.includes(state?.invAssetTab) ? state.invAssetTab : null,
    range: ASSET_VIEW_RANGES.includes(state?.invAssetRange) ? state.invAssetRange : null,
  }
}
export function rememberAssetView({ tab, range } = {}) {
  const patch = {}
  if (ASSET_VIEW_TABS.includes(tab)) patch.invAssetTab = tab
  if (ASSET_VIEW_RANGES.includes(range)) patch.invAssetRange = range
  if (Object.keys(patch).length) mergeHistoryState(patch)
}

// Solo para pruebas.
export function __resetInvestNav() { linkUsed = false; memTicker = null; queued = null; followQueued = null }
