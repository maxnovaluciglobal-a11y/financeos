// src/core/pushPrimer.js — un solo camino al permiso de avisos (24-nov-2026).
// Nadie llama a Notification.requestPermission() sin pasar antes por la hoja
// de ejemplos (components/PushAsk.jsx): Ajustes › Notificaciones, Inversiones
// (alertas de precio), "Primeros pasos" y el pedido automático del Shell.
// El Shell registra el anfitrión que abre la hoja; sin anfitrión (una pantalla
// suelta en un test) se cae directo a enablePush, como antes. Si el permiso
// del navegador ya está concedido no hay nada que explicar: se activa directo.
import { isNativeApp } from '../native/platform.js'

let host = null

/** @param {null | ((opts: { source?: string }) => Promise<{ ok: boolean, error?: string }>)} fn */
export function setPushPrimerHost(fn) {
  host = typeof fn === 'function' ? fn : null
  return () => { if (host === fn) host = null }
}

/**
 * Cola de pedidos del anfitrión (Shell): cada pedido espera el resultado de
 * la hoja abierta; un resultado resuelve a todos los que esperaban.
 * @param {(opts: any) => void} open
 */
export function createPrimerQueue(open) {
  /** @type {Array<(r: any) => void>} */
  const waiters = []
  return {
    request: (opts = {}) => new Promise((resolve) => { waiters.push(resolve); open(opts) }),
    settle: (r) => { const ws = waiters.splice(0); for (const w of ws) w(r); return ws.length },
  }
}

const granted = () => typeof Notification !== 'undefined' && Notification.permission === 'granted'

/**
 * Abre la hoja de ejemplos y, solo si la persona toca "Permitir", pide el
 * permiso. Resuelve { ok } | { ok: false, error: 'dismissed' | 'permission_denied' | 'unsupported' | … }.
 * @param {{ source?: string }} [opts]
 */
export async function requestPushPermission(opts = {}) {
  // La app de tienda no envía avisos (defensa en profundidad: nadie la ofrece ahí).
  if (isNativeApp()) return { ok: false, error: 'unsupported' }
  if (host && !granted()) return host(opts)
  const [{ enablePush }, { recordPushResult }] = await Promise.all([import('./push.js'), import('./pushAsk.js')])
  const r = await enablePush()
  recordPushResult(r)
  return r
}
