// src/components/layout/pageStack.js — navegación "empujada" en móvil (R14).
// Lógica pura (sin DOM ni React) para que sea testeable en environment: node.
//
// Modelo: las 3 raíces del TabBar (Inicio · Movimientos · Menú) son pestañas;
// todo lo demás es una pantalla "empujada" encima de su raíz, con "‹ Atrás"
// en la barra superior y SIN la barra inferior. Las rutas no cambian: siguen
// siendo los mismos ids de página de siempre (navConfig.js, App.jsx). El
// historial del navegador guarda { fosPage, fosDepth, fosFrom } en
// history.state con la MISMA URL (no se agregan rutas nuevas ni se toca
// ?demo=true), así el botón atrás del navegador, el de Android y el gesto de
// iOS vuelven a la pantalla anterior.
import { TAB_IDS, activeTabFor } from './navConfig.js'

// Páginas secundarias que SÍ conservan el "+": son sobre registrar movimientos.
// (Ingresos es la lista de ingresos del mes; el "+" abre el registro rápido.)
export const FAB_SECONDARY_PAGES = new Set(['income'])

export function isRootPage(page) {
  return !page || TAB_IDS.includes(page)
}

// Raíz a la que "pertenece" una página (la pestaña que se enciende, R04).
export function parentRoot(page) {
  return activeTabFor(page)
}

// Qué "chrome" lleva cada página en móvil. En escritorio el sidebar manda y
// la barra/“+” no existen (CSS), así que esto solo cambia el móvil.
export function chromeFor(page) {
  const root = isRootPage(page)
  return {
    root,
    tabBar: root,
    back: !root,
    fab: root || FAB_SECONDARY_PAGES.has(page),
    parent: root ? null : parentRoot(page),
  }
}

// Cómo registrar en el historial una navegación de `from` a `to`:
// - 'none'    misma página (no se apila nada)
// - 'replace' cambio de pestaña entre raíces (las pestañas no se apilan, como
//             en una app nativa: atrás desde Menú no vuelve a Movimientos)
// - 'push'    todo lo demás (abrir una pantalla, o ir a una raíz desde una
//             pantalla empujada, p. ej. el sidebar de escritorio)
export function navAction(from, to) {
  if (!to || from === to) return 'none'
  if (isRootPage(from) && isRootPage(to)) return 'replace'
  return 'push'
}

// Entradas iniciales del historial al abrir la app. Si se abre directo en una
// pantalla secundaria (página restaurada de localStorage), se siembra su raíz
// debajo para que "atrás" vuelva a la raíz en vez de salir de la app.
export function bootEntries(page) {
  if (isRootPage(page)) return [{ fosPage: page || TAB_IDS[0], fosDepth: 0 }]
  const parent = parentRoot(page)
  return [
    { fosPage: parent, fosDepth: 0 },
    { fosPage: page, fosDepth: 1, fosFrom: parent },
  ]
}

// Qué hace "‹ Atrás": si hay una entrada propia debajo, history.back() (así
// queda igual que el botón del navegador); si no (estado perdido), reemplaza
// por la raíz de la página.
export function backAction(state, page) {
  const depth = Number(state?.fosDepth) || 0
  if (state?.fosPage === page && depth > 0) return { type: 'history' }
  return { type: 'replace', page: parentRoot(page) }
}

// Destino visible del botón atrás: de dónde se vino, o la raíz si no se sabe.
export function backTarget(state, page) {
  if (isRootPage(page)) return null
  const from = state?.fosPage === page ? state?.fosFrom : null
  return from && from !== page ? from : parentRoot(page)
}

// Una entrada de history.state es nuestra si trae fosPage string.
export function isStackState(state) {
  return !!state && typeof state.fosPage === 'string' && state.fosPage.length > 0
}
