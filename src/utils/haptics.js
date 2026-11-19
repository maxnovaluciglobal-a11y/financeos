// src/utils/haptics.js
// Vibración corta en acciones que confirman algo (guardar/borrar) — refuerzo
// táctil que ya usan las apps nativas. En la app nativa (Capacitor) va al
// Taptic Engine / vibrador por @capacitor/haptics (native/bridge.js lo
// instala); en la PWA, navigator.vibrate, que no existe en iOS Safari ni si el
// usuario desactivó permisos de sensores: todo pasa por un try/catch silencioso.
import { nativeHaptics } from '../native/nativeHaptics.js'

export function hapticTap() {
  const n = nativeHaptics()
  if (n) { try { n.tap() } catch { /* plugin no disponible */ } return }
  try { navigator.vibrate?.(8) } catch { /* almacenamiento o API del navegador no disponible: se sigue sin ello */ }
}

// Un "tick" por cambio de selección (la lupa del Inicio: uno por día, nunca
// por píxel). Con un tope de un tick cada 35 ms. En la app nativa es
// Haptics.selectionChanged() (el "clic" del selector de iOS); en la PWA de
// Android, vibrate(6); en Safari de iPhone no hace nada.
let lastTick = 0
export function hapticSelection(now = Date.now()) {
  if (now - lastTick < 35) return false
  lastTick = now
  const n = nativeHaptics()
  if (n) { try { n.selection(); return true } catch { return false } }
  try { return !!navigator.vibrate?.(6) } catch { return false }
}
