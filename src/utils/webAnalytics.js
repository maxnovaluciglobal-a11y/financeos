// src/utils/webAnalytics.js — Vercel Web Analytics en la app (D-03, C-14).
//
// Sin cookies. Solo en los dominios de producción. Cuenta aperturas de la app
// (es una SPA: la URL no cambia al navegar), con la URL sin parámetros salvo
// utm_* y ref, y sin hash. No mide si el navegador envía No rastrear o Global
// Privacy Control, si se desactivó en este navegador ('va-disable', el mismo
// botón de moyiq.app/privacy) ni a las cuentas internas (is_internal, DAT-9).
// Ningún dato financiero, email ni id de cuenta sale por acá.
//
// Eventos de conversión (WEB-N1 / BIZ-N3): trackEvent() manda con
// window.va('event') un nombre fijo y como mucho dos propiedades cortas (el
// límite del plan Pro): el origen de la primera visita (`src`, una etiqueta
// como 'guia-cl', 'google.com' o 'directo') y un detalle del botón. El origen
// se guarda solo en este dispositivo (localStorage, FIRST_TOUCH_KEY), nunca va
// con el alta ni a la base, y no identifica a nadie: es el mismo valor para
// todos los que llegaron por el mismo enlace.
//
// Tráfico interno (V-WEB-FN1): abrir la app con ?interno=1 apaga la medición en
// este navegador ('va-disable'); ?interno=0 la vuelve a prender.

export const ANALYTICS_HOSTS = ['app.moyiq.app', 'demo.moyiq.app']
export const INTERNAL_KEY = 'fnos_internal_user'
const INTERNAL_RE = /(walterlamadriz|maxnovaluciglobal|lamadriz)|@example\.(com|net|org)$|(^|[._+-])(test|prueba)[0-9]*([._+@-]|$)/

export function isInternalEmail(email) {
  return INTERNAL_RE.test(String(email || '').toLowerCase())
}

function lsGet(storage, k) { try { return storage?.getItem(k) } catch { return null } }
function lsSet(storage, k, v) { try { storage?.setItem(k, v) } catch { /* sin almacenamiento: se sigue sin ello */ } }
function lsDel(storage, k) { try { storage?.removeItem(k) } catch { /* sin almacenamiento: se sigue sin ello */ } }

export const FIRST_TOUCH_KEY = 'fnos_first_touch'
const FIRST_TOUCH_TTL_MS = 90 * 24 * 60 * 60 * 1000
const OWN_HOSTS_RE = /(^|\.)moyiq\.app$/

// Etiqueta corta y sin datos personales: minúsculas, [a-z0-9._-], 40 caracteres.
// Un valor con '@' (un correo pegado en ?ref=) se descarta entero.
export function cleanLabel(v) {
  if (String(v ?? '').includes('@')) return null
  const s = String(v ?? '').trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  return s || null
}

// Origen de esta visita: ref, si no utm_source (+ '_' + utm_campaign), si no el
// sitio de origen (solo el dominio y si no es de moyiq), si no 'directo'.
export function sourceFromVisit(search, referrer) {
  let q
  try { q = new URLSearchParams(search || '') } catch { q = new URLSearchParams() }
  const ref = cleanLabel(q.get('ref'))
  if (ref) return ref
  const utm = cleanLabel(q.get('utm_source'))
  if (utm) {
    const camp = cleanLabel(q.get('utm_campaign'))
    return camp ? cleanLabel(`${utm}_${camp}`) : utm
  }
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '')
    if (host && !OWN_HOSTS_RE.test(host)) return cleanLabel(host)
  } catch { /* sin referrer válido */ }
  return 'directo'
}

// Guarda el origen de la primera visita (90 días). Una visita 'directo' no
// pisa un origen real; un origen real sí reemplaza a un 'directo' guardado.
export function captureFirstTouch({ search, referrer, storage, now = Date.now() }) {
  const src = sourceFromVisit(search, referrer)
  let prev = null
  try { prev = JSON.parse(lsGet(storage, FIRST_TOUCH_KEY) || 'null') } catch { prev = null }
  const fresh = prev && typeof prev.src === 'string' && now - Number(prev.at) < FIRST_TOUCH_TTL_MS
  if (fresh && (prev.src !== 'directo' || src === 'directo')) return prev.src
  lsSet(storage, FIRST_TOUCH_KEY, JSON.stringify({ src, at: now }))
  return src
}

export function firstTouchSource(storage) {
  try {
    const v = JSON.parse(lsGet(storage, FIRST_TOUCH_KEY) || 'null')
    return cleanLabel(v?.src) || 'directo'
  } catch { return 'directo' }
}

// ?interno=1 / ?interno=0: marca o desmarca este navegador como de uso interno.
export function applyInternalParam(search, storage) {
  let v = null
  try { v = new URLSearchParams(search || '').get('interno') } catch { v = null }
  if (v === '1') lsSet(storage, 'va-disable', '1')
  else if (v === '0') lsDel(storage, 'va-disable')
}

// Evento de conversión. Solo existe window.va en los dominios de producción
// (installWebAnalytics), y beforeSend aplica las mismas exclusiones que a las
// visitas. `detail` es un objeto con UNA propiedad corta ({ plan: 'annual' }).
export const EVENTS = ['signup_start', 'signup_done', 'checkout_start', 'demo_click', 'demo_gate_pass']
export function trackEvent(name, detail = {}, win = typeof window !== 'undefined' ? window : null) {
  if (!win || typeof win.va !== 'function' || !EVENTS.includes(name)) return false
  const data = { src: firstTouchSource(lsStorage(win)) }
  const [k, v] = Object.entries(detail || {})[0] || []
  if (k && cleanLabel(v)) data[cleanLabel(k)] = cleanLabel(v)
  try { win.va('event', { name, data }); return true } catch { return false }
}
function lsStorage(win) { try { return win.localStorage } catch { return null } }

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
  } catch { /* sin almacenamiento: el navegador no queda marcado como interno */ }
}

export function installWebAnalytics(win = typeof window !== 'undefined' ? window : null) {
  if (!win || !ANALYTICS_HOSTS.includes(win.location?.hostname)) return Promise.resolve(false)
  const storage = lsStorage(win)
  applyInternalParam(win.location?.search, storage)
  captureFirstTouch({ search: win.location?.search, referrer: win.document?.referrer, storage })
  win.va = win.va || function () { (win.vaq = win.vaq || []).push(arguments) }
  win.va('beforeSend', makeBeforeSend({ nav: win.navigator, win, storage }))
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
