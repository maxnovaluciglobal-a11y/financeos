// src/components/recurring/MonthSheet.jsx — hoja de inicio de mes (y de
// "Revisar" desde el Inicio). Reemplaza al cierre de mes cuando el mes activo
// es el actual: arriba, cómo cerró el anterior; abajo, los fijos previstos del
// mes con ✓ / cambiar monto / omitir y "Confirmar los N de hasta hoy".
// Accesible: ui/Sheet da el focus-trap, Esc y el retorno de foco; los cambios
// se anuncian en una región aria-live.
import { useMemo } from 'react'
import Sheet from '../ui/Sheet.jsx'
import Money from '../Money.jsx'
import { useT } from '../../i18n/useT.js'
import { fmtMoney, fmtSignedMoney } from '../../utils/index.js'
import { pendingTotals } from '../../utils/recurring.js'
import OccurrenceRow from './OccurrenceRow.jsx'
import { useOccurrenceActions } from './useOccurrenceActions.js'
import s from './recurring.module.css'

function monthTitle(ym, lang) {
  const [y, m] = ym.split('-').map(Number)
  let t = ym
  try { t = new Date(y, m - 1, 1).toLocaleDateString(lang, { month: 'long', year: 'numeric' }) } catch {}
  return t.charAt(0).toUpperCase() + t.slice(1)   // "Octubre de 2026", no "Octubre De 2026"
}
function monthOnly(ym, lang) {
  const [y, m] = ym.split('-').map(Number)
  let name = ym
  try { name = new Date(y, m - 1, 1).toLocaleDateString(lang, { month: 'long' }) } catch {}
  return name.charAt(0).toUpperCase() + name.slice(1)   // va al comienzo de la frase
}

export default function MonthSheet({ open, onClose, month, plan, today, sym, prev, onGoToList }) {
  const { t, lang } = useT()
  const { confirm, confirmMany, skip, unskip, live } = useOccurrenceActions()
  const visible = useMemo(() => (plan || []).filter(o => !o.rule.inv), [plan])
  const pending = visible.filter(o => o.status === 'pending')
  const due = pending.filter(o => o.date <= today)
  const later = pending.filter(o => o.date > today)
  const settled = visible.filter(o => o.status !== 'pending')
  const totals = pendingTotals(visible)
  const title = monthTitle(month, lang)

  const rows = (list) => (
    <ul className={s.rows}>
      {list.map(o => <OccurrenceRow key={o.key} occ={o} sym={sym} onConfirm={confirm} onSkip={skip} onUnskip={unskip} />)}
    </ul>
  )

  return (
    <Sheet open={open} onClose={onClose} ariaLabel={t('rec.sheet.aria', { month: title })} maxWidth={520}>
      <div className={s.head}>
        <h2 className={s.month}>{title}</h2>
        {prev && (
          <div className={s.prev}>
            {t('rec.sheet.prevClosed', { month: monthOnly(prev.month, lang) })}{' '}
            <strong className="num" style={{ color: prev.balance >= 0 ? 'var(--pos)' : 'var(--neg)' }}><Money>{fmtSignedMoney(prev.balance, sym)}</Money></strong>
          </div>
        )}
        {visible.length > 0 ? (
          <>
            <p className={s.lead}>
              {t(pending.length === 1 ? 'rec.sheet.count.one' : 'rec.sheet.count.many', { n: pending.length })}
              {pending.length > 0 && <> {t('rec.sheet.lead')}</>}
            </p>
            {pending.length > 0 && (
              <div className={s.totals}>
                {totals.income > 0 && <span>{t('rec.sheet.incomes')} <span className={s.inc}><Money>+{fmtMoney(totals.income, sym)}</Money></span></span>}
                {totals.expense > 0 && <span>{t('rec.sheet.expenses')} <span className={s.exp}><Money>−{fmtMoney(totals.expense, sym)}</Money></span></span>}
              </div>
            )}
          </>
        ) : (
          <p className={s.empty}>{t('rec.sheet.empty')}</p>
        )}
      </div>

      {due.length > 0 && (
        <section className={s.group} aria-labelledby="ms-due">
          <h3 id="ms-due" className={s.groupTitle}>{t('rec.sheet.dueGroup')}</h3>
          {rows(due)}
        </section>
      )}
      {visible.length > 0 && due.length === 0 && pending.length > 0 && <p className={s.allClear}>{t('rec.sheet.allClear')}</p>}
      {later.length > 0 && (
        <section className={s.group} aria-labelledby="ms-later">
          <h3 id="ms-later" className={s.groupTitle}>{t('rec.sheet.laterGroup')}</h3>
          {rows(later)}
        </section>
      )}
      {settled.length > 0 && (
        <section className={s.group} aria-labelledby="ms-done">
          <h3 id="ms-done" className={s.groupTitle}>{t('rec.sheet.doneGroup', { n: settled.length })}</h3>
          {rows(settled)}
        </section>
      )}

      <div role="status" aria-live="polite" className="sr-only">{live}</div>

      <div className={s.actions}>
        {due.length > 0 && (
          <button type="button" className="fos-btn-primary" onClick={() => confirmMany(due)}>
            {t(due.length === 1 ? 'rec.sheet.confirmDue.one' : 'rec.sheet.confirmDue.many', { n: due.length })}
          </button>
        )}
        {onGoToList && <button type="button" className={s.btnGhost} onClick={onGoToList}>{t('rec.sheet.goList')}</button>}
        <button type="button" className={s.btnGhost} onClick={onClose}>{t('rec.sheet.done')}</button>
      </div>
    </Sheet>
  )
}
