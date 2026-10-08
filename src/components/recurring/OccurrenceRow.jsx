// src/components/recurring/OccurrenceRow.jsx — una ocurrencia de un fijo.
// Previsto: ✓ confirmar · cambiar monto · omitir. Confirmado/omitido: estado.
// "Cambiar monto" confirma con otro monto "solo este mes" o, con la casilla,
// "desde ahora" (nueva entrada en el historial de la regla; el pasado no cambia).
import { useState, useId } from 'react'
import { Check, Pencil, SkipForward, Undo2, ChevronDown } from 'lucide-react'
import Money from '../Money.jsx'
import { useT } from '../../i18n/useT.js'
import { fmtMoney } from '../../utils/index.js'
import s from './recurring.module.css'

export function dateParts(dateStr, lang) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  let mon = '', full = dateStr
  try { mon = dt.toLocaleDateString(lang, { month: 'short' }).replace('.', '') } catch {}
  try { full = dt.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' }) } catch {}
  return { day: d, mon, full }
}

export default function OccurrenceRow({ occ, sym, onConfirm, onSkip, onUnskip, compact = false }) {
  const { t, lang } = useT()
  const [editing, setEditing] = useState(false)
  const [amount, setAmount] = useState('')
  const [fromNow, setFromNow] = useState(false)
  const uidEdit = useId()
  const p = dateParts(occ.date, lang)
  const name = occ.rule.description
  const isIncome = occ.kind === 'income'
  const pending = occ.status === 'pending'
  const signed = (v) => `${isIncome ? '+' : '−'}${fmtMoney(v, sym)}`

  function submitEdit(e) {
    e?.preventDefault?.()
    const v = Number(String(amount).replace(',', '.'))
    if (!(v > 0)) return
    onConfirm?.(occ, { amount: v, fromNow })
    setEditing(false)
  }

  // Móvil primero: a la derecha solo el monto y ✓ (la acción principal). Tocar
  // el nombre despliega cambiar monto / omitir — tres íconos de 44px dejaban
  // el nombre en "Federal…" a 375px.
  const expandable = pending && !compact
  return (
    <li className={s.row}>
      <div className={`${s.date} ${pending ? s.datePending : ''}`} title={p.full}>
        <span className={s.day} aria-hidden="true">{p.day}</span>
        <span className={s.mon} aria-hidden="true">{p.mon}</span>
        <span className="sr-only">{p.full}</span>
      </div>
      {expandable ? (
        <button type="button" className={`${s.body} ${s.bodyBtn}`} aria-expanded={editing} aria-controls={uidEdit}
          aria-label={t('rec.action.moreAria', { name })}
          onClick={() => { setAmount(String(occ.expected || '')); setEditing(v => !v) }}>
          <span className={s.name}>{name}</span>
          <span className={s.meta}>
            <span className={s.tag}>{t(`rec.source.${occ.rule.source || 'manual'}`)}</span>
            <span className={s.tag}>{t('rec.status.pending')}
              <ChevronDown size={14} strokeWidth={1.7} aria-hidden="true" style={{ transform: editing ? 'rotate(180deg)' : 'none' }} /></span>
          </span>
        </button>
      ) : (
        <div className={s.body}>
          <div className={s.name}>{name}</div>
          <div className={s.meta}>
            <span className={s.tag}>{t(`rec.source.${occ.rule.source || 'manual'}`)}</span>
            {occ.status === 'confirmed' && <span className={s.done}>{t(occ.matched ? 'rec.status.matched' : 'rec.status.confirmed')}</span>}
            {occ.status === 'skipped' && <span>{t('rec.status.skipped')}</span>}
            {pending && <span>{t('rec.status.pending')}</span>}
          </div>
        </div>
      )}
      <div className={s.right}>
        <span className={`${s.amt} ${pending ? s.amtPending : ''} ${isIncome && !pending ? s.amtIncome : ''} ${occ.status === 'skipped' ? s.skipped : ''}`}>
          <Money>{signed(occ.status === 'skipped' ? occ.expected : occ.amount)}</Money>
        </span>
        {expandable && (
          <button type="button" className={`${s.iconBtn} ${s.confirmBtn}`} onClick={() => onConfirm?.(occ)}
            aria-label={t('rec.action.confirmAria', { name })} title={t('rec.action.confirm')}>
            <Check size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
        {occ.status === 'skipped' && onUnskip && !compact && (
          <button type="button" className={s.iconBtn} onClick={() => onUnskip(occ)}
            aria-label={t('rec.action.unskipAria', { name })} title={t('rec.action.unskip')}>
            <Undo2 size={17} strokeWidth={1.7} aria-hidden="true" />
          </button>
        )}
      </div>
      {editing && expandable && (
        <form id={uidEdit} className={s.edit} onSubmit={submitEdit}>
          <label className={s.editLabel} htmlFor={`${uidEdit}-amt`}>{t('rec.edit.amount')}</label>
          <input id={`${uidEdit}-amt`} type="number" inputMode="decimal" min="0" step="any" value={amount}
            onChange={e => setAmount(e.target.value)} />
          <label className={s.check}>
            <input type="checkbox" checked={fromNow} onChange={e => setFromNow(e.target.checked)} />
            {t('rec.edit.fromNow')}
          </label>
          <div className={s.editActions}>
            <button type="submit" className={s.btnSmall}><Pencil size={14} strokeWidth={1.7} aria-hidden="true" />{t('rec.edit.save')}</button>
            <button type="button" className={s.btnSmall} onClick={() => { setEditing(false); onSkip?.(occ) }}>
              <SkipForward size={14} strokeWidth={1.7} aria-hidden="true" />{t('rec.action.skip')}
            </button>
          </div>
        </form>
      )}
    </li>
  )
}
