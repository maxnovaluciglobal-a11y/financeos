// src/core/localAlerts/primer.js — camino propio al permiso de avisos LOCALES
// (app de tienda), separado de core/pushPrimer.js (push web del servidor).
// Mismo principio: nadie pide el permiso del sistema sin pasar antes por la
// hoja de ejemplos (components/PushAsk.jsx con mode="local"). La hoja la abre
// Host.jsx, que registra el anfitrión; sin anfitrión (tests, una pantalla
// suelta), resuelve { ok: false, error: 'unavailable' } sin pedir nada.
import { isNativeApp } from '../../native/platform.js'

let host = null

/**
 * ¿La app de tienda trae el plugin de avisos locales? Síncrono y sin cargar
 * @capacitor/core: lo usan Primeros pasos (Inicio) y native.js.
 */
export function localAlertsSupported(win = globalThis) {
  if (!isNativeApp(win)) return false
  try { return win.Capacitor?.isPluginAvailable?.('LocalNotifications') === true } catch { return false }
}

/** @param {null | ((opts: { source?: string }) => Promise<{ ok: boolean, error?: string }>)} fn */
export function setLocalPrimerHost(fn) {
  host = typeof fn === 'function' ? fn : null
  return () => { if (host === fn) host = null }
}

/** @param {{ source?: string }} [opts] */
export function requestLocalAlerts(opts = {}) {
  return host ? host(opts) : Promise.resolve({ ok: false, error: 'unavailable' })
}

// Pedido automático de la app de tienda: misma regla que el de la web
// (core/pushAsk.js: después del 3.er movimiento, "Ahora no" pospone 14 días y a
// los 3 no se ofrece solo), con su propia clave para no mezclar estados.
export const LOCAL_ASKED_KEY = 'fos_local_ask'

import { readPushAsk, pushAskSnoozed, PUSH_ASK_MIN_MOVEMENTS } from '../pushAsk.js'

/** @param {{ available: boolean, permission: string, asked?: string | null, isDemo?: boolean, movementCount?: number, now?: number }} p */
export function shouldAskLocal({ available, permission, asked = null, isDemo = false, movementCount = 0, now = Date.now() }) {
  if (!available || isDemo || permission !== 'prompt') return false
  if (pushAskSnoozed(readPushAsk(asked, now), now)) return false
  return (Number(movementCount) || 0) >= PUSH_ASK_MIN_MOVEMENTS
}
