// src/utils/theme.js — tema visual (N4): 'system' | 'light' | 'dark'.
//
// `settings.theme` guarda la preferencia; `data-theme` en <html> siempre recibe
// el tema resuelto ('light' o 'dark'), porque el CSS solo conoce esos dos.
// Con 'system' se sigue a `prefers-color-scheme` en vivo (listener de
// matchMedia). Lo fijan tres lugares: AppContext, DemoContext y AppLockGate
// (la pantalla de bloqueo se monta sin AppProvider).

export const THEME_SETTINGS = ['system', 'light', 'dark']

const QUERY = '(prefers-color-scheme: dark)'

// Pura: preferencia guardada + lo que pide el sistema → tema que se pinta.
// Un valor desconocido o ausente queda en claro, el comportamiento de siempre.
export function resolveTheme(setting, prefersDark) {
  if (setting === 'dark') return 'dark'
  if (setting === 'system') return prefersDark ? 'dark' : 'light'
  return 'light'
}

function mediaQuery() {
  try { return typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(QUERY) : null } catch { return null }
}

export function systemPrefersDark() {
  return !!mediaQuery()?.matches
}

export const THEME_PREF_KEY = 'fos_theme_pref'

// Además de pintar, deja la preferencia en localStorage para que
// public/theme-boot.js la aplique antes de React en la próxima apertura.
export function applyTheme(setting, storage = globalThis.localStorage) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', resolveTheme(setting, systemPrefersDark()))
  if (THEME_SETTINGS.includes(setting)) { try { storage?.setItem(THEME_PREF_KEY, setting) } catch { /* modo privado: solo en memoria */ } }
}

// Llama a onChange(prefersDark) cada vez que el sistema cambia de claro a
// oscuro. Devuelve la función para dejar de escuchar.
export function watchSystemTheme(onChange) {
  const mq = mediaQuery()
  if (!mq) return () => {}
  const handler = (e) => onChange(!!e.matches)
  if (mq.addEventListener) {
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }
  // Safari < 14
  mq.addListener?.(handler)
  return () => mq.removeListener?.(handler)
}
