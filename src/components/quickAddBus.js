// src/components/quickAddBus.js
// Abre la hoja de Registro rápido (QuickAdd, que vive en Shell.jsx) desde
// cualquier pantalla sin pasar callbacks por toda la app. Shell escucha el
// evento; si no hay Shell montado (onboarding), no pasa nada.
export const QUICK_ADD_EVENT = 'fos:quick-add'

export function openQuickAdd(type = 'expense') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(QUICK_ADD_EVENT, { detail: { type } }))
}
