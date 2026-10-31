// src/pages/shared/MonthSelector.jsx
// Cambia el mes activo GLOBAL (settings.activeMonth): mueve también el Inicio
// y Presupuestos. Un solo control en toda la app (causa 14): ‹ mes ›, con
// botones de 44 px; tocar el mes abre la lista completa en una hoja.
// onBeforeChange(next) corre antes de guardar (Movimientos lo usa para que la
// hoja de cierre de mes no aparezca sola al volver al Inicio).
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { monthLabel } from './constants.js'
import { currentMonth } from '../../utils/index.js'
import { useT } from '../../i18n/useT.js'
import { monthRange, monthsBetween, stepState } from './monthNav.js'
import OptionSheet from '../../components/ui/OptionSheet.jsx'

const stepBtn = (enabled) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 44, height: 44, padding: 0, flexShrink: 0,
  background: 'none', border: 0, borderRadius: 'var(--r-pill)',
  color: enabled ? 'var(--tx)' : 'var(--th)', opacity: enabled ? 1 : 0.4,
  cursor: enabled ? 'pointer' : 'default',
})

export default function MonthSelector({ incomes = [], expenses = [], onBeforeChange }) {
  const { settings, updateSettings } = useApp()
  const { t } = useT()
  const [listOpen, setListOpen] = useState(false)
  const activeMonth = settings.activeMonth || currentMonth()
  const allDates = [...incomes.map(r => r.date), ...expenses.map(r => r.date)].filter(Boolean)
  const change = (next) => {
    if (!next || next === activeMonth) return
    onBeforeChange?.(next)
    updateSettings({ ...settings, activeMonth: next })
  }
  const range = monthRange(allDates, currentMonth(), activeMonth)
  const st = stepState(activeMonth, range)
  const months = monthsBetween(range)
  return (
    <div role="group" aria-label={t('common.month')}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 0, flexShrink: 0,
        borderRadius: 'var(--r-pill)', background: 'var(--fill)' }}>
      <button type="button" style={stepBtn(st.canPrev)} disabled={!st.canPrev}
        aria-label={t('movl.month.prev')} onClick={() => change(st.prev)}>
        <ChevronLeft size={18} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <button type="button" aria-haspopup="dialog" aria-live="polite" className="num"
        aria-label={`${t('common.month')}: ${monthLabel(activeMonth)}`}
        onClick={() => setListOpen(true)}
        style={{ minWidth: 76, minHeight: 44, padding: '0 2px', background: 'none', border: 0, textAlign: 'center', cursor: 'pointer',
          fontFamily: 'var(--sans)', fontSize: '.875rem', fontWeight: 600, color: 'var(--tx)' }}>
        {monthLabel(activeMonth)}
      </button>
      <button type="button" style={stepBtn(st.canNext)} disabled={!st.canNext}
        aria-label={t('movl.month.next')} onClick={() => change(st.next)}>
        <ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <OptionSheet open={listOpen} onClose={() => setListOpen(false)} title={t('common.month')}
        options={months.map(m => ({ value: m, label: monthLabel(m) }))} value={activeMonth} onPick={change} />
    </div>
  )
}
