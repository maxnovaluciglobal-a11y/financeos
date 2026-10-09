// src/components/layout/navConfig.js
// Extraído de Shell.jsx para que la página "more" (src/pages/More/index.jsx)
// reuse el mismo árbol de navegación en vez de duplicarlo — un id/label nuevo
// se agrega en un solo lugar y aparece tanto en el sidebar/drawer como en "more".

// lb = key de traducción (ver src/i18n/*.js), no texto directo.
// Íconos: NAV_ICONS (components/icons/Icons.jsx) por id; los ítems de país
// llevan `cc` y se dibujan con CountryBadge (D5). `ic` (emoji de bandera) queda
// solo como último fallback si un ítem no tuviera ninguna de las dos cosas.
export const NAV = [
  { sec: 'nav.sec.main',    items: [{ id: 'dashboard', lb: 'nav.dashboard' }] },
  { sec: 'nav.sec.movements',  items: [
    { id: 'income',    lb: 'nav.income' },
    { id: 'movements', lb: 'nav.expenses' },
    { id: 'recurring', lb: 'nav.recurring' },
    { id: 'import',    lb: 'nav.import' },
    { id: 'subscriptions', lb: 'nav.subscriptions' },
  ] },
  // #06 — "Tu país" como sección propia: eleva el diferenciador fiscal por país
  // (antes estaba diluido dentro de Planificación) y de-satura esa sección.
  { sec: 'nav.sec.country', items: [
    { id: 'hipoteca', ic: '🇨🇱', cc: 'CL', lb: 'nav.hipotecaCL', countries: ['CL'], proOnly: true },
    { id: 'apv',     ic: '🇨🇱', cc: 'CL', lb: 'nav.apvChile', countries: ['CL'], proOnly: true },
    { id: 'irspt',    ic: '🇵🇹', cc: 'PT', lb: 'nav.irsPT', countries: ['PT'], proOnly: true },
    { id: 'ppr',     ic: '🇵🇹', cc: 'PT', lb: 'nav.pprPortugal', countries: ['PT'], proOnly: true },
    { id: 'deducciones', lb: 'nav.deductions', countries: ['EC', 'PE'], proOnly: true },
    { id: 'resico',       ic: '🇲🇽', cc: 'MX', lb: 'nav.resicoMX', countries: ['MX'], proOnly: true },
    { id: 'irpfes',   ic: '🇪🇸', cc: 'ES', lb: 'nav.irpfES', countries: ['ES'], proOnly: true },
    { id: 'ahorrofiscal', lb: 'nav.taxSavings', countries: ['MX', 'CO', 'US', 'ES'], proOnly: true },
    { id: 'multidolar',  ic: '🇦🇷', cc: 'AR', lb: 'nav.multidolarAR', countries: ['AR'], proOnly: true },
    { id: 'inflacion',   lb: 'nav.inflation', countries: ['AR'], proOnly: true },
    { id: 'multimoneda', lb: 'nav.multicurrency', countries: ['VE'], proOnly: true },
    { id: 'steuer',      ic: '🇩🇪', cc: 'DE', lb: 'nav.steuerDE', countries: ['DE'], proOnly: true },
  ] },
  { sec: 'nav.sec.planning', items: [
    { id: 'budgets', lb: 'nav.budgets' },
    { id: 'debts',   lb: 'nav.debts' },
    { id: 'goals',   lb: 'nav.goals' },
    { id: 'projects', lb: 'nav.properties', proOnly: true },
  ] },
  { sec: 'nav.sec.analysis', items: [
    { id: 'networth', lb: 'nav.netWorth' },
    { id: 'coach',    lb: 'nav.diagnosis' },
    { id: 'reports',  lb: 'nav.reports' },
    { id: 'cashflow', lb: 'nav.projection', proOnly: true },
  ] },
  { sec: 'nav.sec.pro', items: [
    { id: 'advisor',  lb: 'nav.advisorMode', proOnly: true },
  ] },
  { sec: 'nav.sec.account', items: [
    { id: 'settings', lb: 'nav.settings' },
  ] },
]

// Todas las secciones planas para historial / búsqueda de label
export const ALL_ITEMS = NAV.flatMap(g => g.items)

// Key de traducción para la topbar (pageLabel devuelve una KEY, no texto — se traduce con t() al usarla)
// 'more' no vive en NAV (es la página del TabBar que lista todo NAV agrupado, no un destino del árbol).
// Las legales no viven en NAV (se abren desde el pie del Menú/sidebar).
const EXTRA_LABELS = { more: 'nav.menuLabel', privacy: 'nav.legal.privacy', terms: 'nav.legal.terms', disclaimer: 'nav.legal.disclaimer' }
export function pageLabel(id) {
  if (EXTRA_LABELS[id]) return EXTRA_LABELS[id]
  return ALL_ITEMS.find(it => it.id === id)?.lb || id
}

// ── Pestañas del TabBar móvil (R01/R04) ────────────────────────────────────
// Tres raíces: Inicio · Movimientos · Menú (decisión de Walter D2, 08-oct-2026).
// La navegación sigue plana (setPage), así que cada página se mapea a la
// pestaña que la contiene: todo lo de la sección "Movimientos" del NAV enciende
// Movimientos, el Inicio enciende Inicio y el resto (incluidas las páginas
// legales y Ajustes, que se abren desde el Menú) enciende Menú. La barra nunca
// queda sin pestaña activa.
export const TAB_HOME = 'dashboard'
export const TAB_MOVEMENTS = 'movements'
export const TAB_MENU = 'more'
export const TAB_IDS = [TAB_HOME, TAB_MOVEMENTS, TAB_MENU]

const MOVEMENT_PAGES = new Set(
  (NAV.find(g => g.sec === 'nav.sec.movements')?.items || []).map(it => it.id)
)

export function activeTabFor(page) {
  if (!page || page === TAB_HOME) return TAB_HOME
  if (page === TAB_MOVEMENTS || MOVEMENT_PAGES.has(page)) return TAB_MOVEMENTS
  return TAB_MENU
}

// ── Orden de secciones en la página Menú (R11) ─────────────────────────────
// Presupuestos salió de la barra inferior, así que Planificación va primero.
// "Principal" (Inicio) ya es una pestaña: va casi al final, antes de Cuenta,
// para no perder ningún ítem del NAV. Ajustes (Cuenta) siempre al final.
export const MENU_SECTION_ORDER = [
  'nav.sec.planning', 'nav.sec.movements', 'nav.sec.analysis', 'nav.sec.country', 'nav.sec.pro', 'nav.sec.main', 'nav.sec.account',
]

// R13: en VE/AR la calculadora de tasa del país (Multimoneda / Dólar y
// rendimientos) va primero, en "Herramientas", a un toque. Sale de "Tu país"
// para no aparecer dos veces; el sidebar de escritorio no cambia.
export const RATE_TOOL_BY_COUNTRY = { VE: 'multimoneda', AR: 'multidolar' }

export function menuSections(country) {
  const cc = (country || 'CL').toUpperCase()
  const tool = RATE_TOOL_BY_COUNTRY[cc]
  const rank = (sec) => { const i = MENU_SECTION_ORDER.indexOf(sec); return i === -1 ? MENU_SECTION_ORDER.length - 1.5 : i }
  const secs = [...NAV]
    .sort((a, b) => rank(a.sec) - rank(b.sec))
    .map(g => ({ sec: g.sec, items: g.items.filter(it => (!it.countries || it.countries.includes(cc)) && it.id !== tool) }))
    .filter(g => g.items.length > 0)
  if (!tool) return secs
  const base = ALL_ITEMS.find(it => it.id === tool)
  return [{ sec: 'nav.sec.tools', items: [{ ...base, lb: 'refcur.tool', tool: true }] }, ...secs]
}
