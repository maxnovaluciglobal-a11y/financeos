// src/core/viewportFit.js
//
// Alto real de pantalla en la app instalada de iOS (pantalla de inicio).
//
// Con viewport-fit=cover y la barra de estado black-translucent, WebKit en modo
// standalone informa un viewport de diseño más corto que la pantalla (WebKit
// 237961 y 210009: window.innerHeight, el 100 % y el bloque contenedor de los
// position: fixed quedan cortos; 100vh y 100dvh no siempre coinciden con ellos,
// WebKit 281063 y 316008). Lo que se ancla con `bottom: 0` queda entonces
// flotando sobre un hueco del alto de la zona segura superior (≈47–62 pt), y si
// el documento mide más que ese viewport, iOS puede desplazarlo al enfocar un
// campo y los toques caen más arriba de lo que se ve (31-oct-2026, hoja del +).
//
// En la app instalada de iOS la vista web ocupa siempre la pantalla entera, así
// que el alto verdadero sale de `screen`. Se publican dos variables en <html>:
//   --app-h   alto de la pantalla en px (lo usa el Shell)
//   --vp-gap  cuánto le falta al viewport de diseño para llegar al borde
//             inferior (lo restan los elementos fixed anclados abajo)
// En cualquier otro caso (Safari con barra, Android, TWA, escritorio, iPad en
// pantalla dividida) no se publica nada y valen los respaldos del CSS.

// Más que esto no es la zona segura superior: mejor no corregir.
export const MAX_GAP = 100

/**
 * Pura: decide la corrección a partir de lo que informa el navegador.
 * @returns {{ appH: number, gap: number } | null}
 */
export function computeViewportFit({ standalone, innerWidth, innerHeight, screenWidth, screenHeight }) {
  if (standalone !== true) return null
  const vals = [innerWidth, innerHeight, screenWidth, screenHeight]
  if (!vals.every((n) => Number.isFinite(n) && n > 0)) return null
  // iOS no rota `screen`: el lado largo es el alto en vertical, el ancho en horizontal.
  const landscape = innerWidth > innerHeight
  const long = Math.max(screenWidth, screenHeight)
  const short = Math.min(screenWidth, screenHeight)
  const fullW = landscape ? long : short
  const fullH = landscape ? short : long
  // Solo ventana de ancho completo (descarta iPad en Split View / Stage Manager).
  if (Math.round(innerWidth) !== Math.round(fullW)) return null
  const gap = Math.round(fullH - innerHeight)
  if (gap <= 0 || gap > MAX_GAP) return null
  return { appH: Math.round(fullH), gap }
}

function readEnv(win) {
  return {
    // navigator.standalone solo existe en iOS/iPadOS: Android y TWA dan undefined.
    standalone: win.navigator?.standalone,
    innerWidth: win.innerWidth,
    innerHeight: win.innerHeight,
    screenWidth: win.screen?.width,
    screenHeight: win.screen?.height,
  }
}

export function applyViewportFit(win = window) {
  const root = win.document.documentElement
  const fit = computeViewportFit(readEnv(win))
  if (fit) {
    root.style.setProperty('--app-h', `${fit.appH}px`)
    root.style.setProperty('--vp-gap', `${fit.gap}px`)
    root.dataset.vpFit = 'standalone'
  } else {
    root.style.removeProperty('--app-h')
    root.style.removeProperty('--vp-gap')
    delete root.dataset.vpFit
  }
  return fit
}

/** Instala la corrección y la recalcula al girar, volver de segundo plano o cambiar de tamaño. */
export function installViewportFit(win = window) {
  if (!win?.document) return () => {}
  const run = () => { try { applyViewportFit(win) } catch { /* API no disponible: quedan los respaldos del CSS */ } }
  run()
  // iOS informa el alto nuevo un instante después de girar.
  const later = () => { run(); win.setTimeout(run, 300) }
  const onVis = () => { if (win.document.visibilityState === 'visible') later() }
  win.addEventListener('resize', run)
  win.addEventListener('orientationchange', later)
  win.addEventListener('pageshow', later)
  win.document.addEventListener('visibilitychange', onVis)
  return () => {
    win.removeEventListener('resize', run)
    win.removeEventListener('orientationchange', later)
    win.removeEventListener('pageshow', later)
    win.document.removeEventListener('visibilitychange', onVis)
  }
}

/** Alto útil de pantalla para cálculos en JS (detentes de la hoja, etc.). */
export function viewportHeight(win = window) {
  try { return computeViewportFit(readEnv(win))?.appH ?? win.innerHeight } catch { return win.innerHeight }
}
