// src/pages/Investments/portfolio/Targets.jsx — Portafolio › Objetivos (F1).
// El peso que la persona quiere para cada posición y "Ajustes para llegar"
// con las reglas de Invest (utils/investRebalance.js): suma 100 ± 0,5, nada
// por debajo de US$10, unidades enteras salvo cripto y nunca vender más de lo
// que hay. Los objetivos viven en memoria mientras Inversiones está abierta:
// no hay dónde guardarlos en la cuenta todavía y llevan tickers, que no se
// guardan en el dispositivo (se pueden llevar en la copia JSON).
import { useMemo } from 'react'
import { CircleCheck, CircleAlert } from 'lucide-react'
import Money, { useMoney } from '../../../components/Money.jsx'
import { clampTarget, currentTargets, rebalanceBase, rebalanceTrades, sumTargets, targetsReady } from '../../../utils/investRebalance.js'
import { toneOf } from './format.js'
import { Dir } from './Positions.jsx'
import s from './portfolio.module.css'

export default function Targets({ pb, fmt, t, actions, targets, setTargets }) {
  const { m } = useMoney()
  const base = useMemo(() => rebalanceBase(pb.positions.rows), [pb.positions.rows])
  const defaults = useMemo(() => currentTargets(base), [base])
  const tg = useMemo(() => ({ ...defaults, ...(targets || {}) }), [defaults, targets])
  const total = base.reduce((a, b) => a + b.valueUsd, 0)
  const sum = sumTargets(base, tg)
  const ready = targetsReady(sum)
  const plan = useMemo(() => rebalanceTrades(base, tg), [base, tg])

  if (pb.phase === 'loading') return <p className={s.note} role="status">{t('pf.loading')}</p>
  if (!base.length) {
    return (
      <section className={s.empty} aria-labelledby="pf-tg-empty">
        <h2 id="pf-tg-empty" className={s.emptyTitle}>{t('pf.tg.emptyTitle')}</h2>
        <div className={s.actionsRow}><button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => actions.addPosition()}>{t('pf.add.position')}</button></div>
      </section>
    )
  }
  const set = (tk, v) => setTargets({ ...tg, [tk]: clampTarget(v) })
  const left = Math.round((100 - sum) * 10) / 10
  const excluded = pb.positions.rows.filter(r => r.valueUsd == null).length

  return (
    <>
      <p className={s.note}>{t('pf.tg.sub')}</p>
      <section className={s.section} aria-labelledby="pf-tg-title">
        <div className={s.sectionHead}>
          <h2 id="pf-tg-title" className={s.sectionTitle}>{t('pf.tg.title')}</h2>
          <button type="button" className={s.btn} onClick={() => setTargets(null)} disabled={!targets}>{t('pf.tg.reset')}</button>
        </div>
        <ul className={s.list}>
          {base.map(b => {
            const cur = total > 0 ? (b.valueUsd / total) * 100 : 0
            const v = Number(tg[b.t]) || 0
            const d = v - cur
            const id = `pf-tg-${b.t.replace(/[^A-Za-z0-9]/g, '_')}`
            return (
              <li key={b.t} className={s.target}>
                <div className={s.targetHead}>
                  <span className={s.rowTitle}>{b.t}</span>
                  <span className={s.rowSub}>{t('pf.tg.current', { p: fmt.pct(cur / 100, { decimals: 1 }) })}</span>
                </div>
                <span className={`${s.rowMeta} ${s.tone}`} data-tone={Math.abs(d) < 0.05 ? 'flat' : toneOf(d)}>
                  <Dir n={Math.abs(d) < 0.05 ? 0 : d} size={12} />{t('pf.tg.diff', { pts: fmt.pts(Math.round(d * 10) / 10) })}
                </span>
                <div className={s.targetCtl}>
                  <input type="range" className={s.range} min={0} max={100} step={0.5} value={v} onChange={(e) => set(b.t, e.target.value)}
                    aria-label={t('pf.tg.slider', { t: b.t })} aria-valuetext={t('pf.tg.valueText', { p: fmt.units(v) })} />
                  <label htmlFor={id} className={s.srOnly}>{t('pf.tg.input', { t: b.t })}</label>
                  <input id={id} className={`${s.input} ${s.numInput}`} inputMode="decimal" value={String(v)} onChange={(e) => set(b.t, String(e.target.value).replace(',', '.'))} />
                  <span aria-hidden="true">%</span>
                </div>
              </li>
            )
          })}
        </ul>
        <p className={`${s.totalRow} ${ready ? s.sumOk : s.sumBad}`} role="status">
          <strong>{t('pf.tg.sum')}</strong>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {ready ? <CircleCheck size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}
            {fmt.units(Math.round(sum * 10) / 10)} % · {ready ? t('pf.tg.sumOk') : t(left > 0 ? 'pf.tg.sumMissing' : 'pf.tg.sumOver', { p: fmt.units(Math.abs(left)) })}
          </span>
        </p>
        {excluded > 0 && <p className={s.note}>{t(excluded === 1 ? 'pf.tg.excluded.one' : 'pf.tg.excluded.many', { n: excluded })}</p>}
        <p className={s.note}>{t('pf.tg.memory')}</p>
      </section>

      <section className={s.section} aria-labelledby="pf-tg-adj">
        <h2 id="pf-tg-adj" className={s.sectionTitle}>{t('pf.tg.adjTitle')}</h2>
        <p className={s.note}>{t(base.length === 1 ? 'pf.tg.adjBase.one' : 'pf.tg.adjBase.many', { value: m(fmt.money(total)), n: base.length })}</p>
        {!targets && <div className={s.notice} role="status">{t('pf.tg.untouched')}</div>}
        {targets && plan.status === 'sum' && <div className={s.notice} data-tone="warn" role="status">{t('pf.tg.adjSum', { sum: fmt.units(Math.round(sum * 10) / 10), p: fmt.units(Math.abs(left)), dir: t(left > 0 ? 'pf.tg.dirMissing' : 'pf.tg.dirOver') })}</div>}
        {targets && plan.status === 'aligned' && <div className={s.notice} role="status">{t('pf.tg.aligned')}</div>}
        {targets && plan.status === 'trades' && (
          <>
            <ul className={s.list}>
              {plan.trades.map(x => (
                <li key={x.t} className={s.item}>
                  <div className={s.divRow}>
                    <div className={s.rowMain}>
                      <span className={s.rowTitle}>{x.t}</span>
                      <span className={s.rowSub}>{t(x.buy ? 'pf.tg.increase' : 'pf.tg.reduce')} · {t('pf.tg.units', { n: fmt.units(Math.abs(x.shares)) })}</span>
                    </div>
                    <span className={`${s.rowValue} ${s.tone}`} data-tone={x.buy ? 'up' : 'down'}><Dir n={x.usd} size={12} /> <Money>{fmt.money(x.usd, { signed: true })}</Money></span>
                  </div>
                </li>
              ))}
            </ul>
            <p className={s.note}>{t('pf.tg.adjNote')}</p>
          </>
        )}
      </section>
      <p className={s.note}>{t('pf.legal')}</p>
    </>
  )
}
