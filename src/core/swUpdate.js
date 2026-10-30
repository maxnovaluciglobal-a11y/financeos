// src/core/swUpdate.js — H14 (ola A11, 30-oct-2026): avisar que hay versión nueva.
//
// El SW se registra a mano (main.jsx) con skipWaiting + clientsClaim
// (vite.config.js, arreglo de la pantalla negra de jul-2026): el SW nuevo toma
// control apenas se instala y NUNCA queda "esperando", así que un aviso basado
// en onNeedRefresh (virtual:pwa-register) no se dispararía. Lo que sí ocurre es
// `controllerchange` en navigator.serviceWorker. La pestaña sigue corriendo el
// código viejo hasta recargar: ahí se ofrece "Actualizar".
// La primera instalación (no había controlador al abrir) NO es una versión
// nueva: no se avisa.
let ready = false
const listeners = new Set()

export function isUpdateReady() { return ready }

export function onUpdateReady(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function markUpdateReady() {
  if (ready) return
  ready = true
  for (const cb of listeners) { try { cb() } catch { /* un oyente que falla no corta a los demás */ } }
}

// Conecta el aviso. `sw` = navigator.serviceWorker (inyectable en pruebas).
export function watchServiceWorkerUpdates(sw = globalThis.navigator?.serviceWorker) {
  if (!sw || typeof sw.addEventListener !== 'function') return false
  const hadController = !!sw.controller
  sw.addEventListener('controllerchange', () => { if (hadController) markUpdateReady() })
  return true
}

// Solo para pruebas.
export function _resetSwUpdateForTests() { ready = false; listeners.clear() }
