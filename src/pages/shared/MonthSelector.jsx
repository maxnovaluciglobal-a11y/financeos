// src/pages/shared/MonthSelector.jsx
// Cambia el mes activo GLOBAL (settings.activeMonth): mueve también el Inicio
// y Presupuestos. Dos dibujos:
//   - 'select' (por defecto): lista de los meses con datos (Ingresos, Reportes…).
//   - 'stepper' (Movimientos, B3a): ‹ mes ›, con botones de 44 px.
// onBeforeChange(next) corre antes de guardar (Movimientos lo usa para que la
// hoja de cierre de mes no aparezca sola al volver al Inicio).
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { monthLabel } from './constants.js'
import { currentMonth } from '../../utils/index.js'
import { useT } from '../../i18n/useT.js'
import { monthRange, stepState } from './monthNav.js'

const stepBtn = (enabled) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 44, height: 44, padding: 0, flexShrink: 0,
  background: 'none', border: 0, borderRadius: 'var(--r)',
  color: enabled ? 'var(--tx)' : 'var(--th)', opacity: enabled ? 1 : 0.4,
  cursor: enabled ? 'pointer' : 'default',
})

export default function MonthSelector({ incomes = [], expenses = [], variant = 'select', onBeforeChange }) {
  const { settings, updateSettings } = useApp()
  const { t } = useT()
  const activeMonth = settings.activeMonth || currentMonth()
  const allDates = [...incomes.map(r => r.date), ...expenses.map(r => r.date)].filter(Boolean)
  const change = (next) => {
    if (!next || next === activeMonth) return
    onBeforeChange?.(next)
    updateSettings({ ...settings, activeMonth: next })
  }

  if (variant === 'stepper') {
    const st = stepState(activeMonth, monthRange(allDates, currentMonth(), activeMonth))
    return (
      <div role="group" aria-label={t('common.month')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 0, flexShrink: 0,
          border: '0.5px solid var(--brd2)', borderRadius: 'var(--r)', background: 'var(--sur)' }}>
        <button type="button" style={stepBtn(st.canPrev)} disabled={!st.canPrev}
          aria-label={t('movl.month.prev')} onClick={() => change(st.prev)}>
          <ChevronLeft size={18} strokeWidth={1.8} aria-hidden="true" />
        </button>
        <span aria-live="polite" className="num"
          style={{ minWidth: 76, textAlign: 'center', fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 600, color: 'var(--tx)' }}>
          {monthLabel(activeMonth)}
        </span>
        <button type="button" style={stepBtn(st.canNext)} disabled={!st.canNext}
          aria-label={t('movl.month.next')} onClick={() => change(st.next)}>
          <ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>
    )
  }

  const months   = [...new Set(allDates.map(d => d.slice(0, 7)))].sort().reverse()
  if (months.length === 0) return null
  return (
    <select aria-label={t('common.month')} value={activeMonth} onChange={e => change(e.target.value)}
      style={{ width: 'auto', fontSize: 11, padding: '5px 8px', marginLeft: 'auto' }}>
      {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
    </select>
  )
}
