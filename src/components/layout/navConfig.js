// src/components/layout/navConfig.js
// Extraído de Shell.jsx para que la página "more" (src/pages/More/index.jsx)
// reuse el mismo árbol de navegación en vez de duplicarlo — un id/label nuevo
// se agrega en un solo lugar y aparece tanto en el sidebar/drawer como en "more".

// lb = key de traducción (ver src/i18n/*.js), no texto directo
export const NAV = [
  { sec: 'nav.sec.main',    items: [{ id: 'dashboard', ic: '◈', lb: 'nav.dashboard' }] },
  { sec: 'nav.sec.movements',  items: [
    { id: 'income',    ic: '↑', lb: 'nav.income' },
    { id: 'movements', ic: '↓', lb: 'nav.expenses' },
    { id: 'import',    ic: '⇪', lb: 'nav.import' },
    { id: 'subscriptions', ic: '↻', lb: 'nav.subscriptions' },
  ] },
  // #06 — "Tu país" como sección propia: eleva el diferenciador fiscal por país
  // (antes estaba diluido dentro de Planificación) y de-satura esa sección.
  { sec: 'nav.sec.country', items: [
    { id: 'hipoteca', ic: '🇨🇱', cc: 'CL', lb: 'nav.hipotecaCL', countries: ['CL'], proOnly: true },
    { id: 'apv',     ic: '🇨🇱', cc: 'CL', lb: 'nav.apvChile', countries: ['CL'], proOnly: true },
    { id: 'irspt',    ic: '🇵🇹', cc: 'PT', lb: 'nav.irsPT', countries: ['PT'], proOnly: true },
    { id: 'ppr',     ic: '🇵🇹', cc: 'PT', lb: 'nav.pprPortugal', countries: ['PT'], proOnly: true },
    { id: 'deducciones', ic: '⊟', lb: 'nav.deductions', countries: ['EC', 'PE'], proOnly: true },
    { id: 'resico',       ic: '🇲🇽', cc: 'MX', lb: 'nav.resicoMX', countries: ['MX'], proOnly: true },
    { id: 'irpfes',   ic: '🇪🇸', cc: 'ES', lb: 'nav.irpfES', countries: ['ES'], proOnly: true },
    { id: 'ahorrofiscal', ic: '⊡', lb: 'nav.taxSavings', countries: ['MX', 'CO', 'US', 'ES'], proOnly: true },
    { id: 'multidolar',  ic: '🇦🇷', cc: 'AR', lb: 'nav.multidolarAR', countries: ['AR'], proOnly: true },
    { id: 'inflacion',   ic: '↗', lb: 'nav.inflation', countries: ['AR'], proOnly: true },
    { id: 'multimoneda', ic: '⇄', lb: 'nav.multicurrency', countries: ['VE'], proOnly: true },
    { id: 'steuer',      ic: '🇩🇪', cc: 'DE', lb: 'nav.steuerDE', countries: ['DE'], proOnly: true },
  ] },
  { sec: 'nav.sec.planning', items: [
    { id: 'budgets', ic: '▤', lb: 'nav.budgets' },
    { id: 'debts',   ic: '⊖', lb: 'nav.debts' },
    { id: 'goals',   ic: '◎', lb: 'nav.goals' },
    { id: 'projects', ic: '⌂', lb: 'nav.properties', proOnly: true },
  ] },
  { sec: 'nav.sec.analysis', items: [
    { id: 'networth', ic: '◆', lb: 'nav.netWorth' },
    { id: 'coach',    ic: '⚕', lb: 'nav.diagnosis' },
    { id: 'reports',  ic: '⊞', lb: 'nav.reports' },
    { id: 'cashflow', ic: '⟶', lb: 'nav.projection', proOnly: true },
  ] },
  { sec: 'nav.sec.pro', items: [
    { id: 'advisor',  ic: '◑', lb: 'nav.advisorMode', proOnly: true },
  ] },
  { sec: 'nav.sec.account', items: [
    { id: 'settings', ic: '⊙', lb: 'nav.settings' },
  ] },
]

// Todas las secciones planas para historial / búsqueda de label
export const ALL_ITEMS = NAV.flatMap(g => g.items)

// Key de traducción para la topbar (pageLabel devuelve una KEY, no texto — se traduce con t() al usarla)
// 'more' no vive en NAV (es la página del TabBar que lista todo NAV agrupado, no un destino del árbol).
export function pageLabel(id) {
  if (id === 'more') return 'nav.menuLabel'
  return ALL_ITEMS.find(it => it.id === id)?.lb || id
}
