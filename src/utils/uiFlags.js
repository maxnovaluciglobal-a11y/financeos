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
}
