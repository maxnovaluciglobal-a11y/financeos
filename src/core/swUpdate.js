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
//
// 19-nov-2026 (iPhone de Walter: menú inferior que no se veía, marca vieja):
// en la app instalada de iOS la PWA se retoma desde memoria y puede quedar días
// con el código anterior si nadie toca "Actualizar". Por eso, además del aviso,
// se recarga SOLA cuando no interrumpe a nadie:
//   - la versión nueva llega en los primeros segundos después de abrir (la
//     persona todavía no empezó a hacer nada), o
//   - llegó mientras la app estaba en segundo plano: se recarga al volver.
// Mientras se usa la app, sigue solo el aviso. Un guardia en sessionStorage
// evita un bucle de recargas si algo falla.
let ready = false
const listeners = new Set()

export const BOOT_WINDOW_MS = 6000
export const AUTO_RELOAD_KEY = 'fos_sw_auto_reload'

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

// ¿Se puede recargar sola ahora? `env` es inyectable en pruebas.
export function shouldAutoReload({ now, bootAt, hidden, session } = {}) {
  let already = null
  try { already = session?.getItem(AUTO_RELOAD_KEY) ?? null } catch { already = null }
  if (already === '1') return false
  return Boolean(hidden) || (now - bootAt) <= BOOT_WINDOW_MS
}

// Conecta el aviso y la recarga automática.
// `sw` = navigator.serviceWorker; `env` permite inyectar documento, reloj,
// sessionStorage y la recarga en pruebas.
export function watchServiceWorkerUpdates(sw = globalThis.navigator?.serviceWorker, env = {}) {
  if (!sw || typeof sw.addEventListener !== 'function') return false
  const doc = env.document ?? globalThis.document
  const now = env.now ?? (() => Date.now())
  const session = env.session ?? (() => { try { return globalThis.sessionStorage } catch { return null } })()
  const reload = env.reload ?? (() => globalThis.location?.reload())
  const bootAt = env.bootAt ?? now()
  const hadController = !!sw.controller
  let pendingOnVisible = false

  const doReload = () => {
    try { session?.setItem(AUTO_RELOAD_KEY, '1') } catch { /* sin almacenamiento: igual se recarga una vez */ }
    reload()
  }

  sw.addEventListener('controllerchange', () => {
    if (!hadController) return
    markUpdateReady()
    const hidden = doc?.visibilityState === 'hidden'
    if (!shouldAutoReload({ now: now(), bootAt, hidden, session })) return
    if (hidden) pendingOnVisible = true
    else doReload()
  })

  doc?.addEventListener?.('visibilitychange', () => {
    if (pendingOnVisible && doc.visibilityState === 'visible') { pendingOnVisible = false; doReload() }
  })

  // Una carga que llegó a mostrar la versión nueva limpia el guardia para la
  // próxima actualización (después de unos segundos de uso estable).
  try { globalThis.setTimeout?.(() => { try { session?.removeItem(AUTO_RELOAD_KEY) } catch { /* nada */ } }, BOOT_WINDOW_MS * 2) } catch { /* nada */ }
  return true
}

// Solo para pruebas.
export function _resetSwUpdateForTests() { ready = false; listeners.clear() }
