// src/core/localAlerts/native.js — avisos locales en la app de tienda
// (@capacitor/local-notifications, en el repo nativo moyiq-ios-capacitor).
//
// Se pide por nombre con registerPlugin, como el resto de los plugins
// (src/native/bridge.js): acá solo hace falta @capacitor/core y este módulo
// solo se descarga dentro de la app (lo importa Host.jsx con import()).
// Permiso: iOS (UNUserNotificationCenter) y Android 13+ (POST_NOTIFICATIONS)
// lo piden con requestPermissions(); SIEMPRE después de la hoja de ejemplos
// (Host.jsx › requestLocalAlerts). Android 8+: canal propio "Avisos de tus
// finanzas" con importancia por defecto (sin sonido intrusivo extra).
import { registerPlugin } from '@capacitor/core'
import { localAlertsSupported } from './primer.js'
import { logRejection } from '../../utils/errorLog.js'
import { MIN_DELAY_MS } from './plan.js'

export const CHANNEL_ID = 'moyiq-finanzas'
const SRC = 'moyiq-local'

let plugin = null
function ln(win = globalThis) {
  if (!localAlertsSupported(win)) return null
  if (!plugin) plugin = registerPlugin('LocalNotifications')
  return plugin
}

export function localAlertsAvailable(win = globalThis) {
  return !!ln(win)
}

/** 'granted' | 'denied' | 'prompt' | 'unsupported' */
export async function localPermission() {
  const p = ln()
  if (!p) return 'unsupported'
  try {
    const r = await p.checkPermissions()
    return r?.display === 'granted' ? 'granted' : r?.display === 'denied' ? 'denied' : 'prompt'
  } catch { return 'unsupported' }
}

/** Pide el permiso del sistema. Resuelve { ok } | { ok: false, error }. */
export async function enableLocalAlerts() {
  const p = ln()
  if (!p) return { ok: false, error: 'unsupported' }
  try {
    const r = await p.requestPermissions()
    return r?.display === 'granted' ? { ok: true } : { ok: false, error: 'permission_denied' }
  } catch { return { ok: false, error: 'failed' } }
}

let channelDone = false
async function ensureChannel(p, name) {
  if (channelDone) return
  channelDone = true
  try {
    if (globalThis.Capacitor?.getPlatform?.() !== 'android') return
    await p.createChannel({ id: CHANNEL_ID, name, importance: 3, visibility: 0 })
  } catch { /* sin canal, Android usa el de por defecto del plugin */ }
}

// Lo que está por salir en estos segundos no se cancela: el ledger ya lo
// cuenta como entregado y no se volvería a programar (se perdería).
export const KEEP_SOON_MS = 15_000
const atMs = (n) => {
  const v = n?.schedule?.at
  const ms = v instanceof Date ? v.getTime() : Date.parse(String(v || ''))
  return Number.isFinite(ms) ? ms : NaN
}

/**
 * Reemplaza lo programado por `items` ({ id, at, title, body, key }; `at` ya
 * con la hora real de entrega, plan.js › withFireTimes). Solo toca las
 * notificaciones que programó moyiq (extra.src), y no las que salen dentro de
 * KEEP_SOON_MS. Resuelve { ok, scheduled } con lo que quedó programado (para
 * el ledger) o { ok: false, error }.
 */
export async function scheduleLocal(items, { channelName = 'moyiq', now = Date.now() } = {}) {
  const p = ln()
  if (!p) return { ok: false, error: 'unsupported', scheduled: [] }
  const pending = await p.getPending().catch(() => ({ notifications: [] }))
  const ours = (pending?.notifications || []).filter(n => n?.extra?.src === SRC)
  const keep = new Set(ours.filter(n => atMs(n) <= now + KEEP_SOON_MS).map(n => n.id))
  const drop = ours.filter(n => !keep.has(n.id))
  // Si cancelar falla, schedule() con los mismos ids igual reemplaza lo viejo.
  if (drop.length) await p.cancel({ notifications: drop.map(n => ({ id: n.id })) }).catch(logRejection('localAlerts:cancel'))
  const list = items.filter(it => !keep.has(it.id)).map(it => ({ ...it, at: Math.max(it.at, now + MIN_DELAY_MS) }))
  if (!list.length) return { ok: true, count: 0, scheduled: [] }
  await ensureChannel(p, channelName)
  try {
    await p.schedule({
      notifications: list.map(it => ({
        id: it.id,
        title: it.title,
        body: it.body,
        // El plugin espera la fecha como ISO (Date viaja como string por el puente).
        schedule: { at: new Date(it.at) },
        channelId: CHANNEL_ID,
        smallIcon: 'ic_stat_moyiq',
        iconColor: '#3C2282',
        extra: { src: SRC, key: it.key },
      })),
    })
  } catch (err) {
    logRejection('localAlerts:schedule')(err)
    return { ok: false, error: 'failed', scheduled: [] }
  }
  return { ok: true, count: list.length, scheduled: list }
}
