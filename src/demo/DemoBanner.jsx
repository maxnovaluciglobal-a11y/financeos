// src/demo/DemoBanner.jsx
// Franja del demo (T09). En el celular es UNA línea de 56 px (UI-M9):
// "Demo · datos ficticios", el CTA "Empezar" y un menú (⋯) con la persona, el
// escenario, "Ver planes" y el recorrido; antes eran dos filas y ocupaban 220
// de 844 px. Desde 760 px se ve todo en la fila, como siempre. El CTA lleva a la
// app real en la misma pestaña; el registro de la app captura el lead (el email
// ya se pidió en el formulario de entrada del demo, D1 = B). Estilos en
// globals.css (.demo-banner*).
import { useState, useRef, useEffect, useId } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { useDemo } from './DemoContext.jsx'
import { useT } from '../i18n/useT.js'
import { demoPersona } from './demoData.js'

export const APP_URL = 'https://app.moyiq.app/app/'
export const PRICING_URL = 'https://moyiq.app/#pricing'

export default function DemoBanner({ onReplayTour }) {
  const { setScenario, personaId } = useDemo()
  const persona = demoPersona(personaId)
  const { t } = useT()
  const [scenario, setLocal] = useState('exitoso')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  function toggle() {
    const next = scenario === 'dificil' ? 'exitoso' : 'dificil'
    setLocal(next)
    setScenario(next)
  }

  // Menú: Esc lo cierra y devuelve el foco al botón; un toque afuera también.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e) => { if (e.key === 'Escape') { setMenuOpen(false); btnRef.current?.focus() } }
    const onDown = (e) => {
      if (!menuRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown) }
  }, [menuOpen])

  const label = t('demo.banner.label', { name: persona.name, country: t(`country.${persona.country}`) })
  const scenarioText = scenario === 'dificil' ? t('demo.banner.scenarioHard') : t('demo.banner.scenarioGood')
  // Franja propia como landmark complementario (axe "region"): todo el contenido
  // de la página queda dentro de un landmark.
  return (
    <aside className="demo-banner" aria-label={label}>
      <div className="demo-banner__row">
        <span className="demo-banner__badge">{t('demo.banner.badge')}</span>
        <span className="demo-banner__label">{label}</span>
        <span className="demo-banner__short">{t('demo.banner.short')}</span>

        {/* Toggle escenario — muestra el estado ACTUAL, no el destino */}
        <button type="button" className="demo-banner__scenario" onClick={toggle} title={t('demo.banner.scenarioHint')}>
          <span>{scenarioText}</span>
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

        <button ref={btnRef} type="button" className="demo-banner__more" aria-expanded={menuOpen} aria-controls={menuId}
          aria-label={t('demo.menu.open')} onClick={() => setMenuOpen(o => !o)}>
          <MoreHorizontal size={20} strokeWidth={1.8} aria-hidden="true" />
        </button>

        <a className="fos-btn-primary demo-banner__cta" href={APP_URL}>
          <span className="demo-banner__ctaLong">{t('demo.banner.start')}</span>
          <span className="demo-banner__ctaShort">{t('demo.banner.startShort')}</span>
        </a>
      </div>

      {menuOpen && (
        <div ref={menuRef} id={menuId} className="demo-banner__menu" role="group" aria-label={t('demo.menu.title')}>
          <p className="demo-banner__menuLabel">{label}</p>
          <button type="button" className="demo-banner__menuItem" onClick={toggle} aria-pressed={scenario === 'dificil'}>
            <span>{scenarioText}</span>
            <span className="demo-banner__menuHint">{t('demo.menu.scenarioSwitch')}</span>
          </button>
          {onReplayTour && (
            <button type="button" className="demo-banner__menuItem" onClick={() => { setMenuOpen(false); onReplayTour() }}>
              {t('demo.tour.replay')}
            </button>
          )}
          <a className="demo-banner__menuItem" href={PRICING_URL} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>
            {t('demo.banner.plans')}
          </a>
        </div>
      )}
    </aside>
  )
}
