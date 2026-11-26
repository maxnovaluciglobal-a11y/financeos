// src/components/tour/pageTours.js — recorridos por pantalla (R08).
// Pasos por página: id = data-tour del objetivo, title/body = claves i18n.
// Los objetivos que no estén visibles al empezar (p. ej. el "+" en escritorio,
// "Primeros pasos" cuando ya se completaron) se saltean solos (Tour.jsx).
// El "visto" tiene copia local (localStorage) y, con sesión, se guarda en la
// cuenta (components/help/progressSync.js). Los textos viven en la sección
// diferida src/i18n/help/ (no en el diccionario principal).
export const PAGE_TOURS = {
  dashboard: [
    { id: 'kpi-free',     title: 'tour.home.left.title',   body: 'tour.home.left.body' },
    // Poda P1: sin vista detallada; su contenido es Panorama (fila del IQ).
    // Inicio v2: los botones redondos del bloque y "Pregúntale a moyiq".
    { id: 'home-quick',   title: 'tour.home.quick.title',  body: 'tour.home.quick.body' },
    { id: 'home-ask',     title: 'tour.home.ask.title',    body: 'tour.home.ask.body' },
    { id: 'first-steps',  title: 'tour.home.steps.title',  body: 'tour.home.steps.body' },
    // El IQ ahora está en la cabecera (abre el Diagnóstico); el paso de Panorama
    // sale para dejar el recorrido en 5 pasos.
    { id: 'home-edit',    title: 'tour.home.edit.title',   body: 'tour.home.edit.body' },
  ],
  // Poda P1: hub del análisis.
  panorama: [
    // #10: el mes en palabras, arriba de todo.
    { id: 'pano-reading', title: 'tour.pano.reading.title', body: 'tour.pano.reading.body' },
    { id: 'iq-score',     title: 'tour.pano.score.title',  body: 'tour.pano.score.body' },
    // Mismo orden que la pantalla (I-3): "Tus análisis" va arriba de las
    // cifras del mes. El paso de Inversiones apunta a su tile de la cuadrícula
    // (I-2); con el módulo apagado no hay tile y Tour.jsx salta el paso.
    { id: 'pano-detail',  title: 'tour.pano.detail.title', body: 'tour.pano.detail.body' },
    { id: 'pano-invest',  title: 'tour.pano.invest.title', body: 'tour.pano.invest.body' },
    { id: 'pano-month',   title: 'tour.pano.month.title',  body: 'tour.pano.month.body' },
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
    { id: 'rec-new',   title: 'tour.rec.new.title',   body: 'tour.rec.new.body' },
    { id: 'rec-ahead', title: 'tour.rec.ahead.title', body: 'tour.rec.ahead.body' },
  ],
  // R9 Metas (patrón rial): bolsas fijas, alta corta y avance de cada meta.
  goals: [
    { id: 'goals-buckets', title: 'tour.goals.buckets.title', body: 'tour.goals.buckets.body' },
    { id: 'goals-new',     title: 'tour.goals.new.title',     body: 'tour.goals.new.body' },
    { id: 'goals-list',    title: 'tour.goals.list.title',    body: 'tour.goals.list.body' },
  ],
  // N9: Ingresos (patrón rial).
  // Ayuda en la app (26-nov-2026): recorrido en todas las pantallas del menú.
  income: [
    { id: 'inc-kpis', title: 'tour.inc.kpis.title', body: 'tour.inc.kpis.body' },
    { id: 'inc-form', title: 'tour.inc.form.title', body: 'tour.inc.form.body' },
    { id: 'inc-list', title: 'tour.inc.list.title', body: 'tour.inc.list.body' },
  ],
  // R10 (ola C): Ajustes por subpantallas — el buscador y las filas agrupadas.
  settings: [
    { id: 'set-search', title: 'tour.settings.search.title', body: 'tour.settings.search.body' },
    { id: 'set-groups', title: 'tour.settings.groups.title', body: 'tour.settings.groups.body' },
  ],
  import: [
    { id: 'imp-steps', title: 'tour.imp.steps.title', body: 'tour.imp.steps.body' },
    { id: 'imp-drop',  title: 'tour.imp.drop.title',  body: 'tour.imp.drop.body' },
    { id: 'imp-banks', title: 'tour.imp.banks.title', body: 'tour.imp.banks.body' },
  ],
  subscriptions: [
    { id: 'subs-kpis',    title: 'tour.subs.kpis.title',    body: 'tour.subs.kpis.body' },
    { id: 'subs-actions', title: 'tour.subs.actions.title', body: 'tour.subs.actions.body' },
    { id: 'subs-list',    title: 'tour.subs.list.title',    body: 'tour.subs.list.body' },
  ],
  networth: [
    { id: 'nw-total', title: 'tour.nw.total.title', body: 'tour.nw.total.body' },
    { id: 'nw-split', title: 'tour.nw.split.title', body: 'tour.nw.split.body' },
  ],
  coach: [
    { id: 'coach-score',   title: 'tour.coach.score.title',   body: 'tour.coach.score.body' },
    { id: 'coach-signals', title: 'tour.coach.signals.title', body: 'tour.coach.signals.body' },
    { id: 'coach-check',   title: 'tour.coach.check.title',   body: 'tour.coach.check.body' },
  ],
  reports: [
    { id: 'rep-kpis', title: 'tour.rep.kpis.title', body: 'tour.rep.kpis.body' },
    { id: 'rep-flow', title: 'tour.rep.flow.title', body: 'tour.rep.flow.body' },
    { id: 'rep-reco', title: 'tour.rep.reco.title', body: 'tour.rep.reco.body' },
  ],
  // Pro: sin el plan, ProGate no muestra los objetivos y el recorrido no se ofrece.
  cashflow: [
    { id: 'cf-eom',   title: 'tour.cf.eom.title',   body: 'tour.cf.eom.body' },
    { id: 'cf-kpis',  title: 'tour.cf.kpis.title',  body: 'tour.cf.kpis.body' },
    { id: 'cf-chart', title: 'tour.cf.chart.title', body: 'tour.cf.chart.body' },
  ],
  // Vista simple (Portfolio) o completa (pestañas): se muestran los pasos que estén.
  investments: [
    { id: 'inv-hero',  title: 'tour.inv.hero.title',  body: 'tour.inv.hero.body' },
    { id: 'inv-tabs',  title: 'tour.inv.tabs.title',  body: 'tour.inv.tabs.body' },
    { id: 'inv-tools', title: 'tour.inv.tools.title', body: 'tour.inv.tools.body' },
  ],
  projects: [
    { id: 'proj-total',  title: 'tour.proj.total.title',  body: 'tour.proj.total.body' },
    { id: 'proj-groups', title: 'tour.proj.groups.title', body: 'tour.proj.groups.body' },
  ],
  advisor: [
    { id: 'adv-score', title: 'tour.adv.score.title', body: 'tour.adv.score.body' },
    { id: 'adv-notes', title: 'tour.adv.notes.title', body: 'tour.adv.notes.body' },
    { id: 'adv-pdf',   title: 'tour.adv.pdf.title',   body: 'tour.adv.pdf.body' },
  ],
}

// Copia local del "visto" y regla de la primera visita: components/help/helpCore.js
// (va en el JS inicial; este archivo llega con la ayuda, por import()).
export { TOURS_SEEN_KEY, parseList as parseSeen, readSeen, markSeen, shouldOfferTour } from '../help/helpCore.js'

export function withSeen(seen, page) {
  return seen.includes(page) ? seen : [...seen, page]
}

export function hasTour(page) { return !!PAGE_TOURS[page] }
