// src/utils/haptics.js
// Vibración corta en acciones que confirman algo (guardar/borrar) — refuerzo
// táctil que ya usan las apps nativas. navigator.vibrate no existe en iOS Safari
// (WebView de Capacitor sí lo soporta parcialmente) ni si el usuario desactivó
// permisos de sensores; por eso todo pasa por un try/catch silencioso.
export function hapticTap() {
  try { navigator.vibrate?.(8) } catch {}
}
