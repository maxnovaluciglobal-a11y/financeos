// src/utils/skewCookie.js — Skew Protection de Vercel (C-49), corregida el
// 30-oct-2026 (ola A, lote 2b).
//
// La cookie __vdpl fija el despliegue para lo que se pide DESPUÉS de arrancar:
// los chunks lazy de /app/assets/. Antes iba con path=/app, así que también
// fijaba el HTML (/app/) y el propio sw.js: una pestaña abierta volvía a pedir
// la página vieja, ese código volvía a poner su cookie vieja y el usuario
// quedaba en la versión anterior mientras durara la sesión del navegador (en
// una PWA instalada, días). Ahora la cookie vive solo en /app/assets, y se
// borra la vieja de /app.
export const SKEW_COOKIE_PATH = '/app/assets'

export function skewCookieStrings(dpl) {
  if (typeof dpl !== 'string' || !dpl) return []
  return [
    '__vdpl=; path=/app; max-age=0; secure; samesite=lax',
    `__vdpl=${dpl}; path=${SKEW_COOKIE_PATH}; secure; samesite=lax`,
  ]
}
