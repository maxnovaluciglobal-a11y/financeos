// src/pages/Movements/MovementSheet.jsx — detalle de un gasto o un ingreso (UI-M3, B3a)
// Tocar una fila abre esta hoja: cifra, nombre, datos y las dos acciones
// (editar, eliminar). Así la fila queda limpia, sin lápiz ni ✕ a la vista.
// kind='income': los mismos campos que la edición de la página de Ingresos
// (fuente, monto, fecha, categoría); el borrado usa el mismo Deshacer.

import { useEffect, useRef, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import Sheet from '../../components/ui/Sheet.jsx'
import Amount from '../../components/Amount.jsx'
import CategoryIcon from '../../components/CategoryIcon.jsx'
import { InlineIcon } from '../../components/icons/SignalIcon.jsx'
import { useT } from '../../i18n/useT.js'
import { catName, expSubcatLabel, methodLabel, dateLocale, recurrenceLabel } from '../../utils/index.js'
import s from './movements.module.css'

function fullDate(iso) {
  const [y, m, d] = String(iso || '').split('-').map(Number)
  if (!y || !m || !d) return iso || ''
  try { return new Intl.DateTimeFormat(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(y, m - 1, d)) }
  catch { return iso }
}

export default function MovementSheet({ expense: e, kind = 'expense', sym, categories, subcats = {}, onClose, onSave, onDelete }) {
  const income = kind === 'income'
  const { t, lang } = useT()
  const [editing, setEditing] = useState(false)
  const [f, setF] = useState({})
  const firstField = useRef(null)
  const editBtn = useRef(null)

  useEffect(() => { setEditing(false) }, [e?.id])
  useEffect(() => { if (editing) setTimeout(() => firstField.current?.focus(), 30) }, [editing])

  if (!e) return null
  const startEdit = () => {
    setF({ description: (income ? e.source : e.description) || '', amount: e.amount, date: e.date, category: e.category, subcategory: e.subcategory || '' })
    setEditing(true)
  }
  const valid = f.description?.trim() && Number(f.amount) > 0
  const save = async () => {
    if (!valid) return
    const base = { amount: Number(f.amount), date: f.date || e.date, category: f.category || e.category }
    await onSave?.(income
      ? { ...e, ...base, source: f.description.trim() }
      : { ...e, ...base, description: f.description.trim(), subcategory: f.subcategory ?? '' })
    setEditing(false)
    onClose()
  }

  return (
    <Sheet open onClose={onClose} ariaLabel={t(income ? 'movl.isheet.title' : 'movl.sheet.title')} initialFocusRef={editBtn}>
      {!editing ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CategoryIcon category={e.category} size={32} />
            <span style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--tm)' }}>{catName(e.category, lang)}</span>
          </div>
          <div className={income ? `${s.sheetAmt} ${s.rowAmtIn}` : s.sheetAmt}>
            <Amount value={(income ? 1 : -1) * Math.abs(Number(e.amount) || 0)} sym={sym} plus={income} hero />
          </div>
          <h2 className={s.sheetName}>{(income ? e.source : e.description) || catName(e.category, lang)}</h2>
          <dl className={s.facts}>
            <div><dt>{t('movl.sheet.date')}</dt><dd>{fullDate(e.date)}</dd></div>
            <div><dt>{t('movl.sheet.category')}</dt><dd>{catName(e.category, lang)}{e.subcategory ? ` › ${expSubcatLabel(e.subcategory, lang)}` : ''}</dd></div>
            {e.method && <div><dt>{t('movl.sheet.method')}</dt><dd>{methodLabel(e.method, lang)}</dd></div>}
            {income && e.recurrence && e.recurrence !== 'Único' && <div><dt>{t('movl.isheet.recurrence')}</dt><dd>{recurrenceLabel(e.recurrence, lang)}</dd></div>}
            {!income && e.type && <div><dt>{t('movl.sheet.type')}</dt><dd>{e.type === 'Deseo' ? t('mov.form.typeWant') : t('mov.form.typeNeed')}</dd></div>}
            {e.recurringId && <div><dt>{t('movl.sheet.origin')}</dt><dd>{t(income ? 'movl.isheet.recurring' : 'movl.sheet.recurring')}</dd></div>}
            {e.inv && <div><dt>{t('movl.sheet.origin')}</dt><dd><InlineIcon kind="investment" size={13} />{t('movl.sheet.investment')}</dd></div>}
            {e.project && <div><dt>{t('mov.form.project')}</dt><dd>{e.project}</dd></div>}
            {e.notes && <div><dt>{t('movl.sheet.notes')}</dt><dd>{e.notes}</dd></div>}
          </dl>
          <div className={s.actions}>
            {onSave && (
              <button ref={editBtn} type="button" className="fos-btn-secondary" onClick={startEdit}>
                <Pencil size={16} strokeWidth={1.7} aria-hidden="true" />{t('movl.sheet.edit')}
              </button>
            )}
            {onDelete && (
              <button type="button" className="fos-btn-secondary" style={{ color: 'var(--red)' }} onClick={() => { onDelete(e); onClose() }}>
                <Trash2 size={16} strokeWidth={1.7} aria-hidden="true" />{t('movl.sheet.delete')}
              </button>
            )}
          </div>
        </>
      ) : (
        <form onSubmit={(ev) => { ev.preventDefault(); save() }}>
          <h2 className={s.sheetName}>{t(income ? 'movl.isheet.editTitle' : 'movl.sheet.editTitle')}</h2>
          <div className={s.editGrid}>
            <label>{t(income ? 'income.form.source' : 'mov.form.desc')}
              <input ref={firstField} type="text" value={f.description} placeholder={t('mov.edit.descPh')}
                onChange={(ev) => setF((p) => ({ ...p, description: ev.target.value }))} />
            </label>
            <label>{t('mov.form.amount', { sym })}
              <input type="number" inputMode="decimal" min="0" step="any" value={f.amount}
                onChange={(ev) => setF((p) => ({ ...p, amount: ev.target.value }))} />
            </label>
            <label>{t('mov.form.date')}
              <input type="date" value={f.date} onChange={(ev) => setF((p) => ({ ...p, date: ev.target.value }))} />
            </label>
            <label>{t('mov.form.category')}
              <select value={f.category} onChange={(ev) => setF((p) => ({ ...p, category: ev.target.value, subcategory: '' }))}>
                {categories.map((c) => <option key={c} value={c}>{catName(c, lang)}</option>)}
              </select>
            </label>
            {!income && (
              <label>{t('mov.form.subcat')}
                <select value={f.subcategory} onChange={(ev) => setF((p) => ({ ...p, subcategory: ev.target.value }))}>
                  <option value="">{t('mov.edit.subcatNone')}</option>
                  {(subcats[f.category] || []).map((sc) => <option key={sc} value={sc}>{expSubcatLabel(sc, lang)}</option>)}
                </select>
              </label>
            )}
          </div>
          <div className={s.actions}>
            <button type="button" className="fos-btn-secondary" onClick={() => setEditing(false)}>{t('common.cancel')}</button>
            <button type="submit" className="fos-btn-primary" disabled={!valid}>{t('mov.edit.save')}</button>
          </div>
        </form>
      )}
    </Sheet>
  )
}
