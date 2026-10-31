// src/core/investHandoff.js — "Abrir Invest" con la sesión iniciada.
//
// Nunca se pasa el refresh token ni la sesión de MOY IQ: Auth rota el refresh
// token y, si dos clientes usan la misma familia, la revoca y cierra la sesión
// de los dos. La Edge Function invest-handoff entrega un token de un solo uso
// (`hashed_token` de un magic link que no se envía) e Invest abre con él una
// sesión independiente. Sin handoff, Invest abre igual y pide iniciar sesión.
import { authClient } from './authClient.js'
import { INVEST_ORIGIN } from './investBridge.js'

const TIMEOUT_MS = 8000

function functionsUrl() {
  return (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '') + '/functions/v1/invest-handoff'
}

// Errores: session_required · no_email · origin_not_allowed · link_failed · network · http_<status>.
export async function requestHandoff(accessToken, fetchImpl = (...a) => fetch(...a)) {
  if (!accessToken) return { ok: false, error: 'session_required' }
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null
  const id = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null
  let res
  try {
    res = await fetchImpl(functionsUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        Authorization: `Bearer ${accessToken}`,
      },
      body: '{}',
      ...(ctrl ? { signal: ctrl.signal } : {}),
    })
  } catch {
    return { ok: false, error: 'network' }
  } finally {
    if (id) clearTimeout(id)
  }
  let body = null
  try { body = await res.json() } catch { body = null }
  if (res.ok && body?.ok === true && typeof body.token_hash === 'string' && body.token_hash) {
    return { ok: true, tokenHash: body.token_hash, uid: body.uid }
  }
  return { ok: false, error: (body && typeof body.error === 'string' && body.error) || `http_${res.status}` }
}

// Todo va en el fragmento: no viaja al servidor ni queda en logs. Invest lo lee
// y lo borra de la URL antes de cargar cualquier otra cosa.
export function buildInvestUrl({ tokenHash, uid, aporte } = {}) {
  const f = new URLSearchParams()
  if (tokenHash) { f.set('handoff', tokenHash); if (uid) f.set('uid', uid) }
  if (aporte) {
    f.set('aporte', String(aporte.amount))
    if (aporte.ccy) f.set('ccy', aporte.ccy)
    f.set('n', String(aporte.n))
    if (aporte.usd != null) f.set('usd', String(aporte.usd))
  }
  const hash = f.toString()
  return `${INVEST_ORIGIN}/app/${hash ? `#${hash}` : ''}`
}

// La pestaña se abre ANTES del primer await: un window.open después de una
// espera ya no cuenta como gesto de la persona y el navegador lo bloquea.
export async function openInvest({ aporte = null, win = window, client = authClient, fetchImpl } = {}) {
  let tab = null
  try { tab = win.open('', '_blank') } catch { tab = null }
  if (tab) { try { tab.opener = null } catch { /* la pestaña nueva no deja escribir opener: se sigue sin ello */ } }

  let res = { ok: false, error: 'session_required' }
  try {
    const { data } = (await client?.auth.getSession()) || {}
    res = await requestHandoff(data?.session?.access_token, fetchImpl)
  } catch { res = { ok: false, error: 'network' } }

  const url = buildInvestUrl({ ...(res.ok ? { tokenHash: res.tokenHash, uid: res.uid } : {}), aporte })
  try {
    if (tab) tab.location.href = url
    else win.location.assign(url)
  } catch { win.location.assign(url) }
  return res
}
