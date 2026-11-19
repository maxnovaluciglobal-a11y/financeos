// src/pages/Dashboard/lupa/DaySheet.jsx — la hoja de un día de la ChartLupa.
// Es la alternativa de un toque al arrastre (WCAG 2.5.7): tocar un día (o
// Intro en el gráfico) abre sus movimientos, y ‹ › recorre el mes sin arrastrar.
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Sheet from '../../../components/ui/Sheet.jsx'
import Amount from '../../../components/Amount.jsx'
import CategoryIcon from '../../../components/CategoryIcon.jsx'
import { useT } from '../../../i18n/useT.js'
import { catName, dateLocale } from '../../../utils/index.js'
import { sheetTitle, shortDate, longDate } from './lupaText.js'
import s from './scene.module.css'

// Movimientos del día `day`. En el mes en curso, lo que tiene fecha posterior
// a hoy cuenta hoy (igual que la serie, dailyAvailable.js).
export function dayRecords({ incomes = [], expenses = [], activeMonth, day, series }) {
  const pick = (r) => {
    if (typeof r?.date !== 'string' || !r.date.startsWith(activeMonth)) return false
    const d = Number(r.date.slice(8, 10))
    return d === day || (series.mode === 'current' && day === series.lastDay && d > series.lastDay)
  }
  return [
    ...incomes.filter(pick).map(r => ({ id: `i-${r.id}`, kind: 'income', name: r.source || '', category: r.category, amount: Number(r.amount) || 0 })),
    ...expenses.filter(pick).map(r => ({ id: `e-${r.id}`, kind: 'expense', name: r.description || '', category: r.category, amount: Number(r.amount) || 0 })),
  ]
}

export default function DaySheet({ open, day, onClose, onDay, series, activeMonth, incomes, expenses, sym, fmt }) {
  const { t, lang } = useT()
  if (!day) return null
  const locale = dateLocale()
  const rows = dayRecords({ incomes, expenses, activeMonth, day, series })
  const isToday = series.mode === 'current' && day === series.lastDay
  const total = t(isToday ? 'home.lupa.sheet.totalToday' : 'home.lupa.sheet.total', { spent: fmt(series.spent[day]), amount: fmt(series.avail[day]) })
  const prev = day > 1 ? day - 1 : null
  const next = day < series.lastDay ? day + 1 : null
  return (
    <Sheet open={open} onClose={onClose} ariaLabel={t('home.lupa.sheet.aria', { date: longDate(activeMonth, day, locale) })} maxWidth={440}>
      <h2 className={s.sheetTitle}>{sheetTitle(activeMonth, day, locale)}{isToday ? ` · ${t('home.lupa.today')}` : ''}</h2>
      <p className={`num ${s.sheetTotal}`}>{total}</p>
      {rows.length === 0
        ? <p className={s.sheetEmpty}>{t('home.lupa.sheet.empty')}</p>
        : (
          <ul className={s.dayRows}>
            {rows.map(r => (
              <li key={r.id} className={s.dayRow}>
                <CategoryIcon category={r.category} />
                <span className={s.dayRowText}>
                  <b>{r.name || catName(r.category, lang)}</b>
                  {r.name && <small>{catName(r.category, lang)}</small>}
                </span>
                <Amount className={r.kind === 'income' ? s.dayRowInc : s.dayRowAmt} value={r.kind === 'income' ? r.amount : -r.amount} sym={sym} plus={r.kind === 'income'} />
              </li>
            ))}
          </ul>
        )}
      <div className={s.dayNav}>
        <button type="button" className={s.dayNavBtn} disabled={!prev} onClick={() => prev && onDay(prev)} aria-label={t('home.lupa.prev')}>
          <ChevronLeft size={18} strokeWidth={1.8} aria-hidden="true" />{prev ? shortDate(activeMonth, prev, locale) : ''}
        </button>
        <button type="button" className={s.dayNavBtn} disabled={!next} onClick={() => next && onDay(next)} aria-label={t('home.lupa.next')}>
          {next ? shortDate(activeMonth, next, locale) : ''}<ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>
    </Sheet>
  )
}
