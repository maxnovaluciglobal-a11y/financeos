// Piezas compartidas de Siguiendo (F4): formatos, códigos de error → texto y
// el estado de los avisos push de este dispositivo (flujo de Ajustes ›
// Notificaciones, core/push.js; ligado a la licencia).
import { useCallback, useEffect, useState } from 'react'
import { fmtPct } from '../../../utils/index.js'
import { enablePush, isPushEnabled, pushSupported } from '../../../core/push.js'
import { getLicenseKey } from '../../../utils/licenseValidator.js'
import { ALERT_LIMIT } from '../../../utils/investAlerts.js'

export const safeStorage = {
  getItem: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  setItem: (k, v) => { try { localStorage.setItem(k, v) } catch { /* modo privado: vale para esta visita */ } },
}

// Mueve el foco después del próximo render (la fila borrada ya no está).
export function focusLater(elId) {
  const go = () => { try { document.getElementById(elId)?.focus() } catch { /* sin DOM */ } }
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(go)
  else setTimeout(go, 0)
}

export const pctOrDash = (v, o) => (v == null || !Number.isFinite(Number(v)) ? '—' : fmtPct(v, o))
export const dirOf = (v) => (!Number.isFinite(Number(v)) || v == null ? 'flat' : v > 0 ? 'up' : v < 0 ? 'down' : 'flat')

// Código de error (core/investAlerts.js, investData.js) → [clave, variables].
export function alertErrorKey(code) {
  if (code === 'duplicate') return ['fl.err.duplicate']
  if (code === 'limit') return ['fl.err.limit', { n: ALERT_LIMIT }]
  if (code === 'demo') return ['fl.err.demo']
  if (code === 'session_required' || code === 'auth_unavailable') return ['fl.err.session']
  if (code === 'timeout' || code === 'network') return ['fl.err.network']
  if (code === 'table_missing') return ['fl.al.missing']
  return ['fl.err.save']
}

// Permiso de notificaciones del navegador ('granted' | 'denied' | 'default').
export function notifPermission() {
  try { return typeof Notification !== 'undefined' ? Notification.permission : 'default' } catch { return 'default' }
}

// Estado de los avisos en este dispositivo:
// 'demo' | 'unsupported' | 'noLicense' | 'on' | 'off'. 'on' exige además el
// permiso del navegador: si se revocó, vuelve a ofrecerse "Activar avisos".
export function pushState({ demo = false, supported = pushSupported(), hasKey = !!getLicenseKey(), on = isPushEnabled(), permission = notifPermission() } = {}) {
  if (demo) return 'demo'
  if (!supported) return 'unsupported'
  if (!hasKey) return 'noLicense'
  return on && permission === 'granted' ? 'on' : 'off'
}

// ¿Este navegador sigue suscrito? true/false, o null si no se puede saber
// (sin service worker listo a tiempo). invest-alerts-check borra las
// suscripciones muertas (404/410): el indicador local puede quedar viejo.
export async function hasLiveSubscription({ sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : null, timeoutMs = 3000 } = {}) {
  try {
    if (!sw?.ready) return null
    const reg = await Promise.race([sw.ready, new Promise(r => setTimeout(() => r(null), timeoutMs))])
    if (!reg?.pushManager?.getSubscription) return null
    return !!(await reg.pushManager.getSubscription())
  } catch { return null }
}

// Resultado de enable() → [texto, tono] para un aviso (toast).
export function pushResultText(r, t) {
  if (r?.ok) return [t('fl.push.ok'), 'ok']
  if (r?.error === 'no_license') return [t('fl.push.noLicense'), 'error']
  if (r?.error === 'unsupported') return [t('fl.push.unsupported'), 'error']
  return [t(r?.error === 'permission_denied' ? 'settings.push.permissionDenied' : 'settings.push.genericError'), 'error']
}

// enable() → { ok, error? } con error 'permission_denied' | 'failed' |
// 'no_license' | 'unsupported' (así quien llama no lee un estado viejo).
export function usePushOffer(demo) {
  const [state, setState] = useState(() => pushState({ demo }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null) // 'permission_denied' | 'failed'
  useEffect(() => {
    if (state !== 'on') return undefined
    let alive = true
    hasLiveSubscription().then(live => { if (alive && live === false) setState('off') })
    return () => { alive = false }
  }, [state])
  const enable = useCallback(async () => {
    if (busy) return { ok: false, error: 'busy' }
    setBusy(true); setError(null)
    try {
      const r = await enablePush()
      if (r.ok) { setState('on'); return { ok: true } }
      // Sin licencia o sin soporte: el texto del estado ya lo explica (sin
      // sumar "No se pudo activar", que lo contradice).
      if (r.error === 'no_license') { setState('noLicense'); return { ok: false, error: 'no_license' } }
      if (r.error === 'unsupported') { setState('unsupported'); return { ok: false, error: 'unsupported' } }
      const code = r.error === 'permission_denied' ? 'permission_denied' : 'failed'
      setError(code)
      return { ok: false, error: code }
    } catch { setError('failed'); return { ok: false, error: 'failed' } } finally { setBusy(false) }
  }, [busy])
  return { state, busy, error, enable }
}
