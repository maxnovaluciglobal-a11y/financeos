// src/components/help/news.js — Novedades de la ayuda (26-nov-2026): cambios
// reales de las últimas semanas (historial de git desde el 15-oct y el tablero
// ESTADO.md), contados para quien usa la app. Lo más nuevo primero. Textos en
// la sección diferida src/i18n/help/: help.news.<id>.title / .text.
// `page`: a dónde lleva "Ir a…" (opcional). `pro`: habla del plan Pro; no se
// muestra donde la app no puede anunciar planes (app de tienda, NAT-1).
// La hoja "Novedades" de cada versión (WhatsNew.jsx, data/releaseNotes.js)
// sigue aparte: esa sale una vez; esta lista se consulta cuando se quiere.
import { canShowProMarketing } from '../../native/storePolicy.js'

export const NEWS = [
  { id: 'n2611bar',    date: '2026-11-26', page: 'budgets' },
  { id: 'n2611help',   date: '2026-11-26', page: 'help' },
  { id: 'n2611trial',  date: '2026-11-26', pro: true },
  { id: 'n2611rules',  date: '2026-11-26', page: 'investments' },
  { id: 'n2511words',  date: '2026-11-25', page: 'investments' },
  { id: 'n2511tramos', date: '2026-11-25', page: 'investments' },
  { id: 'n2411review', date: '2026-11-24', page: 'dashboard' },
  { id: 'n2411cats',   date: '2026-11-24', page: 'settings' },
  { id: 'n2411alerts', date: '2026-11-24', page: 'dashboard' },
  { id: 'n2411fixed',  date: '2026-11-24', page: 'recurring' },
  { id: 'n2411home',   date: '2026-11-24', page: 'dashboard' },
  { id: 'n2411ask',    date: '2026-11-24', page: 'dashboard' },
  { id: 'n2311left',   date: '2026-11-23', page: 'dashboard' },
  { id: 'n2311invest', date: '2026-11-23', page: 'settings' },
  { id: 'n2011aside',  date: '2026-11-20', page: 'goals' },
]

// Novedades de Inversiones: solo si la sección existe para esta persona.
const INVEST_NEWS = new Set(['n2611rules', 'n2511words', 'n2511tramos', 'n2311invest'])

/** Las novedades que corresponden a esta persona y este build. */
export function visibleNews({ investments = true, proMarketing = canShowProMarketing() } = {}) {
  return NEWS.filter(n => (proMarketing || !n.pro) && (investments || !INVEST_NEWS.has(n.id)))
}

export function unreadCount(list, read = []) {
  const r = new Set(read)
  return list.filter(n => !r.has(n.id)).length
}

export const newsKeys = (id) => ({ title: `help.news.${id}.title`, text: `help.news.${id}.text` })
