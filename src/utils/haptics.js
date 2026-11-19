// src/utils/haptics.js
// Vibración corta en acciones que confirman algo (guardar/borrar) — refuerzo
// táctil que ya usan las apps nativas. navigator.vibrate no existe en iOS Safari
// (WebView de Capacitor sí lo soporta parcialmente) ni si el usuario desactivó
// permisos de sensores; por eso todo pasa por un try/catch silencioso.
export function hapticTap() {
  try { navigator.vibrate?.(8) } catch { /* almacenamiento o API del navegador no disponible: se sigue sin ello */ }
}

// Un "tick" por cambio de selección (la lupa del Inicio: uno por día, nunca
// por píxel). En la PWA de Android, vibrate(6) con un tope de un tick cada
// 35 ms; en iPhone (Safari no tiene Vibration API) no hace nada. La app de
// Capacitor llamará a Haptics.selectionChanged() cuando se instale (Fase 6).
let lastTick = 0
export function hapticSelection(now = Date.now()) {
  if (now - lastTick < 35) return false
  lastTick = now
  try { return !!navigator.vibrate?.(6) } catch { return false }
}
