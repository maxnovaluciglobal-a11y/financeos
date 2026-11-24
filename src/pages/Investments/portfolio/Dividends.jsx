// src/pages/Investments/portfolio/Dividends.jsx — Portafolio › Dividendos (F1).
// Lo que pagarían las posiciones en los próximos 12 meses con el rendimiento
// por dividendo que informa la fuente. Frecuencia y meses REALES
// (utils/investDividends.js): de la fuente o de los pagos que la persona
// registró; sin ninguno de los dos, el monto queda "sin calendario" y no se
// reparte en meses inventados (error de Invest corregido).
import { useEffect, useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import Money, { useMoney } from '../../../components/Money.jsx'
import { projectDividends } from '../../../utils/investDividends.js'
import { fundamentalSources, monthsSummary } from './view.js'
import Sources from './Sources.jsx'
import s from './portfolio.module.css'

export default function Dividends({ pb, fmt, demo, t, actions }) {
  const { m } = useMoney()
  const { loadFundamentals } = pb
  useEffect(() => { if (pb.phase === 'ready') loadFundamentals() }, [pb.phase, loadFundamentals])
  const f = pb.funds
  const proj = useMemo(() => projectDividends({ rows: pb.positions.rows, fundamentals: f.data, ops: pb.ops, toUsd: pb.toUsd }), [pb.positions.rows, f.data, pb.ops, pb.toUsd])
  const max = Math.max(0, ...proj.months.map(x => x.usd))
  const srcNames = demo && (f.sample || f.sample == null) ? [] : fundamentalSources(f.data)

  if (pb.phase === 'loading') return <p className={s.note} role="status">{t('pf.loading')}</p>
  if (!pb.holdings.length) {
    return (
      <section className={s.empty} aria-labelledby="pf-div-empty">
        <h2 id="pf-div-empty" className={s.emptyTitle}>{t('pf.div.emptyTitle')}</h2>
        <div className={s.actionsRow}><button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => actions.addPosition()}>{t('pf.add.position')}</button></div>
      </section>
    )
  }
  if (f.phase === 'loading' || f.phase === 'idle') {
    return <p className={s.note} role="status">{t('pf.div.loading', { n: proj.positions })}</p>
  }
  const retry = <button type="button" className={s.btn} onClick={() => loadFundamentals({ force: true })}><RefreshCw size={16} aria-hidden="true" />{t('pf.retry')}</button>
  if (f.phase === 'error') {
    return <div className={s.notice} role="alert"><strong>{t('pf.div.errorTitle')}</strong><span>{t('pf.div.errorBody')}</span><div className={s.noticeActions}>{retry}</div></div>
  }
  if (!proj.rows.length) {
    return (
      <div className={s.notice} role="status">
        <strong>{t('pf.div.noneTitle')}</strong>
        <span>{t('pf.div.noneBody', { n: proj.positions })}</span>
        {proj.noReply > 0 && <span>{t('pf.div.noReply', { n: proj.noReply })}</span>}
        {proj.noReply > 0 && <div className={s.noticeActions}>{retry}</div>}
      </div>
    )
  }

  const freqLabel = (r) => {
    const base = t(`pf.freq.${r.freq}`)
    if (r.source === 'history') return `${base} · ${t('pf.freq.fromHistory')}`
    if (r.source === 'api') return `${base} · ${t('pf.freq.fromSource')}`
    return base
  }
  const summary = monthsSummary(proj.months, fmt.monthLong, (usd) => m(fmt.money(usd)))
  return (
    <>
      <p className={s.note}>{t('pf.div.sub')}</p>
      <section className={s.band} aria-label={t('pf.div.bandLabel')}>
        <div className={s.stat}>
          <span className={s.statLabel}>{t('pf.div.annual')}</span>
          <span className={s.statValue}><Money>{fmt.money(proj.totalUsd)}</Money></span>
          {fmt.dccy !== 'USD' && <span className={s.statSub}>≈ <Money>{fmt.inCcy(proj.totalUsd, 'USD')}</Money></span>}
        </div>
        <div className={s.stat}>
          <span className={s.statLabel}>{t('pf.div.monthly')}</span>
          <span className={s.statValue}><Money>{fmt.money(proj.monthlyAvgUsd)}</Money></span>
          <span className={s.statSub}>{t('pf.div.monthlySub')}</span>
        </div>
        <div className={s.stat}>
          <span className={s.statLabel}>{t('pf.div.yield')}</span>
          <span className={s.statValue}>{fmt.pct(proj.yieldPct, { decimals: 2 })}</span>
          <span className={s.statSub}>{t('pf.div.yieldSub')}</span>
        </div>
        <div className={s.stat}>
          <span className={s.statLabel}>{t('pf.div.paying')}</span>
          <span className={s.statValue}>{t('pf.div.payingOf', { n: proj.paying, total: proj.positions })}</span>
          {proj.noReply > 0 && <span className={s.statSub}>{t('pf.div.noReplyShort', { n: proj.noReply })}</span>}
        </div>
      </section>
      {proj.excluded > 0 && <p className={s.note}>{t(proj.excluded === 1 ? 'pf.div.excluded.one' : 'pf.div.excluded.many', { n: proj.excluded })}</p>}

      <section className={s.section} aria-labelledby="pf-div-months">
        <h2 id="pf-div-months" className={s.sectionTitle}>{t('pf.div.months')}</h2>
        {proj.scheduledUsd > 0 ? (
          <div className={s.bars} role="img" aria-label={t('pf.div.monthsAria', { list: summary })}>
            {proj.months.map(x => (
              <div key={x.ym} className={s.bar}>
                <span className={s.barAmt} aria-hidden="true">{x.usd > 0 ? m(fmt.money(x.usd)) : ''}</span>
                <span className={s.barFill} data-empty={x.usd > 0 ? undefined : 'true'} style={{ height: x.usd > 0 ? Math.max(6, Math.round((x.usd / max) * 90)) : 3 }} aria-hidden="true" />
                <span className={s.barLabel} aria-hidden="true">{fmt.monthShort(x.ym)}</span>
              </div>
            ))}
          </div>
        ) : <p className={s.note}>{t('pf.div.noCalendar')}</p>}
        {proj.unscheduledUsd > 0 && (
          <p className={s.note}>{t('pf.div.unscheduled', { amount: m(fmt.money(proj.unscheduledUsd)), list: proj.rows.filter(r => !r.months?.length).map(r => r.t).join(', ') })}</p>
        )}
        <p className={s.note}>{t('pf.div.note')}</p>
      </section>

      <section className={s.section} aria-labelledby="pf-div-rows">
        <h2 id="pf-div-rows" className={s.sectionTitle}>{t('pf.div.byPosition')}</h2>
        <ul className={s.list}>
          {proj.rows.map(r => (
            <li key={r.t} className={s.item}>
              <div className={s.divRow}>
                <div className={s.rowMain}>
                  <span className={s.rowTitle}>{r.t}</span>
                  <span className={s.rowSub}>{t('pf.pos.units', { n: fmt.units(r.sh) })} · {t('pf.div.perShare')} <Money>{fmt.native(r.perShareYear, r.ccy)}</Money></span>
                  <span className={s.rowSub}>{freqLabel(r)}{r.months?.length ? ` · ${r.months.map(mm => fmt.monthShort(`2000-${String(mm).padStart(2, '0')}`)).join(', ')}` : ''}</span>
                </div>
                <div className={s.rowRight}>
                  <span className={s.rowValue}><Money>{fmt.money(r.annualUsd)}</Money></span>
                  <span className={s.rowMeta}>{t('pf.div.rowYield', { p: fmt.pct(r.yieldPct, { decimals: 2 }) })}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <Sources t={t} src={{}} fundamentals={srcNames} fx={fmt.dccy !== 'USD' || proj.rows.some(r => r.ccy !== 'USD')} />
    </>
  )
}
