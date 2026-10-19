// src/utils/deepLink.js — destino que abren los botones de los correos.
//
// Los correos de MOY IQ (nurture de Starter y del Diagnóstico) enlazan a
// https://app.moyiq.app/app/?open=<destino>&ref=<origen>. La app vive bajo /app/
// y navega por estado, no por ruta, así que el destino viaja en ?open=. Un valor
// desconocido se ignora: la app abre donde abriría sin él. Antes de la auditoría
// 360 (COM-2) esos botones apuntaban a /import, /dashboard, /upgrade y /signup,
// rutas que no existen. El contrato con los correos (supabase/functions/_shared/
// appLinks.ts) y con las redirecciones de vercel.json lo cubre deepLink.test.js.

// ?open=<destino> -> id de página de la app. "upgrade" abre Modo Asesor: para quien
// no es Pro es la pantalla de ProGate (qué incluye Pro, precio y prueba de 14 días).
const PAGE_BY_OPEN = { import: 'import', dashboard: 'dashboard', upgrade: 'advisor' }

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key)

function openParam(search) {
  try { return new URLSearchParams(search || '').get('open') } catch { return null }
}

// Página a abrir al cargar (la que usa usePersistedPage), o null.
export function pageFromSearch(search) {
  const target = openParam(search)
  return target !== null && hasOwn(PAGE_BY_OPEN, target) ? PAGE_BY_OPEN[target] : null
}

// Pestaña inicial de la pantalla de acceso: "signup" si el correo pidió crear
// cuenta (Diagnóstico), "login" en cualquier otro caso.
export function authTabFromSearch(search) {
  return openParam(search) === 'signup' ? 'signup' : 'login'
}
