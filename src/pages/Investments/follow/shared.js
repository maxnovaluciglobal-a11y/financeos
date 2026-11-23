// Piezas compartidas de Siguiendo (F4): formatos, códigos de error → texto y
// el estado de los avisos push de este dispositivo (flujo de Ajustes ›
// Notificaciones, core/push.js; ligado a la licencia).
import { useCallback, useState } from 'react'
import { fmtPct } from '../../../utils/index.js'
import { enablePush, isPushEnabled, pushSupported } from '../../../core/push.js'
import { getLicenseKey } from '../../../utils/licenseValidator.js'
import { ALERT_LIMIT } from '../../../utils/investAlerts.js'

export const safeStorage = {
  getItem: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  setItem: (k, v) => { try { localStorage.setItem(k, v) } catch { /* modo privado: vale para esta visita */ } },
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

// Estado de los avisos en este dispositivo:
// 'demo' | 'unsupported' | 'noLicense' | 'on' | 'off'.
export function pushState({ demo = false, supported = pushSupported(), hasKey = !!getLicenseKey(), on = isPushEnabled() } = {}) {
  if (demo) return 'demo'
  if (!supported) return 'unsupported'
  if (!hasKey) return 'noLicense'
  return on ? 'on' : 'off'
}

export function usePushOffer(demo) {
  const [state, setState] = useState(() => pushState({ demo }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null) // 'permission_denied' | 'failed'
  const enable = useCallback(async () => {
    if (busy) return false
    setBusy(true); setError(null)
    try {
      const r = await enablePush()
      if (r.ok) { setState('on'); return true }
      setError(r.error === 'permission_denied' ? 'permission_denied' : 'failed')
      if (r.error === 'no_license') setState('noLicense')
      if (r.error === 'unsupported') setState('unsupported')
      return false
    } catch { setError('failed'); return false } finally { setBusy(false) }
  }, [busy])
  return { state, busy, error, enable }
}
