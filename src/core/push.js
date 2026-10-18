// src/core/push.js
// Notificaciones push opcionales (recordatorios de sistema — nunca datos financieros).
// Ligadas a la licencia, igual patrón que el sync. Apagado por defecto (opt-in).

import { getLicenseKey } from '../utils/licenseValidator.js'
import { licenseKeyHash } from '../utils/syncCrypto.js'
import { authClient } from './authClient.js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY
const VAPID_PUBLIC_KEY = 'BEASQMLXqMEigtg3UNDHW9WWQJT3mejjI9u5CW_yI1t-tuEEd6N8r22KL4ruTxWMXLlKj_z70TPkuMpoNaXgR9U'

const LS_ON = 'fnos_push_on'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

export function isPushEnabled() {
  try { return localStorage.getItem(LS_ON) === '1' } catch { return false }
}

// Igual que sync.js: el servidor ata la suscripción a la cuenta de la sesión.
async function rpc(fn, body) {
  const { data } = (await authClient?.auth.getSession()) || {}
  const token = data?.session?.access_token
  if (!token) throw new Error('no_session')
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${fn} ${res.status}`)
  return res.json()
}

// Pide permiso al usuario, suscribe el navegador y guarda la suscripción en el servidor.
export async function enablePush() {
  if (!pushSupported()) return { ok: false, error: 'unsupported' }
  const key = getLicenseKey()
  if (!key || !SUPABASE_URL || !SUPABASE_ANON) return { ok: false, error: 'no_license' }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, error: 'permission_denied' }

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }
  const json = sub.toJSON()
  const r = await rpc('save_push_subscription', {
    p_key: await licenseKeyHash(key), p_endpoint: json.endpoint, p_p256dh: json.keys.p256dh, p_auth: json.keys.auth,
  })
  if (!(r && r.ok)) return { ok: false, error: r?.error || 'save_failed' }

  try { localStorage.setItem(LS_ON, '1') } catch {}
  return { ok: true }
}

export async function disablePush() {
  try { localStorage.setItem(LS_ON, '0') } catch {}
  if (!pushSupported()) return { ok: true }
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await rpc('delete_push_subscription', { p_endpoint: sub.endpoint }).catch(() => {})
      await sub.unsubscribe()
    }
  } catch {}
  return { ok: true }
}
