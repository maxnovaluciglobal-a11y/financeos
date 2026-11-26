// src/components/help/guides.js — "Cómo se usa esta pantalla" (ayuda en la app,
// 26-nov-2026). La estructura vive acá y los textos en la sección diferida
// src/i18n/help/ (es/en/pt/de): help.g.<id>.summary, .s1….sN (pasos), .tip1…
// (ten en cuenta) y .kw (palabras para el buscador, separadas por coma).
// Regla del contenido: solo lo que la app hace hoy (verificado en el código).
import { NAV, navItemVisible, pageLabel } from '../layout/navConfig.js'
import { STORE_BUILD } from '../../native/storeBuild.js'

// steps: 2 a 6 pasos; tips: 0 a 3.
export const GUIDES = {
  dashboard:     { steps: 5, tips: 2 },
  movements:     { steps: 5, tips: 2 },
  income:        { steps: 3, tips: 1 },
  recurring:     { steps: 4, tips: 2 },
  import:        { steps: 4, tips: 2 },
  subscriptions: { steps: 3, tips: 1 },
  budgets:       { steps: 4, tips: 2 },
  debts:         { steps: 4, tips: 1 },
  goals:         { steps: 4, tips: 1 },
  panorama:      { steps: 4, tips: 1 },
  networth:      { steps: 3, tips: 1 },
  coach:         { steps: 3, tips: 2 },
  reports:       { steps: 4, tips: 1 },
  cashflow:      { steps: 3, tips: 2 },
  investments:   { steps: 4, tips: 1 },
  projects:      { steps: 3, tips: 1 },
  advisor:       { steps: 3, tips: 1 },
  settings:      { steps: 3, tips: 2 },
  more:          { steps: 4, tips: 0 },
  // Una guía para todas las herramientas del país (impuestos, moneda).
  country:       { steps: 2, tips: 1 },
}

// Orden del centro de ayuda: como el menú.
export const GUIDE_ORDER = [
  'dashboard', 'movements', 'income', 'recurring', 'subscriptions', 'import',
  'budgets', 'goals', 'debts', 'projects',
  'panorama', 'networth', 'coach', 'reports', 'cashflow', 'investments',
  'advisor', 'country', 'settings', 'more',
]

const COUNTRY_PAGES = new Set((NAV.find(g => g.sec === 'nav.sec.country')?.items || []).map(it => it.id))
const NAV_ITEM = new Map(NAV.flatMap(g => g.items).map(it => [it.id, it]))

/** Id de la guía de una página (las herramientas del país comparten una). */
export function guideIdFor(page) {
  if (GUIDES[page]) return page
  if (COUNTRY_PAGES.has(page)) return 'country'
  return null
}

/** Claves i18n de una guía. */
export function guideKeys(id) {
  const g = GUIDES[id]
  if (!g) return null
  const n = (k, count) => Array.from({ length: count }, (_, i) => `help.g.${id}.${k}${i + 1}`)
  return {
    // Nombre: el del menú (diccionario principal), salvo la guía de país.
    name: id === 'country' ? 'nav.sec.country' : pageLabel(id),
    summary: `help.g.${id}.summary`,
    steps: n('s', g.steps),
    tips: n('tip', g.tips),
    keywords: `help.g.${id}.kw`,
  }
}

/**
 * Guías que valen para esta persona: las páginas que su menú muestra (país y
 * funciones encendidas). La de país solo si tiene alguna herramienta.
 */
export function visibleGuides(country, settings = {}) {
  return GUIDE_ORDER.filter(id => {
    if (id === 'country') return [...COUNTRY_PAGES].some(p => navItemVisible(NAV_ITEM.get(p), country, settings))
    const it = NAV_ITEM.get(id)
    return it ? navItemVisible(it, country, settings) : true
  })
}

// Sin tildes ni mayúsculas: "meta" encuentra "Metas", "deposito" encuentra "Depósito".
export function normalize(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * Busca en las guías (nombre, resumen, pasos, consejos y palabras clave). Cada
 * palabra de la búsqueda tiene que aparecer. El nombre pesa más que el resto.
 * `t` traduce una clave. Devuelve los ids en orden de relevancia. Pura.
 */
export function searchGuides(ids, query, t) {
  const words = normalize(query).split(' ').filter(Boolean)
  if (!words.length) return ids
  const scored = []
  ids.forEach((id, order) => {
    const k = guideKeys(id)
    if (!k) return
    const name = normalize(t(k.name))
    const body = normalize([k.summary, ...k.steps, ...k.tips, k.keywords].map(t).join(' '))
    let score = 0
    for (const w of words) {
      if (name.includes(w)) score += 3
      else if (body.includes(w)) score += 1
      else return
    }
    scored.push({ id, score, order })
  })
  return scored.sort((a, b) => b.score - a.score || a.order - b.order).map(x => x.id)
}

/** ¿Esta persona tiene la sección Inversiones? (para las novedades de Inversiones) */
export function investmentsVisible(country, settings = {}) {
  const it = NAV_ITEM.get('investments')
  return !STORE_BUILD && !!it && navItemVisible(it, country, settings)
}
