// src/utils/storagePersist.js — que el navegador no borre los datos locales
// (auditoría 360, C-34 / META-6).
//
// Los movimientos viven en IndexedDB. Sin almacenamiento persistente, Safari
// (ITP) borra los datos de un sitio que no se abre en 7 días, y Chrome puede
// desalojarlos con poco espacio. Tras el primer movimiento guardado se pide
// navigator.storage.persist() (una vez por sesión). En Safari sin instalar la
// app, donde ese pedido no alcanza, se muestra un aviso único.

export const SAFARI_NOTICE_KEY = 'fnos_safari_storage_notice'

let askedThisSession = false

export async function requestPersistentStorage(nav = typeof navigator !== 'undefined' ? navigator : null) {
  if (askedThisSession || !nav?.storage?.persist) return null
  askedThisSession = true
  try {
    if (nav.storage.persisted && await nav.storage.persisted()) return true
    return await nav.storage.persist()
  } catch { return null }
}

export function _resetPersistForTests() { askedThisSession = false }

export function isSafariBrowser(ua) {
  const s = String(ua || '')
  return /Safari\//.test(s) && /AppleWebKit\//.test(s) && !/(Chrome|Chromium|CriOS|FxiOS|EdgiOS|EdgA|OPR|Android)/.test(s)
}

export function isStandaloneApp(win = typeof window !== 'undefined' ? window : null) {
  try {
    return !!(win?.matchMedia?.('(display-mode: standalone)')?.matches || win?.navigator?.standalone === true)
  } catch { return false }
}

// Aviso único: Safari, sin instalar, con datos y sin haberlo cerrado antes.
export function shouldShowSafariNotice({ ua, standalone, hasData, dismissed }) {
  return !!hasData && !dismissed && !standalone && isSafariBrowser(ua)
}

export function safariNoticeDismissed(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  try { return storage?.getItem(SAFARI_NOTICE_KEY) === '1' } catch { return false }
}

export function dismissSafariNotice(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  try { storage?.setItem(SAFARI_NOTICE_KEY, '1') } catch { /* almacenamiento o API del navegador no disponible: se sigue sin ello */ }
}
