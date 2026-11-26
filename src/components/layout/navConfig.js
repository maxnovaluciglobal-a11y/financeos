import { isPaidPlan } from '../../utils/plans.js'
import { canShowProMarketing } from '../../native/storePolicy.js'
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
// investAsset: ficha del activo de Inversiones completo (pantalla empujada, F0).
const EXTRA_LABELS = { more: 'nav.menuLabel', privacy: 'nav.legal.privacy', terms: 'nav.legal.terms', disclaimer: 'nav.legal.disclaimer', investAsset: 'invest.asset.label' }
export function pageLabel(id) {
  if (EXTRA_LABELS[id]) return EXTRA_LABELS[id]
  return ALL_ITEMS.find(it => it.id === id)?.lb || id
}

// ── Pestañas del TabBar móvil (R01/R04, Inicio v2) ─────────────────────────
// Tres raíces: Inicio · Movimientos · Más, con el "+" aparte (Inicio v2,
// 24-nov-2026, variante D aprobada por Walter; referencia Rial). Reemplaza las
// 5 de L2 (21-oct): con 5 las etiquetas se cortaban ("Movimien…", "Presupues…").
// Presupuestos y Metas siguen a un toque desde los botones redondos del Inicio
// y son las primeras filas de Más; se abren como pantallas empujadas de Más.
// La navegación sigue plana (setPage) y los ids de página no cambiaron, así
// que los enlaces profundos (?open=…) y las rutas existentes siguen igual. Cada
// página se mapea a la pestaña que la contiene: lo de la sección "Movimientos"
// del NAV enciende Movimientos; el resto (Presupuestos y Metas incluidos)
// (incluidas las legales y Ajustes, que se abren desde el Menú) enciende Menú.
// La barra nunca queda sin pestaña activa.
export const TAB_HOME = 'dashboard'
export const TAB_MOVEMENTS = 'movements'
export const TAB_BUDGETS = 'budgets'
export const TAB_GOALS = 'goals'
export const TAB_MENU = 'more'
export const TAB_IDS = [TAB_HOME, TAB_MOVEMENTS, TAB_MENU]

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
  return TAB_MENU
}

// ── "Más" (antes "Menú"): 4 grupos con nombre, ≤ 10 filas (poda P1) ───────
// Evidencia en investigacion-ui-2026-10/segunda-ronda/2026-10-30-propuesta-poda.md
// (NN/g: lo frecuente visible y lo demás en un destino con nombre; Apple HIG y
// Material: barra de 3–5 destinos). Ningún ítem del NAV queda inalcanzable:
// o es pestaña, o es fila de "Más", o vive dentro de una fila (Panorama, la
// hoja "Herramientas de mi país" o Fijos › Suscripciones). navConfig.test.js
// lo verifica para cada país.
//  · Mi dinero: Presupuestos · Metas · Deudas y cobros · Fijos y suscripciones ·
//    Ingresos · Importar
//  · Panorama: el hub del análisis (Diagnóstico, Patrimonio, Proyección, Reportes…)
//  · Herramientas: calculadora de tasa (VE/AR) · herramientas del país ·
//    Propiedades, Modo asesor e Inversiones si están encendidos ·
//    "Activar más funciones". Inversiones nunca se quita (I-5): si no entra,
//    Modo asesor, Propiedades y "Activar más funciones" pasan, en ese orden,
//    a una hoja "Más herramientas"; las del país siguen directas.
//  · Cuenta: Ajustes (Ayuda y comentarios va en la barra del pie, junto a
//    tema y cerrar sesión, para no pasar de 10 filas en AR con todo encendido)
// R13: en VE/AR la calculadora de tasa del país (Multimoneda / Dólar y
// rendimientos) va primera en Herramientas, a un toque.
export const RATE_TOOL_BY_COUNTRY = { VE: 'multimoneda', AR: 'multidolar' }

// Lo que vive dentro de Panorama (hub) en el móvil.
export const PANORAMA_PAGES = ['coach', 'networth', 'cashflow', 'reports', 'subscriptions']

const item = (id) => ALL_ITEMS.find(it => it.id === id)

// Tope de filas de "Más" (navConfig.test.js lo exige en cada país).
// Inicio v2: 10 → 12, por las dos filas que llegaron de la barra (Presupuestos y Metas).
export const MORE_MAX_ROWS = 12

export function moreSections(country, settings = {}) {
  const cc = (country || 'CL').toUpperCase()
  const tool = RATE_TOOL_BY_COUNTRY[cc]
  const countryItems = (NAV.find(g => g.sec === 'nav.sec.country')?.items || [])
    .filter(it => navItemVisible(it, cc, settings) && it.id !== tool)

  // Inicio v2: Presupuestos y Metas dejaron de ser pestañas; van primeros.
  const money = [
    item('budgets'),
    item('goals'),
    { ...item('debts'), lb: 'more.debts' },
    { ...item('recurring'), lb: 'more.recurringSubs' },
    item('income'),
    item('import'),
  ]
  // Propiedades, Modo asesor e Inversiones (módulos encendidos), en ese orden.
  const extras = ['projects', 'advisor', 'investments'].map(item).filter(it => navItemVisible(it, cc, settings))
  const modulesRow = promptableModulesOff(settings).length > 0
    ? { id: 'modules', lb: 'more.enableModules', action: 'features' } : null

  // I-5 (benchmark/05-coherencia-360, 23-nov-2026): Inversiones encendido está
  // SIEMPRE en Herramientas, en todos los países; nunca se quita para respetar
  // el tope. Las herramientas del país (Inflación en AR) siguen como fila
  // directa. Si las filas pasan de MORE_MAX_ROWS (hoy solo Argentina, con
  // calculadora de tasa + Inflación + módulos), lo de menor prioridad va a una
  // hoja "Más herramientas": primero Modo asesor, después Propiedades y, si
  // hace falta, "Activar más funciones". La calculadora de tasa sigue a un
  // toque (R13) y nada desaparece: lo plegado queda dentro de la hoja.
  const rest = [...extras, ...(modulesRow ? [modulesRow] : [])]
  const folded = []
  const FOLD_ORDER = ['advisor', 'projects', 'modules']
  const toolRows = () => (tool ? 1 : 0) + (countryItems.length > 1 ? 1 : countryItems.length)
    + (folded.length > 0 ? 1 : 0) + rest.length
  const rows = () => money.length + toolRows() + 2 // Panorama + Ajustes
  for (const id of FOLD_ORDER) {
    if (rows() <= MORE_MAX_ROWS) break
    const i = rest.findIndex(it => it.id === id)
    if (i >= 0) folded.push(rest.splice(i, 1)[0])
  }
  // Una hoja con un solo ítem no ahorra nada: vuelve a ser fila.
  if (folded.length === 1) rest.push(folded.pop())

  const tools = []
  if (tool) tools.push({ ...item(tool), lb: 'refcur.tool', tool: true })
  if (countryItems.length === 1) tools.push(countryItems[0])
  else if (countryItems.length > 1) tools.push({ id: 'countryTools', lb: 'more.countryTools', sheet: true, items: countryItems, proOnly: countryItems.every(it => it.proOnly) })
  const RANK = ['projects', 'advisor', 'investments', 'modules']
  const order = (list) => [...list].sort((x, y) => RANK.indexOf(x.id) - RANK.indexOf(y.id))
  if (folded.length > 1) tools.push({ id: 'moreTools', lb: 'more.moreTools', sheet: true, items: order(folded), proOnly: folded.every(it => it.proOnly) })
  tools.push(...order(rest))

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
export { PAID_PLANS } from '../../utils/plans.js'
// En la app de tienda sin compra integrada (NAT-1) no hay chip: anunciar un
// plan que la app no vende es una llamada a comprar fuera.
export function showProChip(item, plan, win = globalThis) {
  if (!canShowProMarketing(win)) return false
  return !!item?.proOnly && !isPaidPlan(plan)
}
