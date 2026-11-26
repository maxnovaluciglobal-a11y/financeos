// src/components/help/FirstVisitPrompt.jsx — "¿Primera vez en X?" (ayuda en la
// app). Una tarjeta chica abajo, que no tapa la pantalla ni le quita el foco a
// la persona: se anuncia por aria-live y se responde con "Ver el recorrido",
// "Ahora no", Esc o el botón atrás de Android (= Ahora no). Va en un portal
// para que ninguna barra con backdrop-filter o transform la recorte.
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../../i18n/useT.js'
import { pageLabel } from '../layout/navConfig.js'
import { useBackDismiss } from '../../hooks/useBackDismiss.js'
import s from './help.module.css'

export default function FirstVisitPrompt({ page, onAccept, onDismiss }) {
  const { t } = useT()
  useBackDismiss(true, onDismiss)
  useEffect(() => {
    // Con una hoja abierta encima, Esc es de la hoja.
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      onDismiss()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onDismiss])
  const name = t(pageLabel(page))
  return createPortal(
    <div className={s.prompt} role="dialog" aria-modal="false" aria-labelledby="fos-help-prompt-title" aria-describedby="fos-help-prompt-body">
      <div role="status" aria-live="polite">
        <h2 id="fos-help-prompt-title" className={s.promptTitle}>{t('help.prompt.title', { page: name })}</h2>
        <p id="fos-help-prompt-body" className={s.promptBody}>{t('help.prompt.body')}</p>
      </div>
      <div className={s.promptActions}>
        <button type="button" className="fos-link" onClick={onDismiss}>{t('help.prompt.no')}</button>
        <button type="button" className="fos-btn-primary" style={{ width: 'auto' }} onClick={onAccept}>{t('help.prompt.yes')}</button>
      </div>
      <p className={s.promptNote}>{t('help.prompt.note')}</p>
    </div>,
    document.body,
  )
}
