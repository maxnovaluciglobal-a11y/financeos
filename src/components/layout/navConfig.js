import { moduleOn, promptableModulesOff } from '../../utils/modules.js'

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
    // B3a: la página muestra ingresos y gastos; en el riel se llama como la
    // pestaña ("Movimientos") y va primero en su sección. "Ingresos" sigue
    // como atajo propio (Menú y riel).
    { id: 'movements', lb: 'nav.movements' },
    { id: 'income',    lb: 'nav.income' },
    { id: 'recurring', lb: 'nav.recurring' },
    { id: 'import',    lb: 'nav.import' },
    { id: 'subscriptions', lb: 'nav.subscriptions' },
  ] },
  // #06 — "Tu país" como sección propia: eleva el diferenciador fiscal por país
  // (antes estaba diluido dentro de Planificación) y de-satura esa sección.
  { sec: 'nav.sec.country', items: [
    { id: 'hipoteca', cc: 'CL', lb: 'nav.hipotecaCL', countries: ['CL'], proOnly: true },
    { id: 'apv',     cc: 'CL', lb: 'nav.apvChile', countries: ['CL'], proOnly: true },
    { id: 'irspt',    cc: 'PT', lb: 'nav.irsPT', countries: ['PT'], proOnly: true },
    { id: 'ppr',     cc: 'PT', lb: 'nav.pprPortugal', countries: ['PT'], proOnly: true },
    { id: 'deducciones', lb: 'nav.deductions', countries: ['EC', 'PE'], proOnly: true },
    { id: 'resico',       cc: 'MX', lb: 'nav.resicoMX', countries: ['MX'], proOnly: true },
    { id: 'irpfes',   cc: 'ES', lb: 'nav.irpfES', countries: ['ES'], proOnly: true },
    { id: 'ahorrofiscal', lb: 'nav.taxSavings', countries: ['MX', 'CO', 'US', 'ES'], proOnly: true },
    { id: 'multidolar',  cc: 'AR', lb: 'nav.multidolarAR', countries: ['AR'], proOnly: true },
    { id: 'inflacion',   lb: 'nav.inflation', countries: ['AR'], proOnly: true },
    { id: 'multimoneda', lb: 'nav.multicurrency', countries: ['VE'], proOnly: true },
    { id: 'steuer',      cc: 'DE', lb: 'nav.steuerDE', countries: ['DE'], proOnly: true },
  ] },
  { sec: 'nav.sec.planning', items: [
    { id: 'budgets', lb: 'nav.budgets' },
    { id: 'debts',   lb: 'nav.debts' },
    { id: 'goals',   lb: 'nav.goals' },
    { id: 'projects', lb: 'nav.properties', proOnly: true, module: 'properties' },
  ] },
  { sec: 'nav.sec.analysis', items: [
    // Poda P1 (30-oct-2026): Panorama es el hub del análisis (reemplaza la
    // vista detallada del Inicio). Las demás filas siguen en el riel de
    // escritorio; en "Más" del móvil viven dentro de Panorama.
    { id: 'panorama', lb: 'nav.panorama' },
    { id: 'networth', lb: 'nav.netWorth' },
    { id: 'coach',    lb: 'nav.diagnosis' },
    { id: 'reports',  lb: 'nav.reports' },
    { id: 'cashflow', lb: 'nav.projection', proOnly: true },
    // Sin proOnly a propósito: los datos de mercado no tienen licencia comercial (INV-1).
    { id: 'investments', lb: 'nav.investments', module: 'investments' },
  ] },
  { sec: 'nav.sec.pro', items: [
    { id: 'advisor',  lb: 'nav.advisorMode', proOnly: true, module: 'advisor' },
  ] },
  { sec: 'nav.sec.account', items: [
    { id: 'settings', lb: 'nav.settings' },
  ] },
]

// Todas las secciones planas para historial / búsqueda de label
export const ALL_ITEMS = NAV.flatMap(g => g.items)

// Un ítem se muestra si es de este país (o no tiene país) y, si es un módulo
// que se activa (utils/modules.js), está encendido. Lo usan el riel y "Más".
export function navItemVisible(it, country, settings) {
  const cc = (country || 'CL').toUpperCase()
  if (it.countries && !it.countries.includes(cc)) return false
  if (it.module && !moduleOn(settings, it.module)) return false
  return true
}

// Key de traducción para la topbar (pageLabel devuelve una KEY, no texto — se traduce con t() al usarla)
// 'more' no vive en NAV (es la página del TabBar que lista todo NAV agrupado, no un destino del árbol).
// Las legales no viven en NAV (se abren desde el pie del Menú/sidebar).
const EXTRA_LABELS = { more: 'nav.menuLabel', privacy: 'nav.legal.privacy', terms: 'nav.legal.terms', disclaimer: 'nav.legal.disclaimer' }
export function pageLabel(id) {
  if (EXTRA_LABELS[id]) return EXTRA_LABELS[id]
  return ALL_ITEMS.find(it => it.id === id)?.lb || id
}

// ── Pestañas del TabBar móvil (R01/R04, L2) ────────────────────────────────
// Cinco raíces: Inicio · Movimientos · Presupuestos · Metas · Menú (L2,
// aprobado por Walter el 21-oct-2026; reemplaza las 3 pestañas de la decisión
// D2 del 08-oct). Mismo modelo que Invest: las dos funciones núcleo a un toque.
// La navegación sigue plana (setPage) y los ids de página no cambiaron, así
// que los enlaces profundos (?open=…) y las rutas existentes siguen igual. Cada
// página se mapea a la pestaña que la contiene: lo de la sección "Movimientos"
// del NAV enciende Movimientos; Presupuestos y Metas, la suya; el resto
// (incluidas las legales y Ajustes, que se abren desde el Menú) enciende Menú.
// La barra nunca queda sin pestaña activa.
export const TAB_HOME = 'dashboard'
export const TAB_MOVEMENTS = 'movements'
export const TAB_BUDGETS = 'budgets'
export const TAB_GOALS = 'goals'
export const TAB_MENU = 'more'
export const TAB_IDS = [TAB_HOME, TAB_MOVEMENTS, TAB_BUDGETS, TAB_GOALS, TAB_MENU]

const MOVEMENT_PAGES = new Set(
  (NAV.find(g => g.sec === 'nav.sec.movements')?.items || []).map(it => it.id)
)

// Dirección del deslizamiento entre pestañas, según su orden en la barra.
export function tabMotion(from, to, slide = true) {
  const a = TAB_IDS.indexOf(from), b = TAB_IDS.indexOf(to)
  if (!slide || a < 0 || b < 0 || a === b) return 'tab'
  return b > a ? 'tab-next' : 'tab-prev'
}

export function activeTabFor(page) {
  if (!page || page === TAB_HOME) return TAB_HOME
  if (page === TAB_MOVEMENTS || MOVEMENT_PAGES.has(page)) return TAB_MOVEMENTS
  if (page === TAB_BUDGETS) return TAB_BUDGETS
  if (page === TAB_GOALS) return TAB_GOALS
  return TAB_MENU
}

// ── "Más" (antes "Menú"): 4 grupos con nombre, ≤ 10 filas (poda P1) ───────
// Evidencia en investigacion-ui-2026-10/segunda-ronda/2026-10-30-propuesta-poda.md
// (NN/g: lo frecuente visible y lo demás en un destino con nombre; Apple HIG y
// Material: barra de 3–5 destinos). Ningún ítem del NAV queda inalcanzable:
// o es pestaña, o es fila de "Más", o vive dentro de una fila (Panorama, la
// hoja "Herramientas de mi país" o Fijos › Suscripciones). navConfig.test.js
// lo verifica para cada país.
//  · Mi dinero: Deudas y cobros · Fijos y suscripciones · Ingresos · Importar
//  · Panorama: el hub del análisis (Diagnóstico, Patrimonio, Proyección, Reportes…)
//  · Herramientas: calculadora de tasa (VE/AR) · herramientas del país ·
//    Propiedades, Modo asesor e Inversiones si están encendidos ·
//    "Activar más funciones"
//  · Cuenta: Ajustes (Ayuda y comentarios va en la barra del pie, junto a
//    tema y cerrar sesión, para no pasar de 10 filas en AR con todo encendido)
// R13: en VE/AR la calculadora de tasa del país (Multimoneda / Dólar y
// rendimientos) va primera en Herramientas, a un toque.
export const RATE_TOOL_BY_COUNTRY = { VE: 'multimoneda', AR: 'multidolar' }

// Lo que vive dentro de Panorama (hub) en el móvil.
export const PANORAMA_PAGES = ['coach', 'networth', 'cashflow', 'reports', 'subscriptions']

const item = (id) => ALL_ITEMS.find(it => it.id === id)

// Tope de filas de "Más" (navConfig.test.js lo exige en cada país).
export const MORE_MAX_ROWS = 10

export function moreSections(country, settings = {}) {
  const cc = (country || 'CL').toUpperCase()
  const tool = RATE_TOOL_BY_COUNTRY[cc]
  const countryItems = (NAV.find(g => g.sec === 'nav.sec.country')?.items || [])
    .filter(it => navItemVisible(it, cc, settings) && it.id !== tool)

  const money = [
    { ...item('debts'), lb: 'more.debts' },
    { ...item('recurring'), lb: 'more.recurringSubs' },
    item('income'),
    item('import'),
  ]
  const tools = []
  if (tool) tools.push({ ...item(tool), lb: 'refcur.tool', tool: true })
  if (countryItems.length === 1) tools.push(countryItems[0])
  else if (countryItems.length > 1) tools.push({ id: 'countryTools', lb: 'more.countryTools', sheet: true, items: countryItems, proOnly: countryItems.every(it => it.proOnly) })
  for (const id of ['projects', 'advisor', 'investments']) {
    const it = item(id)
    if (navItemVisible(it, cc, settings)) tools.push(it)
  }
  if (promptableModulesOff(settings).length > 0) tools.push({ id: 'modules', lb: 'more.enableModules', action: 'features' })

  // Argentina es el único país con calculadora de tasa Y herramienta propia:
  // con Inversiones sumado puede pasar de 10 filas. Ahí Inversiones queda solo
  // en Panorama, que tiene la misma tarjeta (y el riel de escritorio la conserva).
  const rows = money.length + tools.length + 2 // Panorama + Ajustes
  if (rows > MORE_MAX_ROWS) {
    const i = tools.findIndex(it => it.id === 'investments')
    if (i >= 0) tools.splice(i, 1)
  }

  return [
    { sec: 'more.sec.money', items: money },
    { sec: 'more.sec.panorama', items: [item('panorama')] },
    { sec: 'nav.sec.tools', items: tools },
    { sec: 'nav.sec.account', items: [item('settings')] },
  ].filter(g => g.items.length > 0)
}

// H22 (ola A3, 30-oct-2026): la etiqueta PRO solo se muestra a quien no tiene
// Pro. Recibe el plan de la LICENCIA (getLicensePlan()), no el de usePlan():
// en la demo usePlan() dice 'pro' y los chips son parte de lo que se muestra.
export const PAID_PLANS = ['pro', 'enterprise']
export function showProChip(item, plan) {
  return !!item?.proOnly && !PAID_PLANS.includes(String(plan || '').toLowerCase())
}
