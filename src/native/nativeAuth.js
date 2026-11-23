// src/native/nativeAuth.js — inicio con Google/Apple dentro de la app nativa.
//
// Google bloquea el inicio de sesión dentro de vistas web embebidas, y la vuelta
// de Supabase no puede apuntar a capacitor://localhost. Por eso:
//   1. signInWithOAuth con skipBrowserRedirect y redirectTo moyiq://auth-callback
//      (cliente con flowType 'pkce', ver core/authClient.js);
//   2. la URL del proveedor se abre con @capacitor/browser (SFSafariViewController
//      en iOS, Custom Tabs en Android: navegador del sistema, permitido por Google);
//   3. el proveedor vuelve a moyiq://auth-callback?code=…, el sistema abre la app,
//      native/bridge.js recibe appUrlOpen y llama a completeNativeOAuth().
// Requisito en Supabase (Walter): agregar moyiq://auth-callback a Auth → URL
// Configuration → Redirect URLs. Sin eso Supabase vuelve al Site URL (la web).
//
// NAT-5 / SEC-N2: el esquema moyiq:// no es exclusivo (cualquier página o app
// puede abrir moyiq://auth-callback…). Por eso la vuelta solo se acepta si esta
// app inició un OAuth hace menos de 10 minutos (marca de un solo uso) y solo
// con ?code= (PKCE: sin el verificador que guardó el cliente, el canje falla).
// Ya no se aceptan tokens en el fragmento (#access_token=…): con eso se podía
// dejar a la persona con la sesión iniciada en la cuenta de otro.
//
// Límite aceptado (revisión del paquete nativo, 19-nov-2026): si, con un OAuth
// legítimo en curso, llega otro moyiq://auth-callback?code=X ajeno, ese enlace
// consume la marca, cierra el navegador y el canje falla (bad_code_verifier):
// no hay toma de sesión, pero la vuelta buena posterior se ignora y la persona ve
// authGate.errorNativeOAuth y tiene que reintentar. Consumir la marca solo si el
// canje sale bien no lo arregla: supabase-js (auth-js, _exchangeCodeForSession)
// borra el verificador PKCE también cuando el canje falla, así que la vuelta buena
// fallaría igual. Arreglarlo exigiría guardar y restaurar el verificador por fuera
// de supabase-js; no vale el riesgo para una molestia que no es de seguridad.
import { registerPlugin } from '@capacitor/core'
import { AUTH_CALLBACK } from './nativeLinks.js'

const Browser = registerPlugin('Browser')

export const OAUTH_PENDING_KEY = 'fnos_native_oauth_pending'
export const OAUTH_PENDING_TTL_MS = 10 * 60 * 1000

function defaultStorage() {
  try { return globalThis.localStorage || null } catch { return null }
}

// localStorage (no sessionStorage): en Android el sistema puede cerrar la app
// mientras la persona está en Custom Tabs, y la marca tiene que sobrevivir.
export function markOAuthPending(provider, { storage = defaultStorage(), now = Date.now() } = {}) {
  try { storage?.setItem(OAUTH_PENDING_KEY, JSON.stringify({ provider, at: now })) } catch { /* sin almacenamiento: la vuelta se ignorará */ }
}

export function clearOAuthPending({ storage = defaultStorage() } = {}) {
  try { storage?.removeItem(OAUTH_PENDING_KEY) } catch { /* nada que limpiar */ }
}

/** Lee y borra la marca (un solo uso). true si había un OAuth en curso y no venció. */
export function takeOAuthPending({ storage = defaultStorage(), now = Date.now() } = {}) {
  let raw = null
  try { raw = storage?.getItem(OAUTH_PENDING_KEY) ?? null } catch { return false }
  clearOAuthPending({ storage })
  if (!raw) return false
  try {
    const at = Number(JSON.parse(raw)?.at)
    return Number.isFinite(at) && at <= now && now - at <= OAUTH_PENDING_TTL_MS
  } catch { return false }
}

export async function nativeOAuth(authClient, provider, opts) {
  const { data, error } = await authClient.auth.signInWithOAuth({
    provider,
    options: { redirectTo: AUTH_CALLBACK, skipBrowserRedirect: true },
  })
  if (error) return { error: error.message }
  if (!data?.url) return { error: 'oauth_no_url' }
  markOAuthPending(provider, opts)
  try { await Browser.open({ url: data.url, presentationStyle: 'popover' }) } catch (e) {
    clearOAuthPending(opts)
    return { error: String(e?.message || e) }
  }
  return {}
}

/**
 * Vuelta de moyiq://auth-callback. `ignored: true` cuando no hay un OAuth en
 * curso: el enlace no vino de esta app y no se muestra nada.
 */
export async function completeNativeOAuth(authClient, { code, error: providerError } = {}, opts) {
  if (!takeOAuthPending(opts)) return { error: 'oauth_not_pending', ignored: true }
  try { await Browser.close() } catch { /* Android: no hay vista que cerrar */ }
  if (!authClient) return { error: 'auth_not_configured' }
  if (providerError) return { error: String(providerError) }
  if (!code) return { error: 'oauth_no_code' }
  const { error } = await authClient.auth.exchangeCodeForSession(code)
  return error ? { error: error.message } : {}
}
