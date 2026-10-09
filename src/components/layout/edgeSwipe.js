// src/components/layout/edgeSwipe.js — umbrales del gesto atrás (R14), puros.
export const EDGE_PX = 24        // el dedo tiene que empezar pegado al borde
export const MIN_DX = 72         // recorrido horizontal mínimo
export const MAX_MS = 700        // un arrastre lento no cuenta (es scroll)

export function isEdgeSwipeBack(start, end) {
  if (!start || !end) return false
  const dx = end.x - start.x
  const dy = Math.abs(end.y - start.y)
  return start.x <= EDGE_PX && dx >= MIN_DX && dy < dx * 0.6 && (end.at - start.at) <= MAX_MS
}
