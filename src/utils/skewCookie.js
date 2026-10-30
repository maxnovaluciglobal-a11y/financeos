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

//
// Segunda corrección (30-oct-2026, tarde): con un service worker que ya
// controla la página, la cookie sobra y hace daño. Los chunks salen de su
// precache (misma versión que el HTML), y la cookie, que viaja también en los
// pedidos del SW, ataba la PRECARGA del SW nuevo al despliegue viejo: los
// archivos nuevos daban 404, la instalación fallaba y el usuario quedaba en la
// versión anterior hasta que Vercel dejaba de respetar la cookie (12 h).
// Comprobado en demo.moyiq.app: el mismo chunk, 404 con la cookie y 200 sin
// ella. Por eso, con controlador (o cuando aparece uno) la cookie se borra;
// solo se fija en la primera visita, antes de que exista el SW.
const CLEAR = [
  '__vdpl=; path=/app; max-age=0; secure; samesite=lax',
  `__vdpl=; path=${SKEW_COOKIE_PATH}; max-age=0; secure; samesite=lax`,
]

export function skewCookieStrings(dpl, { controlled = false } = {}) {
  if (typeof dpl !== 'string' || !dpl) return []
  if (controlled) return CLEAR
  return [CLEAR[0], `__vdpl=${dpl}; path=${SKEW_COOKIE_PATH}; secure; samesite=lax`]
}

export function clearSkewCookieStrings() { return CLEAR }
