// src/utils/webAnalytics.js — Vercel Web Analytics en la app (D-03, C-14).
//
// Sin cookies. Solo en los dominios de producción. Cuenta aperturas de la app
// (es una SPA: la URL no cambia al navegar), con la URL sin parámetros salvo
// utm_* y ref, y sin hash. No mide si el navegador envía No rastrear o Global
// Privacy Control, si se desactivó en este navegador ('va-disable', el mismo
// botón de moyiq.app/privacy) ni a las cuentas internas (is_internal, DAT-9).
// Ningún dato financiero, email ni id de cuenta sale por acá.

export const ANALYTICS_HOSTS = ['app.moyiq.app', 'demo.moyiq.app']
export const INTERNAL_KEY = 'fnos_internal_user'
const INTERNAL_RE = /(walterlamadriz|maxnovaluciglobal|lamadriz)|@example\.(com|net|org)$|(^|[._+-])(test|prueba)[0-9]*([._+@-]|$)/

export function isInternalEmail(email) {
  return INTERNAL_RE.test(String(email || '').toLowerCase())
}

function lsGet(storage, k) { try { return storage?.getItem(k) } catch { return null } }

export function makeBeforeSend({ nav, win, storage }) {
  return (event) => {
    if (lsGet(storage, 'va-disable') || lsGet(storage, INTERNAL_KEY) === '1') return null
    if (nav?.doNotTrack === '1' || win?.doNotTrack === '1' || nav?.msDoNotTrack === '1' || nav?.globalPrivacyControl === true) return null
    try {
      const u = new URL(event.url)
      for (const k of Array.from(u.searchParams.keys())) {
        if (!/^(utm_(source|medium|campaign|term|content)|ref)$/.test(k)) u.searchParams.delete(k)
      }
      u.hash = ''
      return { ...event, url: u.toString() }
    } catch { return null }
  }
}

// Marca (o desmarca) este navegador como de uso interno según la cuenta activa.
export function markInternalUser(email, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  try {
    if (isInternalEmail(email)) storage?.setItem(INTERNAL_KEY, '1')
    else storage?.removeItem(INTERNAL_KEY)
  } catch {}
}

export function installWebAnalytics(win = typeof window !== 'undefined' ? window : null) {
  if (!win || !ANALYTICS_HOSTS.includes(win.location?.hostname)) return Promise.resolve(false)
  win.va = win.va || function () { (win.vaq = win.vaq || []).push(arguments) }
  win.va('beforeSend', makeBeforeSend({ nav: win.navigator, win, storage: win.localStorage }))
  // Mientras Web Analytics no esté habilitado en el proyecto de Vercel, el
  // script responde 404 text/plain: se comprueba antes de insertarlo para no
  // dejar un error de MIME en la consola.
  const src = '/_vercel/insights/script.js'
  const inject = () => {
    const s = win.document.createElement('script')
    s.defer = true
    s.src = src
    win.document.head.appendChild(s)
  }
  const check = typeof win.fetch === 'function' ? win.fetch(src, { method: 'HEAD' }) : Promise.resolve(null)
  return check.then(r => {
    if (r && r.ok && /javascript/.test(r.headers?.get?.('content-type') || '')) { inject(); return true }
    return false
  }).catch(() => false)
}
