// src/pages/Recurring/index.jsx — "Fijos": lo que se repite cada mes.
// Arriba, el mes activo (previstos con ✓ / cambiar monto / omitir); abajo, las
// reglas: crear, editar, pausar, terminar, registro automático e historial de
// montos. Las reglas de Suscripciones y Deudas se editan en su página (son su
// fuente); acá se pueden pausar y ver. Ver utils/recurring.js.
import { useMemo, useState } from 'react'
import { Plus, ChevronDown } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { PageHeader, Card, CardHeader, FormGroup, FormRow, Btn, Alert } from '../../components/ui/index.jsx'
import Money from '../../components/Money.jsx'
import OccurrenceRow, { dateParts } from '../../components/recurring/OccurrenceRow.jsx'
import { useOccurrenceActions } from '../../components/recurring/useOccurrenceActions.js'
import s from '../../components/recurring/recurring.module.css'
import { freqText } from '../../components/recurring/labels.js'
import {
  monthPlan, pendingTotals, amountAt, monthOf, nextOccurrenceOf, withAmountFrom, isActiveRule, FREQS, addDays,
} from '../../utils/recurring.js'
import {
  fmtMoney, currencySymbol, currentMonth, localDateStr, getCategoriesExpense, getCategoriesIncome, catLabel, METHODS, methodLabel, monthYearLabel,
} from '../../utils/index.js'

const EMPTY = (today) => ({
  kind: 'expense', description: '', amount: '', category: 'Vivienda', method: METHODS[0] || '',
  freq: 'monthly', day: String(Number(today.slice(8, 10))), start: today, end: '', amountMode: 'fixed', autoConfirm: false,
})

function RuleForm({ initial, onSave, onCancel, settings }) {
  const { t, lang } = useT()
  const today = localDateStr()
  const [f, setF] = useState(() => initial ? {
    kind: initial.kind, description: initial.description, amount: String(amountAt(initial, currentMonth())),
    category: initial.category, method: initial.method || '', freq: initial.schedule?.freq || 'monthly',
    day: String(initial.schedule?.day ?? ''), start: initial.startDate, end: initial.endDate || '',
    amountMode: initial.amountMode || 'fixed', autoConfirm: !!initial.autoConfirm,
  } : EMPTY(today))
  const [err, setErr] = useState('')
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const cats = f.kind === 'income' ? getCategoriesIncome(settings) : getCategoriesExpense(settings)
  const needsDay = f.freq === 'monthly' || f.freq === 'yearly'

  function submit(e) {
    e.preventDefault()
    const amt = Number(String(f.amount).replace(',', '.'))
    if (!f.description.trim()) { setErr(t('rec.form.errDesc')); return }
    if (!(amt > 0)) { setErr(t('rec.form.errAmount')); return }
    const day = f.day === 'last' ? 'last' : Math.min(31, Math.max(1, Number(f.day) || Number(f.start.slice(8, 10)) || 1))
    const schedule = { freq: f.freq, anchorDate: f.start, ...(needsDay ? { day } : {}) }
    let rule = {
      ...(initial || {}),
      kind: f.kind, source: initial?.source || 'manual', description: f.description.trim(), category: f.category || cats[0],
      method: f.kind === 'expense' ? f.method : undefined, amountMode: f.amountMode,
      schedule, startDate: f.start, autoConfirm: f.autoConfirm, paused: initial?.paused || false, skipped: initial?.skipped || [],
    }
    if (f.end) rule.endDate = f.end; else delete rule.endDate
    if (!initial) rule.amounts = [{ from: monthOf(f.start), amount: amt }]
    else if (amountAt(initial, currentMonth()) !== amt) rule = withAmountFrom(rule, currentMonth(), amt)
    onSave(rule)
  }

  return (
    <Card style={{ marginBottom: 16 }}>
      <CardHeader title={initial ? t('rec.form.title.edit') : t('rec.form.title.new')} />
      <form onSubmit={submit} noValidate>
        {err && <Alert type="danger">{err}</Alert>}
        {!initial && (
          <div role="group" aria-label={t('rec.form.kind')} style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {['expense', 'income'].map(k => (
              <button key={k} type="button" className="fos-chip fos-chip--tall" aria-pressed={f.kind === k}
                onClick={() => setF(p => ({ ...p, kind: k, category: (k === 'income' ? getCategoriesIncome(settings) : getCategoriesExpense(settings))[0] }))}>
                {t(`rec.kind.${k}`)}
              </button>
            ))}
          </div>
        )}
        <FormRow>
          <FormGroup label={t('rec.form.desc')}>
            <input type="text" value={f.description} placeholder={t('rec.form.descPh')} onChange={e => set('description', e.target.value)} />
          </FormGroup>
          <FormGroup label={t('rec.form.amount')}>
            <input type="number" inputMode="decimal" min="0" step="any" value={f.amount} placeholder="0" onChange={e => set('amount', e.target.value)} />
          </FormGroup>
        </FormRow>
        {initial && <p style={{ fontSize: 12, color: 'var(--th)', margin: '-4px 0 10px' }}>{t('rec.form.amountNote', { month: monthYearLabel(currentMonth()) })}</p>}
        <FormRow>
          <FormGroup label={t('rec.form.category')}>
            <select value={f.category} onChange={e => set('category', e.target.value)}>
              {[...new Set([...(f.category && !cats.includes(f.category) ? [f.category] : []), ...cats])].map(c => <option key={c} value={c}>{catLabel(c, lang)}</option>)}
            </select>
          </FormGroup>
          {f.kind === 'expense' && (
            <FormGroup label={t('rec.form.method')}>
              <select value={f.method} onChange={e => set('method', e.target.value)}>
                {METHODS.map(m => <option key={m} value={m}>{methodLabel(m, lang)}</option>)}
              </select>
            </FormGroup>
          )}
        </FormRow>
        <FormRow>
          <FormGroup label={t('rec.form.freq')}>
            <select value={f.freq} onChange={e => set('freq', e.target.value)}>
              {FREQS.map(fr => <option key={fr} value={fr}>{t(`rec.freq.${fr}`)}</option>)}
            </select>
          </FormGroup>
          {needsDay && (
            <FormGroup label={t('rec.form.day')}>
              <select value={f.day} onChange={e => set('day', e.target.value)}>
                {Array.from({ length: 31 }, (_, i) => String(i + 1)).map(d => <option key={d} value={d}>{d}</option>)}
                <option value="last">{t('rec.day.last')}</option>
              </select>
            </FormGroup>
          )}
        </FormRow>
        <FormRow>
          <FormGroup label={t('rec.form.start')}>
            <input type="date" value={f.start} onChange={e => e.target.value && set('start', e.target.value)} />
          </FormGroup>
          <FormGroup label={t('rec.form.end')}>
            <input type="date" value={f.end} min={f.start} onChange={e => set('end', e.target.value)} />
          </FormGroup>
        </FormRow>
        <FormGroup label={t('rec.form.amountMode')}>
          <select value={f.amountMode} onChange={e => set('amountMode', e.target.value)}>
            {['fixed', 'last', 'average'].map(m => <option key={m} value={m}>{t(`rec.form.mode.${m}`)}</option>)}
          </select>
        </FormGroup>
        <label className={s.check} style={{ margin: '4px 0 2px' }}>
          <input type="checkbox" checked={f.autoConfirm} onChange={e => set('autoConfirm', e.target.checked)} />
          {t('rec.form.auto')}
        </label>
        <p style={{ fontSize: 12, color: 'var(--th)', margin: '2px 0 12px 24px', lineHeight: 1.45 }}>{t('rec.form.autoHint')}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="primary" type="submit">{t('rec.form.save')}</Btn>
          <Btn variant="ghost" type="button" onClick={onCancel}>{t('common.cancel')}</Btn>
        </div>
      </form>
    </Card>
  )
}

function RuleRow({ rule, sym, today, onEdit, onTogglePause, onEnd, onDelete, onToggleAuto, setPage }) {
  const { t, lang } = useT()
  const [open, setOpen] = useState(false)
  const ended = rule.endDate && rule.endDate < today
  const next = !rule.paused && !ended ? nextOccurrenceOf(rule, today) : null
  const amt = amountAt(rule, currentMonth())
  const isIncome = rule.kind === 'income'
  const history = [...(rule.amounts || [])].sort((a, b) => String(b.from).localeCompare(String(a.from)))
  const sourcePage = rule.source === 'subscription' ? 'subscriptions' : rule.source === 'debt' ? 'debts' : null
  const detailsId = `rule-${rule.id}`
  return (
    <li className={s.row} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
      <div className={s.body}>
        <div className={s.name}>{rule.description}</div>
        <div className={s.meta}>
          <span>{t(`rec.source.${rule.source || 'manual'}`)}</span>
          <span>{freqText(rule, t)}</span>
          {rule.paused && <span style={{ color: 'var(--warn)', fontWeight: 600 }}>{t('rec.rule.paused')}</span>}
          {ended && <span>{t('rec.rule.ended')}</span>}
          {rule.autoConfirm && !rule.paused && !ended && <span>{t('rec.rule.auto')}</span>}
          {next && <span>{t('rec.rule.next', { date: dateParts(next, lang).full })}</span>}
        </div>
      </div>
      <div className={s.right}>
        <span className={`${s.amt} ${isIncome ? s.amtIncome : ''}`}><Money>{`${isIncome ? '+' : '−'}${fmtMoney(amt, sym)}`}</Money></span>
        <button type="button" className={s.iconBtn} aria-expanded={open} aria-controls={detailsId}
          aria-label={t('rec.rule.detailsAria', { name: rule.description })} onClick={() => setOpen(v => !v)}>
          <ChevronDown size={18} strokeWidth={1.7} aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform var(--dur) var(--ease)' }} />
        </button>
      </div>
      {open && (
        <div id={detailsId} className={s.edit} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div>
            <div className={s.groupTitle}>{t('rec.rule.history')}</div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 13 }}>
              {history.map(h => (
                <li key={h.from} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '3px 0' }}>
                  <span style={{ color: 'var(--tm)' }}>{t('rec.rule.historyFrom', { month: monthYearLabel(h.from) })}</span>
                  <span className="num"><Money>{fmtMoney(h.amount, sym)}</Money></span>
                </li>
              ))}
            </ul>
          </div>
          {!ended && (
            <label className={s.check}>
              <input type="checkbox" checked={!!rule.autoConfirm} onChange={e => onToggleAuto(rule, e.target.checked)} />
              {t('rec.form.auto')}
            </label>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {sourcePage
              ? <Btn size="sm" variant="ghost" onClick={() => setPage?.(sourcePage)}>{t(`rec.rule.editIn.${rule.source}`)}</Btn>
              : !ended && <Btn size="sm" variant="ghost" onClick={() => onEdit(rule)}>{t('rec.rule.edit')}</Btn>}
            {!ended && <Btn size="sm" variant="ghost" onClick={() => onTogglePause(rule)}>{rule.paused ? t('rec.rule.resume') : t('rec.rule.pause')}</Btn>}
            {!sourcePage && !ended && <Btn size="sm" variant="ghost" onClick={() => onEnd(rule)}>{t('rec.rule.end')}</Btn>}
            {!sourcePage && <Btn size="sm" variant="ghost" onClick={() => onDelete(rule)}>{t('rec.rule.delete')}</Btn>}
          </div>
        </div>
      )}
    </li>
  )
}

export default function Recurring({ setPage }) {
  const ctx = useApp()
  const { t } = useT()
  const { settings, incomes, expenses, subscriptions } = ctx
  const rules = Array.isArray(ctx.recurring) ? ctx.recurring : []
  const sym = currencySymbol(settings.currency, settings.language)
  const activeMonth = settings.activeMonth || currentMonth()
  const today = localDateStr()
  const [form, setForm] = useState(null) // null | 'new' | rule
  const { confirm, confirmMany, skip, unskip, live } = useOccurrenceActions()

  const plan = useMemo(() => monthPlan(rules, activeMonth, { incomes, expenses, today }), [rules, activeMonth, incomes, expenses, today])
  const totals = pendingTotals(plan, { personalOnly: false })
  const due = plan.filter(o => o.status === 'pending' && o.date <= today)

  const sorted = useMemo(() => {
    const rank = (r) => (r.endDate && r.endDate < today) ? 2 : r.paused ? 1 : 0
    return [...rules].sort((a, b) => rank(a) - rank(b) || (a.kind === b.kind ? 0 : a.kind === 'income' ? -1 : 1) ||
      String(a.description).localeCompare(String(b.description)))
  }, [rules, today])

  async function save(rule) {
    await ctx.saveRule(rule)
    ctx.showToast?.(t(form === 'new' ? 'rec.toast.created' : 'rec.toast.saved'), 'ok')
    setForm(null)
  }
  async function togglePause(rule) {
    if (rule.source === 'subscription') {
      const sub = (subscriptions || []).find(x => x.id === rule.sourceId)
      if (sub) { await ctx.updateSubscription({ ...sub, status: rule.paused ? 'active' : 'inactive', updatedAt: new Date().toISOString() }); return }
    }
    await ctx.saveRule({ ...rule, paused: !rule.paused })
    ctx.showToast?.(t(rule.paused ? 'rec.toast.resumed' : 'rec.toast.paused'), 'ok')
  }
  async function end(rule) {
    await ctx.saveRule({ ...rule, endDate: addDays(today, -1) < rule.startDate ? rule.startDate : addDays(today, -1) })
    ctx.showToast?.(t('rec.toast.ended'), 'ok')
  }
  const del = (rule) => ctx.deleteWithUndo?.('recurring', rule, t('common.deleted'), t('common.undo'))
  const toggleAuto = (rule, on) => ctx.saveRule({ ...rule, autoConfirm: on })

  return (
    <div className="stack">
      <PageHeader title={t('rec.title')} sub={t('rec.sub')} />

      <Card>
        <CardHeader title={t('rec.page.thisMonth', { month: monthYearLabel(activeMonth) })} />
        {plan.length === 0 ? (
          <p className={s.empty} style={{ marginTop: 0 }}>{rules.length ? t('rec.page.noneThisMonth') : t('rec.page.empty')}</p>
        ) : (
          <>
            {totals.count > 0 && (
              <div className={s.totals} style={{ marginTop: 0, marginBottom: 6 }}>
                <span>{t('rec.pending.line')}</span>
                {totals.income > 0 && <span className={s.inc}><Money>+{fmtMoney(totals.income, sym)}</Money></span>}
                {totals.expense > 0 && <span className={s.exp}><Money>−{fmtMoney(totals.expense, sym)}</Money></span>}
              </div>
            )}
            <ul className={s.rows}>
              {plan.map(o => <OccurrenceRow key={o.key} occ={o} sym={sym} onConfirm={confirm} onSkip={skip} onUnskip={unskip} />)}
            </ul>
            {due.length > 1 && (
              <div style={{ marginTop: 12 }}>
                <button type="button" className="fos-btn-primary" onClick={() => confirmMany(due)} style={{ width: 'auto', padding: '0 18px' }}>
                  {t('rec.sheet.confirmDue.many', { n: due.length })}
                </button>
              </div>
            )}
          </>
        )}
        <div role="status" aria-live="polite" className="sr-only">{live}</div>
      </Card>

      {form ? (
        <RuleForm initial={form === 'new' ? null : form} settings={settings} onSave={save} onCancel={() => setForm(null)} />
      ) : (
        <div>
          <Btn variant="primary" onClick={() => setForm('new')}><Plus size={16} strokeWidth={2} aria-hidden="true" style={{ marginRight: 6, verticalAlign: '-3px' }} />{t('rec.page.new')}</Btn>
        </div>
      )}

      <Card>
        <CardHeader title={t('rec.page.rules', { n: rules.filter(r => isActiveRule(r, today)).length })} />
        {sorted.length === 0 ? (
          <p className={s.empty} style={{ marginTop: 0 }}>{t('rec.page.empty')}</p>
        ) : (
          <ul className={s.rows}>
            {sorted.map(r => (
              <RuleRow key={r.id} rule={r} sym={sym} today={today} setPage={setPage}
                onEdit={(rule) => setForm(rule)} onTogglePause={togglePause} onEnd={end} onDelete={del} onToggleAuto={toggleAuto} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
