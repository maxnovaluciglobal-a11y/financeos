// src/components/ahead/CardsView.jsx — vista por tarjeta de crédito
// (24-nov-2026). Dentro de Deudas ("Debo"): cada deuda de tipo Tarjeta muestra
// el facturado del período, el cupo usado y disponible, la fecha de pago y,
// si la cuota del mes pasó sin pagarse, "Vencida" en rojo. Todo con datos
// anotados a mano: nunca claves ni conexiones bancarias. Se carga con lazy().
//
// Campos opcionales de la deuda (sin ellos la tarjeta se ve como antes):
// `creditLimit` (cupo total) y `statementAmount` (facturado del período).
import { useId, useMemo, useState } from 'react'
import { AlertCircle, Check, Pencil } from 'lucide-react'
import { Card, CardHeader } from '../ui/index.jsx'
import Money, { useMoney } from '../Money.jsx'
import { fmtMoney, fmtPct, localDateStr } from '../../utils/index.js'
import { monthPlan } from '../../utils/recurring.js'
import { debtRuleId } from '../../utils/recurringSources.js'
import { cardSummary, cardsTotals, isCreditCard } from '../../utils/ahead.js'
import { dateParts } from './dateParts.js'
import { useAheadStrings } from '../../i18n/ahead/index.js'
import s from './ahead.module.css'

function stateText(c, t, lang) {
  const date = c.dueDate ? dateParts(c.dueDate, lang).full : ''
  if (c.status === 'overdue') return t('ahead.cards.overdue', { date })
  if (c.status === 'paid') return t('ahead.cards.paid')
  if (c.status === 'due') {
    if (c.daysToDue === 0) return t('ahead.cards.dueToday')
    if (c.daysToDue === 1) return t('ahead.cards.dueIn.one')
    if (c.daysToDue > 1 && c.daysToDue <= 7) return t('ahead.cards.dueIn.many', { n: c.daysToDue })
    return t('ahead.cards.due', { date })
  }
  return ''
}

function CardEditor({ debt, onSave, onCancel, t }) {
  const uid = useId()
  const [f, setF] = useState({
    statement: debt.statementAmount ? String(debt.statementAmount) : '',
    limit: debt.creditLimit ? String(debt.creditLimit) : '',
    due: debt.dueDate || '',
  })
  const num = (v) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : 0 }
  function submit(e) {
    e.preventDefault()
    // Campo vacío = sin fecha de pago (se puede borrar).
    onSave({ ...debt, statementAmount: num(f.statement), creditLimit: num(f.limit), dueDate: f.due || '' })
  }
  return (
    <form className={s.cardForm} onSubmit={submit}>
      <label htmlFor={`${uid}-st`}>{t('ahead.cards.statement')}
        <input id={`${uid}-st`} type="number" inputMode="decimal" min="0" step="any" value={f.statement} placeholder="0" onChange={e => setF(p => ({ ...p, statement: e.target.value }))} />
      </label>
      <label htmlFor={`${uid}-lim`}>{t('ahead.cards.limit')}
        <input id={`${uid}-lim`} type="number" inputMode="decimal" min="0" step="any" value={f.limit} placeholder="0" onChange={e => setF(p => ({ ...p, limit: e.target.value }))} />
      </label>
      <label htmlFor={`${uid}-due`}>{t('ahead.cards.dueDate')}
        <input id={`${uid}-due`} type="date" value={f.due} onChange={e => setF(p => ({ ...p, due: e.target.value }))} />
      </label>
      <div className={s.cardFormActions}>
        <button type="submit" className="fos-btn-primary" style={{ width: 'auto', padding: '0 18px' }}>{t('ahead.cards.save')}</button>
        <button type="button" className={s.cardEditBtn} style={{ marginTop: 0 }} onClick={onCancel}>{t('common.cancel')}</button>
      </div>
    </form>
  )
}

export default function CardsView({ debts, rules, incomes, expenses, sym, updateDebt, showToast }) {
  const { t, lang, ready } = useAheadStrings()
  const { m } = useMoney()
  const [editing, setEditing] = useState(null)
  const today = localDateStr()
  const cardsList = useMemo(() => (debts || []).filter(isCreditCard), [debts])
  const plan = useMemo(() => {
    const ids = new Set(cardsList.map(d => debtRuleId(d.id)))
    return monthPlan((rules || []).filter(r => ids.has(r.id)), today.slice(0, 7), { incomes, expenses, today })
  }, [cardsList, rules, incomes, expenses, today])
  const cards = useMemo(() => cardsList.map(d => ({ debt: d, c: cardSummary(d, { today, plan, ruleId: debtRuleId(d.id) }) })), [cardsList, plan, today])
  const totals = useMemo(() => cardsTotals(cards.map(x => x.c)), [cards])
  if (!ready || !cards.length) return null

  async function save(next) {
    await updateDebt?.(next)
    setEditing(null)
    showToast?.(t('ahead.cards.saved'), 'ok')
  }

  return (
    <Card data-tour="debt-cards">
      <CardHeader title={t('ahead.cards.title')} />
      <p className={s.sub}>{t('ahead.cards.sub')}</p>
      <dl className={s.cardsHead}>
        <div><dt>{t('ahead.cards.totalStatement')}</dt><dd className="num"><Money>{fmtMoney(totals.statement, sym)}</Money></dd></div>
        {totals.limit > 0 && <div><dt>{t('ahead.cards.totalAvailable')}</dt><dd className="num"><Money>{fmtMoney(totals.available, sym)}</Money></dd></div>}
      </dl>
      {totals.overdue > 0 && (
        <p className={s.cardsAlert} role="status">
          <AlertCircle size={16} strokeWidth={2} aria-hidden="true" />
          {totals.overdue === 1 ? t('ahead.cards.overdueCount.one') : t('ahead.cards.overdueCount.many', { n: totals.overdue })}
        </p>
      )}
      <ul className={s.cardList}>
        {cards.map(({ debt, c }) => {
          const state = stateText(c, t, lang)
          return (
            <li key={debt.id} className={s.cardItem}>
              <div className={s.cardTop}>
                <h3 className={s.cardName}>{c.name}</h3>
                {state && (
                  <span className={s.cardState} data-status={c.status}>
                    {c.status === 'paid' && <Check size={14} strokeWidth={2.4} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 3 }} />}
                    {c.status === 'overdue' && <AlertCircle size={14} strokeWidth={2.2} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 3 }} />}
                    {state}
                  </span>
                )}
              </div>
              <dl className={s.cardFigs}>
                <div><dt>{t('ahead.cards.statement')}</dt>
                  <dd className="num">{c.statement != null ? <Money>{fmtMoney(c.statement, sym)}</Money> : <span className={s.muted}>{t('ahead.cards.noStatement')}</span>}</dd></div>
                <div><dt>{t('ahead.cards.used')}</dt><dd className="num"><Money>{fmtMoney(c.used, sym)}</Money></dd></div>
                {c.minPayment > 0 && <div><dt>{t('debts.form.minPay')}</dt><dd className="num"><Money>{fmtMoney(c.minPayment, sym)}</Money></dd></div>}
              </dl>
              {c.limit ? (
                <div>
                  <div className={s.cupo} role="img" aria-label={t('ahead.cards.usedAria', { name: c.name, pct: fmtPct(c.usedPct) })}>
                    <div className={s.cupoFill} data-over={c.overLimit ? '1' : undefined} style={{ width: `${(c.usedPct * 100).toFixed(1)}%` }} />
                  </div>
                  <div className={s.cupoLine}>
                    <span><Money>{fmtMoney(c.used, sym)}</Money> / <Money>{fmtMoney(c.limit, sym)}</Money></span>
                    {c.overLimit
                      ? <span className={s.overLimit}>{t('ahead.cards.overLimit')}</span>
                      : <span>{t('ahead.cards.available', { amount: m(fmtMoney(c.available, sym)) })}</span>}
                  </div>
                </div>
              ) : <p className={s.cupoLine} style={{ margin: 0 }}>{t('ahead.cards.noLimit')}</p>}
              {editing === debt.id
                ? <CardEditor debt={debt} t={t} onSave={save} onCancel={() => setEditing(null)} />
                : (
                  <button type="button" className={s.cardEditBtn} onClick={() => setEditing(debt.id)}>
                    <Pencil size={14} strokeWidth={1.8} aria-hidden="true" />{t('ahead.cards.edit')}<span className="sr-only">: {c.name}</span>
                  </button>
                )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
