// src/pages/Dashboard/review/ReviewSheets.jsx — hojas de "Por revisar".
// Trozo aparte (lazy desde ReviewInbox.jsx): la lista completa, la hoja de
// categorías en chips y el detalle del movimiento. El Inicio no las carga
// hasta que se tocan.
import { useMemo, useState } from 'react'
import Sheet from '../../../components/ui/Sheet.jsx'
import CategoryIcon from '../../../components/CategoryIcon.jsx'
import MovementSheet from '../../Movements/MovementSheet.jsx'
import { useT } from '../../../i18n/useT.js'
import { getCategoriesExpense, getCategoriesIncome } from '../../../utils/index.js'
import { ReviewRow } from './ReviewInbox.jsx'
import { suggestMatch, recordText } from '../../../utils/categoryRules.js'
import { prefsOf, nameFor } from '../../../utils/categoryPrefs.js'
import s from './review.module.css'

// `open`: el padre deja la hoja montada al cerrar, para su animación de salida.
export function CategorySheet({ row, open = true, settings, onClose, onPick }) {
  const { t, lang } = useT()
  const cats = useMemo(() => (row.kind === 'income' ? getCategoriesIncome(settings) : getCategoriesExpense(settings)), [row.kind, settings])
  const prefs = useMemo(() => prefsOf(settings), [settings])
  const name = row.name || nameFor(row.rec.category, prefs, lang)
  // "Usar siempre esta categoría para «uber»": crea la regla al elegir (apagado por defecto).
  const match = suggestMatch(recordText(row.rec))
  const [always, setAlways] = useState(false)
  return (
    <Sheet open={open} onClose={onClose} ariaLabel={t('review.pickTitle')} maxWidth={440}>
      <h2 className={s.sheetTitle}>{t('review.pickTitle')}</h2>
      <p className={s.sheetSub}>{name}</p>
      <div className={s.chips} role="group" aria-label={t('review.pickTitle')}>
        {cats.map(c => {
          const on = c === row.rec.category
          return (
            <button key={c} type="button" className={`${s.chip} ${on ? s.chipOn : ''}`} aria-pressed={on} onClick={() => onPick(c, always && match ? { rule: match } : undefined)}>
              <CategoryIcon category={c} size={22} />
              <span>{nameFor(c, prefs, lang)}</span>
            </button>
          )
        })}
      </div>
      {match && (
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minHeight: 44, marginTop: 12, fontSize: 'var(--t-subhead)', lineHeight: 1.4, cursor: 'pointer' }}>
          <input type="checkbox" checked={always} onChange={e => setAlways(e.target.checked)} style={{ width: 16, height: 16, flexShrink: 0, marginTop: 3 }} />
          <span>{t('crules.pickAlways', { match })}</span>
        </label>
      )}
    </Sheet>
  )
}

export function ReviewAllSheet({ rows, open = true, sym, onClose, onConfirmAll, onConfirm, onCategory, onOpen }) {
  const { t, lang } = useT()
  return (
    <Sheet open={open} onClose={onClose} ariaLabel={t('review.title')}>
      <h2 className={s.sheetTitle}>{t('review.title')}</h2>
      <p className={s.sheetSub}>{t('review.sub')}</p>
      {rows.length === 0
        ? <p className={s.empty} role="status">{t('review.empty')}</p>
        : (
          <>
            <ul className={s.list}>
              {rows.map(r => <ReviewRow key={r.key} scope="rva" row={r} sym={sym} lang={lang} t={t} onConfirm={onConfirm} onCategory={onCategory} onOpen={onOpen} />)}
            </ul>
            {rows.length > 1 && (
              <button type="button" className={`fos-btn-secondary ${s.allBtn}`} onClick={onConfirmAll}>
                {t('review.confirmAll', { n: rows.length })}
              </button>
            )}
          </>
        )}
    </Sheet>
  )
}

export function ReviewMovementSheet({ row, open = true, sym, settings, onClose, onSave, onDelete }) {
  const income = row.kind === 'income'
  const cats = income ? getCategoriesIncome(settings) : getCategoriesExpense(settings)
  return (
    <MovementSheet open={open} kind={row.kind} expense={row.rec} sym={sym} categories={cats}
      onClose={onClose} onSave={onSave} onDelete={onDelete} />
  )
}
