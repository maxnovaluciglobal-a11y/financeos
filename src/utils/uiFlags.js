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
  // ChartLupa. Apagado en producción hasta que Walter lo apruebe; encendido en
  // el demo y en desarrollo local. Ver inicioLupaOn().
  inicioLupa: false,
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
