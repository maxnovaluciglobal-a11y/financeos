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

// Origen de la vista web en la app nativa (capacitor.config.json del repo
// moyiq-ios-capacitor: server.hostname "native.moyiq.app", iosScheme capacitor,
// androidScheme https). Es un subdominio de moyiq.app para que el widget de
// Turnstile `moyiq-forms` (hostname moyiq.app con subdominios) funcione dentro
// de la app (captcha de Supabase Auth, 24-nov-2026). NO es app.moyiq.app: ese
// hostname lo interceptaría la vista web y las llamadas a /api no saldrían.
// Nunca se resuelve por DNS: Capacitor sirve el paquete local con ese nombre.
export const NATIVE_APP_HOSTNAME = 'native.moyiq.app'
export const NATIVE_APP_ORIGINS = [`capacitor://${NATIVE_APP_HOSTNAME}`, `https://${NATIVE_APP_HOSTNAME}`]

// Dominio público de la app: el origen nativo no existe fuera del dispositivo,
// así que los enlaces que salen de la app (correos de auth, /api de Vercel)
// tienen que ir al dominio real.
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
