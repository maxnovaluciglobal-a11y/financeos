// src/components/tour/pageTours.js — recorridos por pantalla (R08).
// Pasos por página: id = data-tour del objetivo, title/body = claves i18n.
// Los objetivos que no estén visibles al empezar (p. ej. el "+" en escritorio,
// "Primeros pasos" cuando ya se completaron) se saltean solos (Tour.jsx).
// El "visto" es por dispositivo (localStorage), igual que hideAmounts: no viaja
// en respaldos ni en el sync.
export const PAGE_TOURS = {
  dashboard: [
    { id: 'kpi-free',     title: 'tour.home.left.title',   body: 'tour.home.left.body' },
    { id: 'kpi-income',   title: 'tour.home.pair.title',   body: 'tour.home.pair.body' },
    { id: 'first-steps',  title: 'tour.home.steps.title',  body: 'tour.home.steps.body' },
    { id: 'tab-add',      title: 'tour.home.add.title',    body: 'tour.home.add.body' },
    { id: 'view-toggle',  title: 'tour.home.detail.title', body: 'tour.home.detail.body' },
  ],
  movements: [
    { id: 'mov-kpis',  title: 'tour.mov.kpis.title',  body: 'tour.mov.kpis.body' },
    { id: 'mov-add',   title: 'tour.mov.add.title',   body: 'tour.mov.add.body' },
    { id: 'mov-list',  title: 'tour.mov.list.title',  body: 'tour.mov.list.body' },
    { id: 'mov-fixed', title: 'tour.mov.fixed.title', body: 'tour.mov.fixed.body' },
  ],
  budgets: [
    { id: 'bud-kpis',    title: 'tour.bud.kpis.title',    body: 'tour.bud.kpis.body' },
    { id: 'bud-new',     title: 'tour.bud.new.title',     body: 'tour.bud.new.body' },
    { id: 'bud-model',   title: 'tour.bud.model.title',   body: 'tour.bud.model.body' },
    { id: 'bud-summary', title: 'tour.bud.summary.title', body: 'tour.bud.summary.body' },
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
