// src/components/ui/TrialStartButton.jsx — "Empezar 14 días de Pro" (sin tarjeta).
// Lo usan la hoja que sigue al onboarding, ProGate y Ajustes › Suscripción y plan.
// El servidor decide si la cuenta puede empezarla (core/proTrial.js); al empezar,
// la licencia de prueba queda validada en este dispositivo y usePlan se entera
// solo (evento del validador), así que la pantalla se abre sin recargar.
import { useState } from 'react'
import { useT } from '../../i18n/useT.js'
import config from '../../config.js'
import { startProTrial } from '../../core/proTrial.js'
import { trackEvent } from '../../utils/webAnalytics.js'

export default function TrialStartButton({ className = 'fos-btn-primary', style, onStarted, source = 'gate' }) {
  const { t } = useT()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const days = config.pricing.trialDays

  async function start() {
    if (busy) return
    setBusy(true)
    setError('')
    const r = await startProTrial()
    setBusy(false)
    if (r.ok) {
      trackEvent('trial_start', { from: source })
      onStarted?.(r)
      return
    }
    setError(t(r.error === 'already_used' || r.error === 'not_eligible' ? 'proTrial.error.used' : 'proTrial.error'))
  }

  return (
    <>
      <button type="button" className={className} style={style} onClick={start} disabled={busy} aria-busy={busy || undefined}>
        {busy ? t('proTrial.starting') : t('settings.upgrade.btn', { days })}
      </button>
      {error && <p role="alert" style={{ fontSize: 'var(--t-footnote)', color: 'var(--red)', margin: '8px 0 0', lineHeight: 1.45 }}>{error}</p>}
    </>
  )
}
