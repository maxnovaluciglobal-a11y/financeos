// src/utils/trialUnsubscribe.js — baja de la secuencia de la prueba de Pro
// (C-35 / COM-10): enlace del pie de esos correos, ?unsub=trial&id=<uuid>.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function trialUnsubscribeTarget(search) {
  try {
    const p = new URLSearchParams(search || '')
    const id = p.get('id') || ''
    return p.get('unsub') === 'trial' && UUID_RE.test(id) ? id : null
  } catch { return null }
}

export async function unsubscribeTrial(id, { supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '', fetchImpl = fetch } = {}) {
  try {
    const res = await fetchImpl(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/lead-unsubscribe?t=trial&id=${encodeURIComponent(id)}`, { method: 'POST' })
    const data = await res.json().catch(() => null)
    return res.ok && data?.ok === true
  } catch { return false }
}
