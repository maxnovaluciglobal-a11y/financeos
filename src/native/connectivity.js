// src/native/connectivity.js — ¿hay red antes de abrir el inicio con Google/Apple? (AND-14, R3-1)
//
// En la WebView de Android `navigator.onLine` sigue en true sin red (modo avión
// incluido), así que el aviso de 4d4e592 nunca salía y Chrome se abría en
// «No internet». En la app nativa se pregunta al sistema con el plugin Network
// (@capacitor/network, repo nativo); si el plugin no está (AAB viejo) o falla,
// se prueba un fetch corto al health de Supabase Auth. En la web no cambia nada:
// solo `navigator.onLine`, sin latencia extra.
//
// La decisión (canStartOAuth) es pura: recibe todo inyectado para poder probarla.
import { registerPlugin } from '@capacitor/core'
import { isNativeApp } from './platform.js'

export const PROBE_TIMEOUT_MS = 2500

/** URL del health de Supabase Auth a partir de VITE_SUPABASE_URL ('' si no hay). */
export function authHealthUrl(supabaseUrl) {
  const base = String(supabaseUrl || '').trim().replace(/\/+$/, '')
  return base ? `${base}/auth/v1/health` : ''
}

/**
 * Prueba de alcance: cualquier respuesta HTTP (aunque sea 401 por falta de
 * apikey) prueba que hay red; solo un error de red o el timeout cuentan como sin red.
 */
export async function probeReachable(url, { fetchImpl = globalThis.fetch, timeoutMs = PROBE_TIMEOUT_MS } = {}) {
  if (!url || typeof fetchImpl !== 'function') return true // sin forma de probar: no bloquear
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null
  let timer
  const timeout = new Promise(resolve => {
    timer = setTimeout(() => { try { ctrl?.abort() } catch { /* nada */ } resolve(false) }, timeoutMs)
  })
  const attempt = Promise.resolve()
    .then(() => fetchImpl(url, { method: 'GET', mode: 'no-cors', cache: 'no-store', signal: ctrl?.signal }))
    .then(() => true, () => false)
  try { return await Promise.race([attempt, timeout]) } finally { clearTimeout(timer) }
}

/**
 * true si conviene abrir el navegador de OAuth; false = mostrar el aviso sin red.
 *   onLine            navigator.onLine (false es definitivo en cualquier plataforma)
 *   native            corre en la app de Capacitor
 *   getNetworkStatus  () => Promise<{ connected }> del plugin Network, o null si no está
 *   probe             () => Promise<boolean>, respaldo cuando no hay plugin o falla
 */
export async function canStartOAuth({ onLine, native, getNetworkStatus, probe }) {
  if (onLine === false) return false
  if (!native) return true
  if (typeof getNetworkStatus === 'function') {
    try {
      const status = await getNetworkStatus()
      if (typeof status?.connected === 'boolean') return status.connected
    } catch { /* plugin roto: cae a la prueba */ }
  }
  if (typeof probe === 'function') {
    try { return (await probe()) !== false } catch { return true }
  }
  return true
}

let Network = null
function networkStatusFn(win) {
  try {
    if (win?.Capacitor?.isPluginAvailable?.('Network') !== true) return null
    Network = Network || registerPlugin('Network')
    return () => Network.getStatus()
  } catch { return null }
}

/** Uso real desde AuthGate. */
export function hasNetworkForOAuth(win = globalThis) {
  let onLine
  try { onLine = win?.navigator?.onLine } catch { onLine = undefined }
  const native = isNativeApp(win)
  const url = authHealthUrl(import.meta.env.VITE_SUPABASE_URL)
  return canStartOAuth({
    onLine,
    native,
    getNetworkStatus: native ? networkStatusFn(win) : null,
    probe: () => probeReachable(url, { fetchImpl: win?.fetch?.bind(win) }),
  })
}
