// src/demo/DemoBanner.jsx
// Banner fijo del demo (T09): Navy plano, selector de escenario, "Ver planes",
// "?" para repetir el recorrido y el CTA "Empezar con mis datos", que lleva a la
// app real en la misma pestaña. El registro de la app captura el lead (el email
// ya se pidió en el formulario de entrada del demo, D1 = B), así que acá no se
// vuelve a pedir. Estilos en globals.css (.demo-banner*).
import { useState } from 'react'
import { useDemo } from './DemoContext.jsx'
import { useT } from '../i18n/useT.js'

export const APP_URL = 'https://app.moyiq.app/app/'
export const PRICING_URL = 'https://moyiq.app/#pricing'

export default function DemoBanner({ onReplayTour }) {
  const { setScenario } = useDemo()
  const { t } = useT()
  const [scenario, setLocal] = useState('exitoso')

  function toggle() {
    const next = scenario === 'dificil' ? 'exitoso' : 'dificil'
    setLocal(next)
    setScenario(next)
  }

  return (
    <div className="demo-banner">
      <div className="demo-banner__row">
        <span className="demo-banner__badge">DEMO</span>

        <span className="demo-banner__label">{t('demo.banner.label')}</span>

        {/* Toggle escenario — muestra el estado ACTUAL, no el destino */}
        <button type="button" className="demo-banner__scenario" onClick={toggle} title={t('demo.banner.scenarioHint')}>
          <span>{scenario === 'dificil' ? t('demo.banner.scenarioHard') : t('demo.banner.scenarioGood')}</span>
          <span aria-hidden="true">↕</span>
        </button>

        <a className="demo-banner__plans" href={PRICING_URL} target="_blank" rel="noopener noreferrer">
          {t('demo.banner.plans')}
        </a>

        {onReplayTour && (
          <button type="button" className="demo-banner__help" onClick={onReplayTour} aria-label={t('demo.tour.replay')} title={t('demo.tour.replay')}>
            ?
          </button>
        )}

        <a className="fos-btn-primary demo-banner__cta" href={APP_URL}>
          {t('demo.banner.start')}
        </a>
      </div>
    </div>
  )
}
