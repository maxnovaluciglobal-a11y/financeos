// src/native/platform.js — ¿corre dentro de la app nativa (Capacitor)?
//
// La misma build de la PWA se empaqueta en las apps de iOS y Android
// (repo privado moyiq-ios-capacitor, webDir = dist/app). El puente nativo de
// Capacitor inyecta window.Capacitor antes de que cargue la página; en la web,
// la PWA instalada y la TWA no existe. Todo lo nativo se decide acá, con
// funciones puras que reciben `win` para poder probarlas.

export function capacitorOf(win = globalThis) {
  try { return win?.Capacitor || null } catch { return null }
}

export function isNativeApp(win = globalThis) {
  try { return capacitorOf(win)?.isNativePlatform?.() === true } catch { return false }
}

/** 'ios' | 'android' | 'web' */
export function nativePlatform(win = globalThis) {
  if (!isNativeApp(win)) return 'web'
  try {
    const p = capacitorOf(win).getPlatform?.()
    return p === 'ios' || p === 'android' ? p : 'web'
  } catch { return 'web' }
}

// Dominio público de la app: en la app nativa el origen es capacitor://localhost
// (iOS) o https://localhost (Android), así que los enlaces que salen de la app
// (correos de auth, /api de Vercel) tienen que ir al dominio real.
export const PUBLIC_APP_ORIGIN = 'https://app.moyiq.app'
export const PUBLIC_APP_URL = `${PUBLIC_APP_ORIGIN}/app/`

/** Base para fetch('/api/...'): vacía en la web (mismo origen), el dominio real en la app nativa. */
export function apiBase(win = globalThis) {
  return isNativeApp(win) ? PUBLIC_APP_ORIGIN : ''
}

/** URL a la que vuelven los correos de Auth (confirmar alta, recuperar contraseña). */
export function authEmailRedirect(win = globalThis) {
  if (isNativeApp(win)) return PUBLIC_APP_URL
  return win.location.origin + win.location.pathname
}
