// src/native/nativeLinks.js — de un enlace que abre la app nativa a la URL
// interna de la app.
//
// Entran tres formas (App.addListener('appUrlOpen') y App.getLaunchUrl()):
//   moyiq://add?monto=12500&comercio=Lider        alta rápida (mismo contrato que
//   moyiq://add?add=ingreso&monto=…               ?add= de utils/autoEntry.js)
//   moyiq://open/import  ·  moyiq://app?open=…    destinos de ?open= (deepLink.js)
//   moyiq://demo?persona=ve                       demo sin cuenta (revisión de Apple)
//   https://app.moyiq.app/app/?…                  enlace universal / App Link
//   moyiq://auth-callback?code=…                  vuelta del inicio con Google/Apple (PKCE)
//
// Solo pasan los parámetros conocidos; cualquier otro se descarta. El destino
// siempre es /app/ en el mismo origen local: un enlace nunca hace que la vista
// web cargue otro sitio. La persona confirma el alta (autoEntry nunca guarda sola).

export const NATIVE_SCHEME = 'moyiq:'
export const AUTH_CALLBACK = 'moyiq://auth-callback'
// bridge.js lo emite si falla el canje del OAuth; AuthGate lo escucha.
export const NATIVE_OAUTH_ERROR_EVENT = 'fnos:native-oauth-error'
export const UNIVERSAL_HOSTS = ['app.moyiq.app', 'demo.moyiq.app']

// Mismo contrato que INTAKE_PARAMS (utils/autoEntry.js, rama feat/registro-automatico).
export const INTAKE_PARAMS = ['add', 'monto', 'comercio', 'moneda', 'fuente', 'fecha']
const APP_PARAMS = ['open', 'plan', 'ref', 'signup', 'demo', 'persona', ...INTAKE_PARAMS]
const MAX_URL = 2048

function pick(params, keys) {
  const out = new URLSearchParams()
  for (const k of keys) {
    const v = params.get(k)
    if (v !== null) out.set(k, v.slice(0, 300))
  }
  return out
}

function toPath(params) {
  const q = params.toString()
  return q ? `/app/?${q}` : '/app/'
}

/**
 * @returns {null | { kind: 'auth', code: string|null, error: string|null }
 *                | { kind: 'path', path: string }}
 */
export function parseNativeUrl(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > MAX_URL) return null
  let u
  try { u = new URL(raw) } catch { return null }

  if (u.protocol === 'https:') {
    if (!UNIVERSAL_HOSTS.includes(u.hostname)) return null
    if (!/^\/app(\/|$)/.test(u.pathname)) return { kind: 'path', path: '/app/' }
    const params = pick(u.searchParams, APP_PARAMS)
    if (u.hostname === 'demo.moyiq.app' && !params.has('demo')) params.set('demo', 'true')
    return { kind: 'path', path: toPath(params) }
  }
  if (u.protocol !== NATIVE_SCHEME) return null

  // moyiq://host/seg?… — en URL() el "host" de un esquema no especial queda en
  // pathname ("//add") según el navegador; se normaliza a segmentos.
  const segs = `${u.host}${u.pathname}`.replace(/^\/+/, '').split('/').filter(Boolean)
  const head = (segs[0] || '').toLowerCase()

  if (head === 'auth-callback') {
    // Solo ?code= (PKCE). Un #access_token del fragmento se ignora (NAT-5).
    const error = u.searchParams.get('error_description') || u.searchParams.get('error')
    return { kind: 'auth', code: u.searchParams.get('code'), error: error ? error.slice(0, 300) : null }
  }
  if (head === 'add') {
    const given = pick(u.searchParams, INTAKE_PARAMS)
    const params = new URLSearchParams()
    params.set('add', given.get('add') || (segs[1] === 'ingreso' || segs[1] === 'income' ? 'ingreso' : 'gasto'))
    for (const [k, v] of given) if (k !== 'add') params.set(k, v)
    if (!params.has('fuente')) params.set('fuente', 'app')
    return { kind: 'path', path: toPath(params) }
  }
  if (head === 'open' && segs[1]) {
    const params = pick(u.searchParams, APP_PARAMS)
    params.set('open', segs[1])
    return { kind: 'path', path: toPath(params) }
  }
  if (head === 'demo') {
    const params = pick(u.searchParams, ['persona'])
    params.set('demo', 'true')
    return { kind: 'path', path: toPath(params) }
  }
  if (head === '' || head === 'app') {
    return { kind: 'path', path: toPath(pick(u.searchParams, APP_PARAMS)) }
  }
  return null
}
