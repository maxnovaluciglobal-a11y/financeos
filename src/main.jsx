// src/main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { installGlobalErrorLog } from './utils/errorLog.js'
import { detectLanguage } from './i18n/translate.js'
import { installWebAnalytics } from './utils/webAnalytics.js'
import { watchServiceWorkerUpdates } from './core/swUpdate.js'
import { skewCookieStrings, clearSkewCookieStrings } from './utils/skewCookie.js'

// Skew Protection (C-49): fija este deploy SOLO para los chunks lazy de
// /app/assets (cookie técnica de Vercel, sin seguimiento). Vacío en local.
// Con path=/app también se fijaban el HTML y sw.js y el usuario quedaba en la
// versión anterior toda la sesión: ver utils/skewCookie.js.
/* global __VERCEL_DPL__ */
// Con un SW al mando (o cuando toma el mando) la cookie se borra: los chunks
// salen de su precache y la cookie ataba la actualización del SW al despliegue
// viejo (ver utils/skewCookie.js).
try {
  const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : null
  const dpl = typeof __VERCEL_DPL__ === 'string' ? __VERCEL_DPL__ : ''
  for (const c of skewCookieStrings(dpl, { controlled: !!sw?.controller })) document.cookie = c
  if (dpl) sw?.addEventListener?.('controllerchange', () => { for (const c of clearSkewCookieStrings()) document.cookie = c })
} catch { /* almacenamiento o API del navegador no disponible: se sigue sin ello */ }

installGlobalErrorLog()
installWebAnalytics()

// index.html trae lang="es" fijo; hasta que AppContext/DemoContext lean los
// ajustes, el primer pintado usa el idioma del navegador (mismo criterio que el
// primer arranque). Después lo actualiza rehydrate()/updateSettings().
try { document.documentElement.lang = detectLanguage() } catch { /* almacenamiento o API del navegador no disponible: se sigue sin ello */ }

// REVERTIDO 2026-08-27: se probó Object.freeze(Object.prototype) acá como mitigación
// de la vulnerabilidad de prototype pollution de xlsx@0.18.5 (GHSA-4r6h-8v6p-xvw6).
// Rompió en producción: Recharts (usado por CategoryDonut y otros charts) SÍ escribe
// sobre Object.prototype en su propio código interno, y con el prototype congelado
// tira "Cannot assign to read only property 'constructor'" — el Dashboard entero caía
// al ErrorBoundary. Verificado en vivo en el demo antes de revertir.
// RESUELTO DE VERDAD 2026-08-29: xlsx reemplazado por exceljs en
// src/pages/Import/fileParser.js (sin ese CVE), con tests nuevos que cubren el
// parseo real (header en fila arbitraria, fechas, filas vacías) — ver memoria.

// ── Recuperación automática de pantalla en blanco tras un deploy ────────────
// Si un chunk lazy falla al cargar (la versión desplegada cambió y el archivo
// con hash viejo ya no existe), recargamos la página UNA vez para tomar la
// versión nueva — sin esto el usuario ve una pantalla vacía hasta refrescar.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  try {
    const KEY = 'fnos_chunk_reload_at'
    const last = Number(sessionStorage.getItem(KEY) || 0)
    if (Date.now() - last < 15000) return // evita bucles de recarga
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch { /* sin sessionStorage: se recarga igual, una vez */ }
  window.location.reload()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)

// Register service worker for PWA (only in production)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    // H14 (ola A11): aviso de versión nueva cuando el SW nuevo toma control.
    watchServiceWorkerUpdates(navigator.serviceWorker)
    navigator.serviceWorker.register('/app/sw.js', { scope: '/app/' })
      .then(reg => {
        // Buscar versión nueva al volver a la app (pestaña visible de nuevo)
        document.addEventListener('visibilitychange', () => {
          // eslint-disable-next-line no-restricted-syntax -- chequeo de versión nueva del SW: sin red falla y se reintenta al volver a la pestaña
          if (document.visibilityState === 'visible') reg.update().catch(() => {})
        })
      })
      .catch(console.error)
  })
}
