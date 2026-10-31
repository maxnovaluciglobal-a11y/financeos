// src/components/ui/sheetPhysics.js — números y decisiones de la hoja inferior.
// Lógica pura (sin DOM) para probarla con environment: node. `offset` es cuánto
// baja la hoja desde su posición más alta: 0 = alta (todo el contenido) y
// `height` = fuera de la pantalla.

export const MEDIUM_RATIO = 0.56     // altura media: 56 % de la pantalla
export const MEDIUM_MIN_GAP = 48     // sin diferencia real con la alta, no hay media
export const SLOP_PX = 8             // antes de esto, un toque sigue siendo un toque
export const VELOCITY_WINDOW_MS = 100
export const PROJECTION_MS = 180     // cuánto "sigue" el dedo después de soltar
export const SPRING_MS = 420
export const SPRING_MIN_MS = 180

// Dónde puede descansar una hoja de `height` en una pantalla de `viewportH`.
// Una hoja corta tiene una sola altura; una alta, dos.
export function detentOffsets(height, viewportH) {
  const medium = Math.round(viewportH * MEDIUM_RATIO)
  return height > medium + MEDIUM_MIN_GAP ? [0, height - medium] : [0]
}

// Velocidad en px/ms (positiva = hacia abajo) con las últimas muestras del dedo.
export function velocityOf(samples) {
  if (!samples || samples.length < 2) return 0
  const last = samples[samples.length - 1]
  let first = samples[0]
  for (const s of samples) { if (last.t - s.t <= VELOCITY_WINDOW_MS) { first = s; break } }
  const dt = last.t - first.t
  return dt > 0 ? (last.y - first.y) / dt : 0
}

// A qué posición va la hoja al soltar: proyecta el movimiento y elige la más
// cercana entre sus alturas y "cerrada". Devuelve un offset o 'close'.
export function settle({ offset, velocity = 0, offsets, height }) {
  const projected = offset + velocity * PROJECTION_MS
  const stops = [...offsets, height]
  let best = stops[0]
  for (const s of stops) if (Math.abs(s - projected) < Math.abs(best - projected)) best = s
  return best === height ? 'close' : best
}

// Más allá del tope, la hoja se resiste (el dedo gana poco terreno).
export function rubberBand(offset) {
  return offset >= 0 ? offset : offset * 0.18
}

// Duración del resorte: un gesto rápido termina rápido, sin cortar la curva.
export function springMs(distance, velocity = 0) {
  const v = Math.abs(velocity)
  if (v < 0.2) return SPRING_MS
  return Math.round(Math.min(SPRING_MS, Math.max(SPRING_MIN_MS, (Math.abs(distance) / v) * 1.6)))
}
