// src/utils/uiFlags.js — interruptores de diseño del bloque "Ahora" (31-oct-2026).
// Lo que estos cambios sacan de la vista sigue en el código. Poner un valor en
// false devuelve la versión anterior completa; ver docs/retomar-bloque-ahora.md.
export const UI_FLAGS = {
  // Alta rápida de una sola tarea: el resto queda detrás de "Más opciones".
  quickAddCompact: true,
  // Categorías del alta rápida por uso reciente (false: por frecuencia).
  quickAddRecentCats: true,
  // Mantener unos minutos la fecha elegida en el alta rápida.
  quickAddEntryMemory: true,
  // Vista previa en las pantallas vacías.
  emptyPreviews: true,
  // Pestañas que se deslizan según su orden (false: fundido corto).
  tabSlide: true,
  // Entrega 1.5 (18-nov-2026): Inicio con escena a sangre, cifra gigante y
  // ChartLupa. Encendido en producción desde el 19-nov-2026 (OK de Walter);
  // `?ui=inicio-clasico` vuelve al Inicio anterior. Ver inicioLupaOn().
  inicioLupa: true,
  // Gastos que se registran solos, fase 1 (19-nov-2026): alta por URL
  // (?add=gasto&monto=…, el Atajo de Apple Pay), dictado en el "+" y la guía en
  // Ajustes › Registro automático. false lo apaga en producción; demo y
  // desarrollo local lo siguen mostrando. Ver docs/registro-automatico.md.
  registroAutomatico: true,
  // Escena morada detrás del título de TODAS las pantallas (20-nov-2026,
  // pedido de Walter). `?ui=sin-escena` la apaga en la pestaña para comparar.
  pageScene: true,
  // Invest completo dentro de moyiq, fase F0 (20-nov-2026): Inversiones pasa a
  // ser una sección con 5 pestañas (Hoy · Portafolio · Lista · Planificar ·
  // Mercado), ficha del activo y buscador. APAGADO en producción hasta que
  // Walter lo apruebe; demo y desarrollo local lo muestran. `?ui=invest-full`
  // / `?ui=invest-simple` lo fijan en la pestaña. Apagado, Inversiones queda
  // exactamente como antes. Ver investFullOn().
  investFull: false,
}

export function registroAutomaticoOn({ isDemo = false, isDev = false } = {}) {
  return isDemo || isDev || UI_FLAGS.registroAutomatico === true
}
// Contexto del navegador (no puro): demo por ?demo=true, desarrollo por Vite.
export function registroAutomaticoHere() {
  const isDemo = typeof window !== 'undefined' && /[?&]demo=true\b/.test(window.location.search)
  let isDev = false
  try { isDev = !!import.meta.env?.DEV } catch { isDev = false }
  return registroAutomaticoOn({ isDemo, isDev })
}

// ¿Se ve el Inicio nuevo? Orden: parámetro de revisión (`?ui=inicio-lupa`
// lo enciende, `?ui=inicio-clasico` lo apaga; queda guardado en la pestaña
// para que sobreviva a la navegación) → demo → desarrollo local → UI_FLAGS.
export const INICIO_LUPA_KEY = 'fos_ui_inicio_lupa'
export function inicioLupaOn({ isDemo = false, isDev = false, search = '', session = null } = {}) {
  const ui = new URLSearchParams(search || '').get('ui')
  if (ui === 'inicio-lupa' || ui === 'inicio-clasico') {
    try { session?.setItem(INICIO_LUPA_KEY, ui === 'inicio-lupa' ? '1' : '0') } catch { /* modo privado: vale solo para esta carga */ }
    return ui === 'inicio-lupa'
  }
  let saved = null
  try { saved = session?.getItem(INICIO_LUPA_KEY) ?? null } catch { saved = null }
  if (saved === '1' || saved === '0') return saved === '1'
  if (isDemo || isDev) return true
  return UI_FLAGS.inicioLupa
}

// ¿Cada pantalla abre con la escena morada? `?ui=sin-escena` / `?ui=escena`
// lo fija en la pestaña (sessionStorage), igual que el Inicio.
export const PAGE_SCENE_KEY = 'fos_ui_page_scene'
export function pageSceneOn({ search = '', session = null } = {}) {
  const ui = new URLSearchParams(search || '').get('ui')
  if (ui === 'escena' || ui === 'sin-escena') {
    try { session?.setItem(PAGE_SCENE_KEY, ui === 'escena' ? '1' : '0') } catch { /* modo privado */ }
    return ui === 'escena'
  }
  let saved = null
  try { saved = session?.getItem(PAGE_SCENE_KEY) ?? null } catch { saved = null }
  if (saved === '1' || saved === '0') return saved === '1'
  return UI_FLAGS.pageScene === true
}
export function pageSceneHere() {
  let session = null
  try { session = typeof sessionStorage !== 'undefined' ? sessionStorage : null } catch { session = null }
  return pageSceneOn({ search: typeof location !== 'undefined' ? location.search : '', session })
}

// ¿Inversiones completo (F0+)? Mismo orden que inicioLupaOn: parámetro de
// revisión guardado en la pestaña → demo → desarrollo local → UI_FLAGS.
export const INVEST_FULL_KEY = 'fos_ui_invest_full'
export function investFullOn({ isDemo = false, isDev = false, search = '', session = null } = {}) {
  const ui = new URLSearchParams(search || '').get('ui')
  if (ui === 'invest-full' || ui === 'invest-simple') {
    try { session?.setItem(INVEST_FULL_KEY, ui === 'invest-full' ? '1' : '0') } catch { /* modo privado: vale solo para esta carga */ }
    return ui === 'invest-full'
  }
  let saved = null
  try { saved = session?.getItem(INVEST_FULL_KEY) ?? null } catch { saved = null }
  if (saved === '1' || saved === '0') return saved === '1'
  if (isDemo || isDev) return true
  return UI_FLAGS.investFull === true
}
export function investFullHere() {
  let session = null
  try { session = typeof sessionStorage !== 'undefined' ? sessionStorage : null } catch { session = null }
  const search = typeof location !== 'undefined' ? location.search : ''
  let isDev = false
  try { isDev = !!import.meta.env?.DEV } catch { isDev = false }
  return investFullOn({ isDemo: /[?&]demo=true\b/.test(search), isDev, search, session })
}
