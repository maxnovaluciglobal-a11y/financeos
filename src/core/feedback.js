// src/core/feedback.js — "Enviar comentarios" (auditoría 360, C-39 / PRD-5).
// Llama a la Edge Function send-feedback con la sesión. El registro técnico
// solo va si la persona lo marca, y nunca lleva montos: los números largos de
// los mensajes de error se reemplazan por "#".
import { getClientErrorLog } from '../utils/errorLog.js'

export function sanitizeLogMessage(msg) {
  return String(msg ?? '').replace(/\d[\d.,]{2,}/g, '#').slice(0, 300)
}

export function technicalLog(entries = getClientErrorLog()) {
  const list = Array.isArray(entries) ? entries.slice(-20) : []
  return list.map((e) => [e?.at || '', e?.type || '', sanitizeLogMessage(e?.message), e?.source || ''].filter(Boolean).join(' | ')).join('\n')
}

function functionsUrl() {
  return (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '') + '/functions/v1/send-feedback'
}

// kind 'nps': el NPS automático (PRD-5), con el comentario opcional.
export async function sendFeedback({ accessToken, message, nps = null, includeLog = false, meta = {}, kind = null }, fetchImpl = fetch) {
  if (!accessToken) return { ok: false, error: 'session_required' }
  const body = { message, nps, meta }
  if (kind === 'nps') body.kind = 'nps'
  if (includeLog) body.log = technicalLog()
  let res
  try {
    res = await fetchImpl(functionsUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    })
  } catch {
    return { ok: false, error: 'network' }
  }
  let data = null
  try { data = await res.json() } catch { data = null }
  if (res.ok && data?.ok === true) return { ok: true }
  return { ok: false, error: (data && typeof data.error === 'string' && data.error) || `http_${res.status}` }
}
