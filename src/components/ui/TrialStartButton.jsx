// src/components/ui/TrialStartButton.jsx — "Empezar 14 días de Pro" (sin tarjeta).
// Lo usan la hoja que sigue al onboarding, ProGate y Ajustes › Suscripción y plan.
// El servidor decide si la cuenta puede empezarla (core/proTrial.js); al empezar,
// la licencia de prueba queda validada en este dispositivo y usePlan se entera
// solo (evento del validador), así que la pantalla se abre sin recargar, y un
// aviso dice hasta cuándo dura.
// Botón y error van dentro de un bloque propio: en una grilla de dos columnas el
// error no ocupa una celda (I2). Con errorBelow={false} el error se entrega a
// onError y quien lo usa lo pone donde quiera.
import { useState } from 'react'
import { useT } from '../../i18n/useT.js'
import { useAppOptional } from '../../context/AppContext.jsx'
import config from '../../config.js'
import { startProTrial } from '../../core/proTrial.js'
import { trackEvent } from '../../utils/webAnalytics.js'
import { useTrialUiT } from '../proTrial/uiDict.js'

export default function TrialStartButton({ className = 'fos-btn-primary', style, onStarted, onError, errorBelow = true, source = 'gate' }) {
  const { lang } = useT()
  const { t: tt } = useTrialUiT()
  const app = useAppOptional()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const days = config.pricing.trialDays

  function fail(msg) { setError(msg); onError?.(msg) }

  async function start() {
    if (busy) return
    setBusy(true)
    fail('')
    const r = await startProTrial()
    setBusy(false)
    if (r.ok) {
      trackEvent('trial_start', { from: source })
      if (r.endsAt) {
        let date = ''
        try { date = new Date(r.endsAt).toLocaleDateString(lang, { day: 'numeric', month: 'long' }) } catch { date = '' }
        if (date) app?.showToast?.(tt('proTrial.started', { date }))
      }
      onStarted?.(r)
      return
    }
    fail(tt(r.error === 'already_used' || r.error === 'not_eligible' ? 'proTrial.error.used' : 'proTrial.error'))
  }

  return (
    <div>
      <button type="button" className={className} style={{ width: '100%', ...style }} onClick={start} disabled={busy} aria-busy={busy || undefined}>
        {busy ? tt('proTrial.starting') : tt('settings.upgrade.btn', { days })}
      </button>
      {errorBelow && error && <p role="alert" style={{ fontSize: 'var(--t-footnote)', color: 'var(--red)', margin: '8px 0 0', lineHeight: 1.45 }}>{error}</p>}
    </div>
  )
}
