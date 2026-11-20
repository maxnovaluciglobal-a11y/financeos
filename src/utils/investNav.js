// src/utils/investNav.js — direcciones de Inversiones completo (F0).
//
// moyiq no enruta por URL: cada pantalla es un id de página y el historial
// guarda { fosPage, fosDepth, fosFrom } en history.state (usePageStack.js).
// Sobre eso, Inversiones agrega dos datos a SU entrada del historial:
//  · invTab: la pestaña (Hoy · Portafolio · Lista · Planificar · Mercado).
//    Cambiar de pestaña reemplaza la entrada (como una pestaña nativa: no se
//    apila), así Atrás desde la ficha vuelve a la pestaña de donde se vino.
//  · invTicker: el activo de la ficha ('investAsset', pantalla empujada).
// history.state vive solo en esta pestaña del navegador (no se manda a ningún
// lado). La pestaña elegida además queda en `fos_invest_tab` (clave de la
// cuenta, core/deviceOwner.js); el ticker de la ficha NO se guarda en el
// dispositivo.
// Enlaces: ?open=invest-hoy | invest-portafolio | invest-lista |
// invest-planificar | invest-mercado (utils/deepLink.js). La search que se
// lee es la que resolvió deepLink.initialSearch() al arrancar, así el enlace
// sobrevive a la vuelta de OAuth o del correo de confirmación.
// F1: Portafolio tiene 4 sub-pestañas (invSub en la misma entrada del
// historial y `fos_invest_port_tab`, también clave de la cuenta).
import { bootInitialSearch } from './deepLink.js'

export const INVEST_TABS = ['hoy', 'portafolio', 'lista', 'planificar', 'mercado']
export const DEFAULT_TAB = 'hoy'
export const TAB_KEY = 'fos_invest_tab'
export const ASSET_PAGE = 'investAsset'
export const ASSET_EVENT = 'fos:invest-asset'
const TICKER_RE = /^[\^A-Z0-9.\-=]{1,15}$/

export const PORT_TABS = ['posiciones', 'movimientos', 'dividendos', 'objetivos']
export const DEFAULT_PORT_TAB = 'posiciones'
export const PORT_TAB_KEY = 'fos_invest_port_tab'

export const isTab = (t) => INVEST_TABS.includes(t)
export const isPortTab = (t) => PORT_TABS.includes(t)
export function normAssetTicker(t) {
  const s = String(t ?? '').toUpperCase().trim()
  return TICKER_RE.test(s) ? s : null
}

// ?open=invest-<pestaña> → pestaña, o null.
export function tabFromOpen(open) {
  const m = /^invest-([a-z]+)$/.exec(String(open || ''))
  return m && isTab(m[1]) ? m[1] : null
}
export function tabFromSearch(search) {
  try { return tabFromOpen(new URLSearchParams(search || '').get('open')) } catch { return null }
}

// Pestaña inicial: la de esta entrada del historial → la del enlace (una sola
// vez por carga) → la guardada → Hoy.
export function initialTab({ state = null, linkTab = null, saved = null } = {}) {
  if (isTab(state?.invTab)) return state.invTab
  if (isTab(linkTab)) return linkTab
  if (isTab(saved)) return saved
  return DEFAULT_TAB
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
  queued = isTab(tab) ? { tab, sub: isPortTab(sub) ? sub : null } : null
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
  linkUsed = true
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

export function currentAssetTicker() {
  return normAssetTicker(readHistoryState()?.invTicker) || memTicker
}

// Abre la ficha de un ticker. setPage es el `go` de usePageStack: empuja la
// pantalla (o no hace nada si ya estamos en la ficha) y después se anota el
// ticker en esa misma entrada del historial.
export function openAsset(setPage, ticker) {
  const t = normAssetTicker(ticker)
  if (!t || typeof setPage !== 'function') return false
  memTicker = t
  setPage(ASSET_PAGE)
  mergeHistoryState({ invTicker: t })
  try { window.dispatchEvent(new CustomEvent(ASSET_EVENT, { detail: { ticker: t } })) } catch { /* SSR/test */ }
  return true
}

// Solo para pruebas.
export function __resetInvestNav() { linkUsed = false; memTicker = null; queued = null }
