// src/pages/Movements/DaySheet.jsx — hoja de un día del calendario (B3b, D4)
// Lo real del día (las mismas filas de la lista: tocar una abre su detalle) y,
// aparte, lo previsto (fijos, suscripciones y cuotas) con sus acciones de
// confirmar u omitir. Lo previsto no suma a los totales. Hoy, además, los dos
// atajos del alta rápida.

import { useRef } from 'react'
import Sheet from '../../components/ui/Sheet.jsx'
import Amount from '../../components/Amount.jsx'
import StateTag from '../../components/ledger/StateTag.jsx'
import OccurrenceRow from '../../components/recurring/OccurrenceRow.jsx'
import rs from '../../components/recurring/recurring.module.css'
import c from '../../components/calendar/calendar.module.css'
import { openQuickAdd } from '../../components/quickAddBus.js'
import { useT } from '../../i18n/useT.js'
import { dateLocale } from '../../utils/index.js'
import { MovementRow } from './MovementsList.jsx'
import ms from './movements.module.css'

function longDate(iso) {
  const [y, m, d] = String(iso || '').split('-').map(Number)
  if (!y || !m || !d) return iso || ''
  try { return new Intl.DateTimeFormat(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(y, m - 1, d)) }
  catch { return iso }
}

// cell: casilla de buildCalendar. sym/lens: la lente activa (lo real);
// localSym: lo previsto va en la moneda principal (es lo que se confirma).
export default function DaySheet({ cell, type = 'all', sym, lens, localSym, onClose, onOpenMovement, onConfirm, onSkip, onUnskip, live }) {
  const { t } = useT()
  const titleRef = useRef(null)
  if (!cell) return null
  const title = longDate(cell.date)
  const hasReal = cell.items.length > 0
  const showIn = type !== 'expense' && (cell.income > 0 || type === 'income')
  const showOut = type !== 'income' && (cell.expense > 0 || type === 'expense' || !showIn)

  return (
    <Sheet open onClose={onClose} ariaLabel={title} initialFocusRef={titleRef}>
      <h2 className={c.sheetTitle} ref={titleRef} tabIndex={-1}>
        {title}{cell.isToday ? ` · ${t('movl.day.today')}` : ''}
      </h2>
      {hasReal && (
        <p className={c.sheetTotals}>
          {showIn && (
            <span className={`${c.sheetTotalsItem} ${c.sheetTotalsIn}`}>
              {t('movl.type.income')}<Amount value={cell.income} sym={sym} plus />
            </span>
          )}
          {showOut && (
            <span className={c.sheetTotalsItem}>
              {t('movl.type.expense')}<Amount value={-cell.expense} sym={sym} />
            </span>
          )}
        </p>
      )}

      {hasReal ? (
        <ul className={ms.rows}>
          {cell.items.map((e) => (
            <li key={e.key || e.id}><MovementRow e={e} type={type} sym={sym} lens={lens} onOpen={onOpenMovement} /></li>
          ))}
        </ul>
      ) : (
        <p className={c.sheetEmpty}>{t('movl.cal.day.empty')}</p>
      )}

      {cell.planned.length > 0 && (
        <section className={c.sheetSection} aria-label={t('movl.cal.day.plannedAria')}>
          <div className={c.sheetSectionHd}>
            <StateTag tone="muted" label={t('movl.cal.day.planned', { n: cell.planned.length })} />
          </div>
          <p className={c.sheetNote}>{t('movl.cal.day.plannedNote')}</p>
          <ul className={rs.rows}>
            {cell.planned.map((o) => (
              <OccurrenceRow key={o.key} occ={o} sym={localSym} onConfirm={onConfirm} onSkip={onSkip} onUnskip={onUnskip} />
            ))}
          </ul>
          <div role="status" aria-live="polite" className="sr-only">{live}</div>
        </section>
      )}

      {cell.isToday && (
        <div className={c.sheetActions}>
          {type !== 'income' && (
            <button type="button" className="fos-btn-secondary" onClick={() => { onClose(); openQuickAdd('expense') }}>
              {t('movl.cal.day.addExpense')}
            </button>
          )}
          {type !== 'expense' && (
            <button type="button" className="fos-btn-secondary" onClick={() => { onClose(); openQuickAdd('income') }}>
              {t('movl.cal.day.addIncome')}
            </button>
          )}
        </div>
      )}
    </Sheet>
  )
}
