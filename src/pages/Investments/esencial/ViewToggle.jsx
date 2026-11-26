// Interruptor "Vista completa" (apagado = vista esencial) y aviso educativo.
// Visible arriba de Inversiones y de la ficha; la elección se recuerda por
// cuenta en este dispositivo (utils/investView.js).
// `compact` (encabezado de una fila de Inversiones, 26-nov-2026): la
// explicación no se ve debajo; queda como descripción para el lector de
// pantalla (aria-describedby) y como `title`. La explica también la ayuda de
// Inversiones (hlp.a.views).
import { useId } from 'react'
import { Check, Info, Minus } from 'lucide-react'
import { isFull } from '../../../utils/investView.js'
import { useEssT } from './dict.js'
import s from './esencial.module.css'

export function ViewToggle({ view, onChange, compact = false }) {
  const { t } = useEssT()
  const id = useId()
  const on = isFull(view)
  return (
    <div className={s.toggleRow} data-compact={compact || undefined}>
      <button type="button" role="switch" aria-checked={on} aria-describedby={`${id}-hint`} className={s.switch}
        title={compact ? t('ess.view.hint') : undefined}
        onClick={() => onChange(on ? 'esencial' : 'completa')}>
        <span className={s.track} aria-hidden="true">
          <span className={s.thumb}>{on ? <Check size={12} strokeWidth={3} /> : <Minus size={12} strokeWidth={3} />}</span>
        </span>
        <span className={s.switchLabel}>{t('ess.view.label')}</span>
        {/* El estado en palabras (el lector de pantalla ya lo dice con aria-checked). */}
        <span className={s.switchState} aria-hidden="true">{t(on ? 'ess.view.on' : 'ess.view.off')}</span>
      </button>
      {compact
        ? <span id={`${id}-hint`} className="sr-only">{t('ess.view.hint')}</span>
        : <p id={`${id}-hint`} className={s.hint}>{t('ess.view.hint')}</p>}
    </div>
  )
}

export function EduNotice() {
  const { t } = useEssT()
  return (
    <p className={s.edu} role="note"><Info size={14} strokeWidth={2} aria-hidden="true" />{t('ess.edu')}</p>
  )
}
