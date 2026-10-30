// src/utils/prefetchTabs.js — H20 (ola A10, 30-oct-2026).
// Las cinco pestañas son páginas lazy (App.jsx, DemoShell.jsx): la primera vez
// que se entraba a cada una se veía el esqueleto ~0,4–2 s. Tras el primer
// pintado, y cuando el navegador está libre, se importan en segundo plano; al
// tocar la pestaña el módulo ya está cargado. Mismos especificadores que los
// lazy(), así Vite reutiliza los mismos chunks. Un fallo (sin red) no importa:
// la pestaña se carga como antes al tocarla.
export const TAB_IMPORTS = [
  () => import('../pages/Dashboard/index.jsx'),
  () => import('../pages/Movements/index.jsx'),
  () => import('../pages/Budgets/index.jsx'),
  () => import('../pages/Goals/index.jsx'),
  () => import('../pages/More/index.jsx'),
]

let started = false
export function prefetchTabs({ win = typeof window !== 'undefined' ? window : null, imports = TAB_IMPORTS } = {}) {
  if (started || !win) return false
  started = true
  const run = () => {
    for (const load of imports) {
      // eslint-disable-next-line no-restricted-syntax -- precarga opcional: si falla (sin red), la pestaña se carga como antes al tocarla
      load().catch(() => {})
    }
  }
  if (typeof win.requestIdleCallback === 'function') win.requestIdleCallback(run, { timeout: 3000 })
  else win.setTimeout(run, 1500)
  return true
}

// Solo para pruebas.
export function _resetPrefetchForTests() { started = false }
