// src/pages/Dashboard/homeCards.js — "Editar Inicio" (poda P3, 30-oct-2026).
// Tres tarjetas opcionales que se pueden sumar al Inicio. Vienen apagadas: el
// Inicio por defecto tiene que responder solo (menos del 5 % cambia los
// defaults, Spool 2011) y nada se reordena por sí solo. Todas viven siempre
// en Panorama; acá solo se elige si también aparecen en el Inicio.
// Se guardan en settings.homeCards (viajan en el respaldo y el sync).
export const HOME_CARDS = ['donut', 'networth', 'projection']

export function homeCardOn(settings, id) {
  return settings?.homeCards?.[id] === true
}

export function toggleHomeCard(settings, id) {
  const cur = Object.fromEntries(HOME_CARDS.map(k => [k, homeCardOn(settings, k)]))
  return { homeCards: { ...cur, [id]: !cur[id] } }
}
