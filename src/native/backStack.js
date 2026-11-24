// src/native/backStack.js — qué hace el botón atrás de Android (AND-3/AND-4).
//
// Orden, como en una app nativa:
//   1. Si hay una hoja, diálogo o menú abierto, se cierra el de más arriba
//      (useDialogA11y y useBackDismiss los registran al abrirse).
//   2. Si no, navega hacia atrás dentro de la app (usePageStack registra el
//      navegador: pantalla empujada → la anterior; pestaña ≠ Inicio → Inicio).
//   3. En Inicio no queda nada: bridge.js manda la app al fondo.
// Sin DOM ni Capacitor: se usa también en la web y se prueba en node.

const dismissers = []
let navigator = null

/** Registra un "cerrable" (hoja, diálogo, menú). Devuelve la función para quitarlo. */
export function pushBackDismiss(close) {
  const entry = { close }
  dismissers.push(entry)
  return () => {
    const i = dismissers.indexOf(entry)
    if (i >= 0) dismissers.splice(i, 1)
  }
}

/** El navegador de pantallas activo (uno solo: App o el demo). fn() → true si navegó. */
export function setBackNavigator(fn) {
  navigator = fn
  return () => { if (navigator === fn) navigator = null }
}

/**
 * Atiende un "atrás". Devuelve:
 *   'dismissed'  cerró una hoja/diálogo/menú
 *   'navigated'  volvió de pantalla o de pestaña
 *   'root'       la app está en su pantalla raíz: no hay a dónde volver
 *   'unhandled'  no hay app montada (pantalla de acceso): decide quien llama
 */
export function handleBack() {
  const top = dismissers[dismissers.length - 1]
  if (top) {
    try { top.close() } catch { /* un cierre que falla no rompe el botón */ }
    return 'dismissed'
  }
  if (navigator) {
    let moved = false
    try { moved = !!navigator() } catch { moved = false }
    return moved ? 'navigated' : 'root'
  }
  return 'unhandled'
}

/** Solo para tests. */
export function _resetBackStack() {
  dismissers.length = 0
  navigator = null
}
