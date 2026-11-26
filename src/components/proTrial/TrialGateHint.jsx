// src/components/proTrial/TrialGateHint.jsx — pista de LicenseGate: "Empieza con
// Starter: al terminar la configuración puedes activar 14 días de Pro…". Solo si
// el servidor dice que esta cuenta puede empezar la prueba (quien ya la usó o
// pagó no la ve). Se carga diferida desde LicenseGate (fuera del JS inicial).
import { useEffect, useState } from 'react'
import config from '../../config.js'
import { fetchTrialEligibility } from '../../core/proTrial.js'
import { logRejection } from '../../utils/errorLog.js'
import { useTrialUiT } from './uiDict.js'

export default function TrialGateHint({ style }) {
  const { t } = useTrialUiT()
  const [eligible, setEligible] = useState(false)
  useEffect(() => {
    let alive = true
    fetchTrialEligibility().then(ok => { if (alive) setEligible(ok) }).catch(logRejection('TrialGateHint'))
    return () => { alive = false }
  }, [])
  if (!eligible) return null
  return <p style={style}>{t('proTrial.gateHint', { days: config.pricing.trialDays })}</p>
}
