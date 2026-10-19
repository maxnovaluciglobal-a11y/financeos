// src/pages/shared/MonthSelector.jsx
import { useApp } from '../../context/AppContext.jsx'
import { monthLabel } from './constants.js'
import { currentMonth } from '../../utils/index.js'
import { useT } from '../../i18n/useT.js'

export default function MonthSelector({ incomes = [], expenses = [] }) {
  const { settings, updateSettings } = useApp()
  const { t } = useT()
  const activeMonth = settings.activeMonth || currentMonth()
  const allDates = [...incomes.map(r => r.date), ...expenses.map(r => r.date)].filter(Boolean)
  const months   = [...new Set(allDates.map(d => d.slice(0, 7)))].sort().reverse()
  if (months.length === 0) return null
  return (
    <select aria-label={t('common.month')} value={activeMonth} onChange={e => updateSettings({ ...settings, activeMonth: e.target.value })}
      style={{ width: 'auto', fontSize: 11, padding: '5px 8px', marginLeft: 'auto' }}>
      {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
    </select>
  )
}
