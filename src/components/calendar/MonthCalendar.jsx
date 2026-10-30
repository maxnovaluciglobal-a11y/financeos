// src/components/calendar/MonthCalendar.jsx — cuadrícula del mes (B3b + D4)
//
// Vista alternativa de Movimientos: una casilla por día con lo que entró (+) y
// lo que salió (−) en cifra corta, con ícono y signo (nunca solo color), y lo
// previsto (fijos, suscripciones, cuotas) con borde punteado, aparte de lo
// real. Patrón APG de cuadrícula de fechas: role="grid", una sola casilla en
// el orden de tabulación y flechas para moverse; cada día es un botón con la
// frase completa ("29 de octubre: ingresos Bs X, gastos Bs Y, 2 previstos").
// La lógica vive en calendarModel.js.

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { useT } from '../../i18n/useT.js'
import { useMoney } from '../Money.jsx'
import { weekdayOrder, initialFocusDate, moveFocus, compactNumber } from './calendarModel.js'
import c from './calendar.module.css'

const MINUS = '−'

function fullDate(date, locale) {
  const [y, m, d] = date.split('-').map(Number)
  try { return new Date(y, m - 1, d).toLocaleDateString(locale, { day: 'numeric', month: 'long' }) } catch { return date }
}

function weekdayNames(order, locale) {
  // 4-ene-2026 fue domingo: 4 + n es el día n de la semana.
  return order.map((n) => {
    const dt = new Date(2026, 0, 4 + n)
    let short = '', long = ''
    try { short = dt.toLocaleDateString(locale, { weekday: 'narrow' }) } catch { /* sin soporte */ }
    try { long = dt.toLocaleDateString(locale, { weekday: 'long' }) } catch { /* sin soporte */ }
    return { n, short, long }
  })
}

// fmtFull(n) → monto completo ya con "ocultar montos" (para la etiqueta).
// labelledBy: id de un encabezado que ya existe; sin él, el título va en un h3 oculto.
export default function MonthCalendar({ ym, weeks, weekStart = 1, today, locale, fmtFull, title, labelledBy, onOpenDay }) {
  const { t } = useT()
  const { m } = useMoney()
  const captionId = useId()
  const [focusDate, setFocusDate] = useState(() => initialFocusDate(ym, today))
  const moved = useRef(false)
  const refs = useRef(new Map())

  // Otro mes: el foco vuelve a hoy o al día 1.
  useEffect(() => { setFocusDate(initialFocusDate(ym, today)) }, [ym, today])
  useEffect(() => {
    if (!moved.current) return
    moved.current = false
    refs.current.get(focusDate)?.focus()
  }, [focusDate])

  const days = useMemo(() => weekdayNames(weekdayOrder(weekStart), locale), [weekStart, locale])
  const short = (n) => m(compactNumber(n, locale))

  function onKeyDown(e) {
    const next = moveFocus(focusDate, e.key, { weekStart })
    if (!next) return
    e.preventDefault()
    moved.current = true
    setFocusDate(next)
    if (next === focusDate) refs.current.get(next)?.focus()
  }

  function label(cell) {
    const parts = []
    if (cell.isToday) parts.push(t('movl.cal.aria.today'))
    if (cell.income > 0) parts.push(t('movl.cal.aria.income', { v: fmtFull(cell.income) }))
    if (cell.expense > 0) parts.push(t('movl.cal.aria.expense', { v: fmtFull(cell.expense) }))
    const n = cell.planned.length
    if (n) parts.push(t(n === 1 ? 'movl.cal.aria.plannedOne' : 'movl.cal.aria.plannedMany', { n }))
    if (!parts.length || (parts.length === 1 && cell.isToday)) parts.push(t('movl.cal.aria.none'))
    return `${fullDate(cell.date, locale)}: ${parts.join(', ')}`
  }

  return (
    <div className={c.wrap}>
      {!labelledBy && <h3 id={captionId} className="sr-only">{title}</h3>}
      {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- el foco lo lleva una sola casilla (tabindex móvil); el grid solo escucha las flechas */}
      <div role="grid" aria-labelledby={labelledBy || captionId} className={c.grid} onKeyDown={onKeyDown}>
        <div role="row" className={c.row}>
          {days.map((d) => (
            <div key={d.n} role="columnheader" aria-label={d.long} className={c.wd}>
              <span aria-hidden="true">{d.short}</span>
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} role="row" className={c.row}>
            {week.map((cell, ci) => (
              <div key={cell ? cell.date : `x${ci}`} role="gridcell" className={c.cellWrap}>
                {cell && (
                  <button type="button"
                    ref={(el) => { if (el) refs.current.set(cell.date, el); else refs.current.delete(cell.date) }}
                    tabIndex={cell.date === focusDate ? 0 : -1}
                    className={[c.cell, cell.isToday ? c.today : '', cell.isPast ? c.past : ''].filter(Boolean).join(' ')}
                    aria-current={cell.isToday ? 'date' : undefined}
                    aria-haspopup="dialog"
                    aria-label={label(cell)}
                    onFocus={() => setFocusDate(cell.date)}
                    onClick={() => onOpenDay(cell)}>
                    <span className={c.dayLine} aria-hidden="true">
                      <span className={c.num}>{cell.day}</span>
                      {cell.isToday && <span className={c.todayWord}>{t('movl.day.today')}</span>}
                    </span>
                    {cell.income > 0 && (
                      <span className={`${c.amt} ${c.in}`} aria-hidden="true">
                        <ArrowDownLeft size={9} strokeWidth={2} />+{short(cell.income)}
                      </span>
                    )}
                    {cell.expense > 0 && (
                      <span className={c.amt} aria-hidden="true">
                        <ArrowUpRight size={9} strokeWidth={2} />{MINUS}{short(cell.expense)}
                      </span>
                    )}
                    {cell.planned.length > 0 && (
                      <span className={`${c.amt} ${c.plan}`} aria-hidden="true">
                        {cell.plannedExpense > 0 ? `${MINUS}${short(cell.plannedExpense)}` : `+${short(cell.plannedIncome)}`}
                      </span>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className={c.legend}>
        {weeks.some(w => w.some(x => x?.isToday)) && <span><span className={c.legendToday} aria-hidden="true" />{t('movl.day.today')}</span>}
        <span><ArrowDownLeft size={12} strokeWidth={2} aria-hidden="true" />{t('movl.cal.legend.income')}</span>
        <span><ArrowUpRight size={12} strokeWidth={2} aria-hidden="true" />{t('movl.cal.legend.expense')}</span>
        <span><span className={c.legendPlan} aria-hidden="true" />{t('movl.cal.legend.planned')}</span>
      </p>
    </div>
  )
}
