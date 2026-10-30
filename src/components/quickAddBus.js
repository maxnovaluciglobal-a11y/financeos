// src/components/quickAddBus.js
// Abre la hoja de Registro rápido (QuickAdd, que vive en Shell.jsx) desde
// cualquier pantalla sin pasar callbacks por toda la app. Shell escucha el
// evento; si no hay Shell montado (onboarding), no pasa nada.
export const QUICK_ADD_EVENT = 'fos:quick-add'

export function openQuickAdd(type = 'expense') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(QUICK_ADD_EVENT, { detail: { type } }))
}

// "Más detalles" del alta rápida (B4a): pide a Shell que cierre la hoja y vaya
// a otra pantalla (hoy, 'movements' con el gasto detallado precargado). Mismo
// patrón que QUICK_ADD_EVENT: sin Shell montado, no pasa nada.
export const NAVIGATE_EVENT = 'fos:navigate'

export function navigateTo(page) {
  if (typeof window === 'undefined' || !page) return
  window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: { page } }))
}
