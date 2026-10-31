// src/components/ui/swipeRow.js — decisiones del deslizamiento en filas (causa 18).
// Puro, para probarlo con environment: node.
export const EDGE_GUARD_PX = 28   // el borde izquierdo es del gesto "atrás" (R14)
export const SLOP_PX = 10
export const ACTION_W = 76        // cada acción revelada
export const OPEN_RATIO = 0.45    // cuánto hay que abrir para que quede abierta
export const FLICK = 0.45         // px/ms

// ¿Este toque puede ser un deslizamiento de fila?
export function canStart(startX) {
  return startX > EDGE_GUARD_PX
}

// Intención del dedo: null (todavía no se sabe), 'x' (fila) o 'y' (scroll).
export function intent(dx, dy) {
  if (Math.abs(dx) < SLOP_PX && Math.abs(dy) < SLOP_PX) return null
  return Math.abs(dx) > Math.abs(dy) * 1.3 ? 'x' : 'y'
}

// Desplazamiento de la fila: solo hacia la izquierda; más allá de las acciones
// se resiste.
export function clampOffset(x, width) {
  if (x >= 0) return 0
  return x < -width ? -width + (x + width) * 0.25 : x
}

// ¿Queda abierta al soltar?
export function settlesOpen(offset, velocity, width) {
  if (velocity < -FLICK) return true
  if (velocity > FLICK) return false
  return -offset >= width * OPEN_RATIO
}
