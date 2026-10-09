// src/core/pushAsk.js — cuándo mostrar la hoja de pre-permiso de avisos (R09).
// Pura y testeable: el componente (components/PushAsk.jsx) le pasa el estado.
// Reglas: nunca al abrir la app; una sola vez, recién después del 3.er
// movimiento registrado; nunca si el navegador no soporta push, si ya están
// activados, si no hay licencia (enablePush la exige) ni en el demo.
export const PUSH_ASKED_KEY = 'fos_push_asked'
export const PUSH_ASK_MIN_MOVEMENTS = 3

export function shouldAskPush({ supported, enabled, asked, hasLicense, isDemo, movementCount }) {
  if (!supported || enabled || asked || !hasLicense || isDemo) return false
  return (Number(movementCount) || 0) >= PUSH_ASK_MIN_MOVEMENTS
}
