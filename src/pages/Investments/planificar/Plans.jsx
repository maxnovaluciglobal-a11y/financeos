// src/pages/Investments/planificar/Plans.jsx — Planificar › Planes guardados (F5).
// Invest: renderPlans (app/index.html:7806-7848), que los guardaba solo en el
// navegador. Aquí viven en la cuenta (metadatos invest_plans): abrir (y
// editar), cambiar el nombre y borrar con Deshacer.
import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useMoney } from '../../../components/Money.jsx'
import { MAX_PLANS, planRisk } from '../../../utils/investPlan.js'
import { rateOf } from '../../../utils/investValuation.js'
import { moneyLocale } from '../../../utils/index.js'
import s from './planificar.module.css'

export function planLabel(p, t, fmt, m = (x) => x) {
  if (p.name) return p.name
  return p.k === 'trade' ? t('plan.pl.kind.trade', { t: p.t }) : t('plan.pl.kind.aporte', { v: m(fmt.money(p.m)) })
}

function dateOf(ts) {
  try { return new Date(ts).toLocaleDateString(moneyLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return '' }
}

export default function Plans({ plans, fmt, t, demo, rates, onOpen, onRename, onDelete, onGoCalc }) {
  const { m } = useMoney()
  const [renaming, setRenaming] = useState(null) // { id, name }

  if (plans.phase === 'loading') return <p className={s.note} role="status">{t('plan.pl.loading')}</p>
  const head = (
    <>
      <h2 id="plan-pl-title" className={s.title}>{t('plan.pl.title')}</h2>
      <p className={s.note}>{demo ? t('plan.pl.whereDemo') : t('plan.pl.where', { n: MAX_PLANS })}</p>
      {plans.phase === 'error' && <p className={s.error} role="alert">{t('plan.pl.err.load')}</p>}
    </>
  )
  if (!plans.list.length) {
    return (
      <section className={s.card} aria-labelledby="plan-pl-title">
        {head}
        {plans.phase !== 'error' && (
          <>
            <p className={s.strong}>{t('plan.pl.emptyTitle')}</p>
            <p className={s.lead}>{t('plan.pl.emptyBody')}</p>
            <div className={s.row}><button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={onGoCalc}>{t('plan.pl.openCalc')}</button></div>
          </>
        )}
      </section>
    )
  }

  async function saveName(e, p) {
    e.preventDefault()
    const ok = await onRename(p, renaming.name)
    if (ok) setRenaming(null)
  }

  return (
    <section className={s.card} aria-labelledby="plan-pl-title">
      {head}
      <ul className={s.plans}>
        {plans.list.map(p => {
          const label = planLabel(p, t, fmt, m)
          let line
          if (p.k === 'trade') {
            const fx = rateOf(p.ccy, rates)
            const risk = planRisk(p, fx)
            const base = { units: fmt.units(p.units), entry: m(fmt.native(p.entry, p.ccy)) }
            line = risk ? t('plan.pl.trade.line', { ...base, loss: m(fmt.money(-risk.usd)), pct: fmt.pct(risk.pct, { decimals: 1 }), cap: m(fmt.money(p.cap)) }) : t('plan.pl.trade.lineNoFx', base)
            if (risk?.estimated) line += ` · ${t('plan.pl.trade.stopEst')}`
          } else {
            line = t('plan.pl.aporte.line', { n: p.alloc.length, y: p.yrs, r: fmt.pct(p.rate / 100, { decimals: Number.isInteger(p.rate) ? 0 : 1 }) })
          }
          return (
            <li key={p.id} className={s.plan}>
              {renaming?.id === p.id ? (
                <form className={s.addRow} onSubmit={(e) => saveName(e, p)}>
                  <label className={s.field}>
                    <span className={s.fieldLabel}>{t('plan.pl.name')}</span>
                    <input className={s.input} value={renaming.name} maxLength={40} onChange={e => setRenaming({ ...renaming, name: e.target.value })} />
                  </label>
                  <span />
                  <div className={s.row}>
                    <button type="submit" className={`${s.btn} ${s.btnPrimary}`}>{t('plan.pl.nameSave')}</button>
                    <button type="button" className={s.btn} onClick={() => setRenaming(null)}>{t('plan.rule.cancel')}</button>
                  </div>
                </form>
              ) : <p className={s.planTitle}>{label}</p>}
              <p className={s.planLine}>{line}</p>
              <p className={s.planLine}>{t('plan.pl.date', { d: dateOf(p.ts) })}</p>
              <div className={s.row}>
                <button type="button" className={s.btn} onClick={() => onOpen(p)} aria-label={t('plan.pl.openAria', { name: label })}>{t('plan.pl.open')}</button>
                <button type="button" className={s.btn} onClick={() => setRenaming({ id: p.id, name: p.name || '' })}><Pencil size={16} aria-hidden="true" />{t('plan.pl.rename')}</button>
                <button type="button" className={`${s.btn} ${s.btnDanger}`} onClick={() => onDelete(p)} aria-label={t('plan.pl.deleteAria', { name: label })}><Trash2 size={16} aria-hidden="true" />{t('plan.pl.delete')}</button>
              </div>
            </li>
          )
        })}
      </ul>
      <p className={s.note}>{t('plan.pl.foot')}</p>
    </section>
  )
}
