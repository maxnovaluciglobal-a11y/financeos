// src/components/tour/pageTours.js — recorridos por pantalla (R08).
// Pasos por página: id = data-tour del objetivo, title/body = claves i18n.
// Los objetivos que no estén visibles al empezar (p. ej. el "+" en escritorio,
// "Primeros pasos" cuando ya se completaron) se saltean solos (Tour.jsx).
// El "visto" es por dispositivo (localStorage), igual que hideAmounts: no viaja
// en respaldos ni en el sync.
export const PAGE_TOURS = {
  dashboard: [
    { id: 'kpi-free',     title: 'tour.home.left.title',   body: 'tour.home.left.body' },
    // Poda P1: sin vista detallada; su contenido es Panorama (fila del IQ).
    { id: 'home-quick',   title: 'tour.home.quick.title',  body: 'tour.home.quick.body' },
    { id: 'first-steps',  title: 'tour.home.steps.title',  body: 'tour.home.steps.body' },
    { id: 'iq-score',     title: 'tour.home.panorama.title', body: 'tour.home.panorama.body' },
    { id: 'home-edit',    title: 'tour.home.edit.title',   body: 'tour.home.edit.body' },
  ],
  // Poda P1: hub del análisis.
  panorama: [
    { id: 'iq-score',     title: 'tour.pano.score.title',  body: 'tour.pano.score.body' },
    { id: 'pano-month',   title: 'tour.pano.month.title',  body: 'tour.pano.month.body' },
    { id: 'pano-detail',  title: 'tour.pano.detail.title', body: 'tour.pano.detail.body' },
  ],
  movements: [
    { id: 'mov-type',  title: 'tour.mov.type.title',  body: 'movl.cal.tour.typeBody' }, // B3b: menciona el calendario
    { id: 'mov-kpis',  title: 'tour.mov.kpis.title',  body: 'tour.mov.kpis.body' },
    { id: 'mov-add',   title: 'tour.mov.add.title',   body: 'tour.mov.add.body' },
    { id: 'mov-list',  title: 'tour.mov.list.title',  body: 'tour.mov.list.body' },
    { id: 'mov-fixed', title: 'tour.mov.fixed.title', body: 'tour.mov.fixed.body' },
  ],
  budgets: [
    { id: 'bud-kpis',    title: 'tour.bud.kpis.title',    body: 'tour.bud.kpis.body' },
    { id: 'bud-new',     title: 'tour.bud.new.title',     body: 'tour.bud.new.body' },
    // R8b: el paso del modelo también nombra el asistente de 3 pasos (máx. 5 pasos).
    { id: 'bud-model',   title: 'tour.bud.model.title',   body: 'tour.bud.model.body' },
    { id: 'bud-summary', title: 'tour.bud.summary.title', body: 'tour.bud.summary.body' },
    // R8a: reparto del ingreso (patrón rial).
    { id: 'bud-split',   title: 'tour.bud.split.title',   body: 'tour.bud.split.body' },
  ],
  // N9 (ola C, patrón rial: "?" en cada pantalla de sección), 30-oct-2026.
  // D2: "Debo · Me deben" va primero; KPIs y alta usan el mismo ancla en las dos pestañas.
  debts: [
    { id: 'debt-direction', title: 'tour.debt.direction.title', body: 'tour.debt.direction.body' },
    { id: 'debt-kpis', title: 'tour.debt.kpis.title', body: 'tour.debt.kpis.body' },
    { id: 'debt-new',  title: 'tour.debt.new.title',  body: 'tour.debt.new.body' },
  ],
  recurring: [
    { id: 'rec-month', title: 'tour.rec.month.title', body: 'tour.rec.month.body' },
  ],
  // R9 Metas (patrón rial): bolsas fijas, alta corta y avance de cada meta.
  goals: [
    { id: 'goals-buckets', title: 'tour.goals.buckets.title', body: 'tour.goals.buckets.body' },
    { id: 'goals-new',     title: 'tour.goals.new.title',     body: 'tour.goals.new.body' },
    { id: 'goals-list',    title: 'tour.goals.list.title',    body: 'tour.goals.list.body' },
  ],
  // N9: Ingresos (patrón rial).
  income: [
    { id: 'inc-kpis', title: 'tour.inc.kpis.title', body: 'tour.inc.kpis.body' },
    { id: 'inc-form', title: 'tour.inc.form.title', body: 'tour.inc.form.body' },
  ],
  // R10 (ola C): Ajustes por subpantallas — el buscador y las filas agrupadas.
  settings: [
    { id: 'set-search', title: 'tour.settings.search.title', body: 'tour.settings.search.body' },
    { id: 'set-groups', title: 'tour.settings.groups.title', body: 'tour.settings.groups.body' },
  ],
}

export const TOURS_SEEN_KEY = 'fos_tours_seen'

export function parseSeen(raw) {
  try {
    const v = JSON.parse(raw || '[]')
    return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []
  } catch { return [] }
}

export function withSeen(seen, page) {
  return seen.includes(page) ? seen : [...seen, page]
}

// Arranca solo la primera vez que se abre una página con recorrido. En el demo
// no: el demo tiene su propio recorrido y se pisarían (el "?" sí funciona).
export function shouldAutoStartTour({ page, seen = [], isDemo = false }) {
  return !isDemo && !!PAGE_TOURS[page] && !seen.includes(page)
}

export function hasTour(page) { return !!PAGE_TOURS[page] }

export function readSeen(storage = globalThis.localStorage) {
  try { return parseSeen(storage?.getItem(TOURS_SEEN_KEY)) } catch { return [] }
}
export function markSeen(page, storage = globalThis.localStorage) {
  try { storage?.setItem(TOURS_SEEN_KEY, JSON.stringify(withSeen(readSeen(storage), page))) } catch { /* modo privado */ }
}
