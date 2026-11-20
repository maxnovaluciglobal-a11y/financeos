// src/pages/Investments/portfolio/Movements.jsx — Portafolio › Movimientos (F1).
// Efectivo y aportes (libro de operaciones), el puente desde los gastos de
// moyiq marcados como inversión, el resultado realizado (UNA sola cuenta, la
// misma de la tabla de costo promedio), estadísticas de las ventas, filtros,
// la lista de operaciones con eliminar, dividendos cobrados y costo promedio.
// Cifras agregadas en la moneda elegida; cada operación, en la de su activo.
import { useMemo, useState } from 'react'
import { Trash2, ArrowDownToLine, ArrowUpFromLine, ListPlus, Download } from 'lucide-react'
import Money from '../../../components/Money.jsx'
import SheetSelect from '../../../components/ui/SheetSelect.jsx'
import { currentMonth } from '../../../utils/index.js'
import { resolveUserRate } from '../../../utils/investNetWorth.js'
import { costTable, filterOps, sortOpsDesc } from '../../../utils/investLedger.js'
import { aporteOffer, movementTotals, tickersOf } from './view.js'
import { toneOf } from './format.js'
import { Dir } from './Positions.jsx'
import s from './portfolio.module.css'

const OP_FILTERS = ['buy', 'sell', 'deposit', 'withdrawal', 'dividend', 'bonus']

function Cell({ label, value, sub, tone }) {
  return (
    <div className={s.cell}>
      <span className={s.cellLabel}>{label}</span>
      <span className={`${s.cellValue} ${tone ? s.tone : ''}`} data-tone={tone}>{value}</span>
      {sub && <span className={s.cellSub}>{sub}</span>}
    </div>
  )
}

function opLabel(o, t) {
  if (o.type === 'dividend' && o.reinvested) return t('pf.op.drip')
  return t(`pf.op.${o.type}`)
}

export default function Movements({ pb, fmt, demo, t, actions, settings, expenses, setAsides }) {
  const [fTicker, setFTicker] = useState('')
  const [fType, setFType] = useState('')
  const [hideAporte, setHideAporte] = useState(false)
  const L = pb.ledger
  const ops = pb.ops
  const mt = useMemo(() => movementTotals(ops, pb.ccyOf, pb.toUsd), [ops, pb.ccyOf, pb.toUsd])
  const costs = useMemo(() => costTable(ops, pb.ccyOf, pb.toUsd), [ops, pb.ccyOf, pb.toUsd])
  const list = useMemo(() => sortOpsDesc(filterOps(ops, { ticker: fTicker, type: fType })), [ops, fTicker, fType])
  const tickers = useMemo(() => tickersOf(ops), [ops])
  const month = settings.activeMonth || currentMonth()
  // Puente desde moyiq: los gastos del mes marcados como inversión.
  const offer = useMemo(() => {
    if (pb.opsState !== 'ready') return null
    const rate = resolveUserRate(settings, { rates: pb.market.latam?.rates, at: pb.market.at })
    return aporteOffer({ expenses, setAsides, month, settings, rate, ops })
  }, [pb.opsState, settings, pb.market.latam, pb.market.at, expenses, setAsides, month, ops])
  const hasHoldings = pb.holdings.length > 0

  if (pb.phase === 'loading') return <p className={s.note} role="status">{t('pf.loading')}</p>
  if (pb.opsState === 'missing') return <div className={s.notice} role="status">{t('pf.mov.missing')}</div>
  if (pb.opsState === 'error') {
    return (
      <div className={s.notice} role="alert">
        {t('pf.mov.loadError')}
        <div className={s.noticeActions}><button type="button" className={s.btn} onClick={pb.reload}>{t('pf.retry')}</button></div>
      </div>
    )
  }

  const actionBtns = (
    <div className={s.actionsRow}>
      <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => actions.openTrade({ type: 'buy' })}><ListPlus size={18} aria-hidden="true" />{t('pf.mov.record')}</button>
      <button type="button" className={s.btn} onClick={() => actions.openTrade({ type: 'deposit' })}><ArrowDownToLine size={18} aria-hidden="true" />{t('pf.mov.deposit')}</button>
      <button type="button" className={s.btn} onClick={() => actions.openTrade({ type: 'withdrawal' })}><ArrowUpFromLine size={18} aria-hidden="true" />{t('pf.mov.withdraw')}</button>
      {ops.length > 0 && <button type="button" className={s.btn} onClick={actions.exportOperations}><Download size={18} aria-hidden="true" />{t('pf.mov.export')}</button>}
    </div>
  )

  const aporte = offer && !hideAporte && (
    <div className={s.notice}>
      <strong>{t('pf.aporte.title')}</strong>
      <span>{t(offer.n === 1 ? 'pf.aporte.body.one' : 'pf.aporte.body.many', { n: offer.n })} <Money>{fmt.inCcy(offer.amount, offer.ccy)}</Money>. {t('pf.aporte.confirm')}</span>
      <div className={s.noticeActions}>
        <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => actions.openTrade({ type: 'deposit', currency: offer.ccy, amount: String(offer.amount), note: t('pf.aporte.note'), source: 'moyiq' })}>{t('pf.aporte.cta')}</button>
        <button type="button" className={s.btn} onClick={() => setHideAporte(true)}>{t('pf.aporte.later')}</button>
      </div>
    </div>
  )

  const ledgerBand = (ops.length > 0 || hasHoldings) && (
    <section className={s.band} aria-label={t('pf.cash.label')}>
      <div className={s.stat}>
        <span className={s.statLabel}>{t('pf.cash.cash')}</span>
        <span className={`${s.statValue} ${s.tone}`} data-tone={L.cash < 0 ? 'down' : undefined}><Money>{fmt.money(L.cash)}</Money></span>
        <span className={s.statSub}>
          {Object.keys(L.cashByCcy).length > 1
            ? Object.entries(L.cashByCcy).map(([c, v]) => fmt.inCcy(v, c === '?' ? 'USD' : c)).join(' · ')
            : t('pf.cash.cashSub')}
        </span>
      </div>
      <div className={s.stat}>
        <span className={s.statLabel}>{t('pf.cash.contributed')}</span>
        <span className={s.statValue}><Money>{fmt.money(L.contributed)}</Money></span>
        <span className={s.statSub}>{t('pf.cash.contributedSub')}{L.openingCount > 0 ? ` ${t(L.openingCount === 1 ? 'pf.cash.opening.one' : 'pf.cash.opening.many', { n: L.openingCount })}` : ''}</span>
      </div>
      <div className={s.stat}>
        <span className={s.statLabel}>{t('pf.cash.value')}</span>
        <span className={s.statValue}><Money>{fmt.money(L.value)}</Money></span>
        <span className={s.statSub}>{t('pf.cash.valueSub', { positions: fmt.money(L.positionsValue) })}</span>
      </div>
      <div className={s.stat}>
        <span className={s.statLabel}>{t('pf.cash.return')}</span>
        {L.gain == null
          ? <><span className={s.statValue}>—</span><span className={s.statSub}>{t('pf.cash.returnNoFx')}</span></>
          : <>
            <span className={`${s.statValue} ${s.tone}`} data-tone={toneOf(L.gain)}><Dir n={L.gain} /> {L.returnPct != null ? fmt.pct(L.returnPct, { signed: true }) : <Money>{fmt.money(L.gain, { signed: true })}</Money>}</span>
            <span className={s.statSub}>{L.returnPct != null ? <><Money>{fmt.money(L.gain, { signed: true })}</Money> {t('pf.cash.returnSub')}</> : t('pf.cash.returnNone')}</span>
          </>}
      </div>
    </section>
  )

  const notes = (
    <div className={s.notes}>
      {L.excludedCcys.length > 0 && <p className={s.note}>{t('pf.ledger.noFx', { ccy: L.excludedCcys.join(', ') })}</p>}
      {Object.entries(L.cashByCcy).filter(([, v]) => v < -0.005).map(([c]) => <p key={c} className={s.note}>{t('pf.ledger.negative', { ccy: c === '?' ? 'USD' : c })}</p>)}
      {L.orphans.map(o => (
        <div key={o.t} className={s.notice}>
          <span>{t('pf.ledger.orphan', { n: fmt.units(o.sh), t: o.t })}</span>
          <div className={s.noticeActions}>
            <button type="button" className={s.btn} onClick={() => actions.openTrade({ type: 'sell', ticker: o.t, price: o.price ? String(o.price) : '', qty: String(o.sh) })}>{t('pf.ledger.orphanCta')}</button>
          </div>
        </div>
      ))}
      {L.unpriced.length > 0 && <p className={s.note}>{t('pf.ledger.unpriced', { list: L.unpriced.join(', ') })}</p>}
      {L.excludedPositions.length > 0 && <p className={s.note}>{t('pf.ledger.excluded', { list: L.excludedPositions.join(', ') })}</p>}
    </div>
  )

  if (!ops.length) {
    return (
      <>
        <p className={s.note}>{t(demo ? 'pf.mov.subDemo' : 'pf.mov.sub')}</p>
        {aporte}
        {hasHoldings && ledgerBand}
        <section className={s.empty} aria-labelledby="pf-mov-empty">
          <h2 id="pf-mov-empty" className={s.emptyTitle}>{t('pf.mov.emptyTitle')}</h2>
          <p className={s.note}>{t('pf.mov.emptyBody')}</p>
          {actionBtns}
        </section>
      </>
    )
  }

  const st = mt.stats
  return (
    <>
      <p className={s.note}>{t(demo ? 'pf.mov.subDemo' : 'pf.mov.sub')}</p>
      {aporte}
      {ledgerBand}
      {notes}

      <section className={s.section} aria-labelledby="pf-mov-sum">
        <h2 id="pf-mov-sum" className={s.sectionTitle}>{t('pf.mov.summary')}</h2>
        <div className={s.cells}>
          <Cell label={t('pf.mov.realized')} tone={mt.realized != null ? toneOf(mt.realized) : undefined}
            value={mt.realized != null ? <><Dir n={mt.realized} /> <Money>{fmt.money(mt.realized, { signed: true })}</Money></> : '—'}
            sub={t(mt.sells === 1 ? 'pf.mov.sells.one' : 'pf.mov.sells.many', { n: mt.sells })} />
          <Cell label={t('pf.mov.invested')} value={<Money>{fmt.money(mt.invested)}</Money>} sub={t(mt.buys === 1 ? 'pf.mov.buys.one' : 'pf.mov.buys.many', { n: mt.buys })} />
          <Cell label={t('pf.mov.dividends')} value={<Money>{fmt.money(mt.dividends)}</Money>} sub={t('pf.mov.dividendsSub', { n: mt.dividendPays })} />
        </div>
        {mt.excluded > 0 && <p className={s.note}>{t(mt.excluded === 1 ? 'pf.mov.excluded.one' : 'pf.mov.excluded.many', { n: mt.excluded })}</p>}
        <p className={s.note}>{t('pf.mov.ccyNote', { ccy: fmt.dccy })}</p>
      </section>

      {actionBtns}

      <section className={s.section} aria-labelledby="pf-mov-stats">
        <h2 id="pf-mov-stats" className={s.sectionTitle}>{t('pf.stats.title')}</h2>
        {st.n === 0 ? <p className={s.note}>{t('pf.stats.empty')}</p> : (
          <>
            <div className={s.cells}>
              <Cell label={t('pf.stats.winRate')} value={fmt.pct(st.winRate, { decimals: 0 })} sub={t('pf.stats.winRateSub', { w: st.wins, n: st.n })} />
              <Cell label={t('pf.stats.pf')} value={st.profitFactor == null ? '—' : fmt.units(Math.round(st.profitFactor * 100) / 100)} sub={t('pf.stats.pfSub')} />
              <Cell label={t('pf.stats.avgWin')} value={st.avgWin == null ? '—' : <Money>{fmt.money(st.avgWin, { signed: true })}</Money>} />
              <Cell label={t('pf.stats.avgLoss')} value={st.avgLoss == null ? '—' : <Money>{fmt.money(st.avgLoss, { signed: true })}</Money>} />
              <Cell label={t('pf.stats.avg')} value={<Money>{fmt.money(st.avgPerTrade, { signed: true })}</Money>} sub={t('pf.stats.avgSub')} />
              <Cell label={t('pf.stats.dd')} value={<Money>{fmt.money(st.maxDD > 0 ? -st.maxDD : 0)}</Money>} sub={t('pf.stats.ddSub')} />
            </div>
            <div className={s.tableScroll}>
              <table className={s.table}>
                <caption>{t('pf.stats.byTicker')}</caption>
                <thead><tr><th scope="col">{t('pf.col.asset')}</th><th scope="col">{t('pf.col.sells')}</th><th scope="col">{t('pf.col.wins')}</th><th scope="col">{t('pf.stats.winRate')}</th><th scope="col">{t('pf.col.result')}</th></tr></thead>
                <tbody>
                  {st.byTicker.map(b => (
                    <tr key={b.t}>
                      <th scope="row">{b.t}</th><td>{b.n}</td><td>{t('pf.stats.wOf', { w: b.w, n: b.n })}</td><td>{fmt.pct(b.w / b.n, { decimals: 0 })}</td>
                      <td className={s.tone} data-tone={toneOf(b.pnl)}><Money>{fmt.money(b.pnl, { signed: true })}</Money></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={s.note}>{t('pf.stats.note', { n: st.n })}</p>
          </>
        )}
      </section>

      <section className={s.section} aria-labelledby="pf-ops-title">
        <h2 id="pf-ops-title" className={s.sectionTitle}>{t('pf.ops.title')}</h2>
        <div className={s.inline}>
          <div className={s.field}>
            <label htmlFor="pf-f-t" className={s.fieldLabel}>{t('pf.col.asset')}</label>
            <SheetSelect id="pf-f-t" className={s.select} value={fTicker} onChange={(e) => setFTicker(e.target.value)}>
              <option value="">{t('pf.ops.all')}</option>
              {tickers.map(x => <option key={x} value={x}>{x}</option>)}
            </SheetSelect>
          </div>
          <div className={s.field}>
            <label htmlFor="pf-f-type" className={s.fieldLabel}>{t('pf.f.opType')}</label>
            <SheetSelect id="pf-f-type" className={s.select} value={fType} onChange={(e) => setFType(e.target.value)}>
              <option value="">{t('pf.ops.all')}</option>
              {OP_FILTERS.map(k => <option key={k} value={k}>{t(`pf.ops.filter.${k}`)}</option>)}
            </SheetSelect>
          </div>
          {(fTicker || fType) && <button type="button" className={s.btn} onClick={() => { setFTicker(''); setFType('') }}>{t('pf.ops.clear')}</button>}
        </div>
        <p className={s.srOnly} role="status">{t('pf.ops.count', { n: list.length })}</p>
        {!list.length ? <p className={s.note}>{t('pf.ops.none')}</p> : (
          <ul className={s.list}>
            {list.map(o => {
              const ccy = o.currency || (o.ticker ? pb.ccyOf(o.ticker) : 'USD') || 'USD'
              return (
                <li key={o.uid} className={s.item}>
                  <div className={s.opRow}>
                    <div className={s.rowMain}>
                      <span className={s.rowTitle}>
                        {opLabel(o, t)}
                        {o.ticker && <> · <button type="button" className={s.link} onClick={() => actions.openAsset(o.ticker)}>{o.ticker}</button></>}
                      </span>
                      <span className={s.rowSub}>
                        {fmt.date(o.date)}
                        {o.qty != null && o.qty > 0 && <> · {t('pf.ops.units', { n: fmt.units(o.qty) })}</>}
                        {o.price != null && o.price > 0 && <> · <Money>{fmt.native(o.price, ccy)}</Money></>}
                        {o.rsi != null && <> · RSI {fmt.units(o.rsi)}</>}
                        {o.cash === false && <> · {t('pf.ops.offCash')}</>}
                        {o.source === 'moyiq' && <> · {t('pf.ops.fromMoyiq')}</>}
                      </span>
                      {o.note && <span className={s.rowSub}>{o.note}</span>}
                    </div>
                    <div className={s.rowRight}>
                      <span className={s.rowValue}>
                        <Money>{o.type === 'bonus' ? t('pf.ops.noAmount') : fmt.inCcy(Number(o.amount) || 0, ccy, { signed: false })}</Money>
                        {o.edited ? <span title={t('pf.ops.edited')} aria-label={t('pf.ops.edited')}> ✱</span> : null}
                      </span>
                      {o.type === 'sell' && o.pnl != null && <span className={`${s.rowMeta} ${s.tone}`} data-tone={toneOf(o.pnl)}><Dir n={o.pnl} size={12} /><Money>{fmt.inCcy(o.pnl, ccy, { signed: true })}</Money></span>}
                    </div>
                    <button type="button" className={s.iconBtn} onClick={() => actions.deleteOp(o)} aria-label={t('pf.ops.delete', { what: `${opLabel(o, t)}${o.ticker ? ` ${o.ticker}` : ''}`, date: fmt.date(o.date) })}>
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {mt.divRows.length > 0 && (
        <section className={s.section} aria-labelledby="pf-divrec">
          <h2 id="pf-divrec" className={s.sectionTitle}>{t('pf.divrec.title')}</h2>
          <div className={s.tableScroll}>
            <table className={s.table}>
              <thead><tr><th scope="col">{t('pf.col.asset')}</th><th scope="col">{t('pf.col.pays')}</th><th scope="col">{t('pf.col.total', { ccy: fmt.dccy })}</th></tr></thead>
              <tbody>{mt.divRows.map(r => <tr key={r.t}><th scope="row">{r.t}</th><td>{r.n}</td><td><Money>{fmt.money(r.usd)}</Money></td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}

      {costs.length > 0 && (
        <section className={s.section} aria-labelledby="pf-cost">
          <h2 id="pf-cost" className={s.sectionTitle}>{t('pf.cost.title')}</h2>
          <div className={s.tableScroll}>
            <table className={s.table}>
              <thead><tr><th scope="col">{t('pf.col.asset')}</th><th scope="col">{t('pf.cost.avg')}</th><th scope="col">{t('pf.d.units')}</th><th scope="col">{t('pf.mov.realized')}</th></tr></thead>
              <tbody>
                {costs.map(c => (
                  <tr key={c.t}>
                    <th scope="row">{c.t}</th>
                    <td><Money>{c.avgPaid == null ? t('pf.cost.noCost') : fmt.native(c.avgPaid, c.ccy)}</Money></td>
                    <td>{fmt.units(c.units)}{c.bonusSh > 0 ? ` (${t('pf.cost.bonus', { n: fmt.units(c.bonusSh) })})` : ''}</td>
                    <td className={c.realized != null ? s.tone : undefined} data-tone={c.realized != null ? toneOf(c.realized) : undefined}>
                      {c.realized == null ? '—' : <Money>{fmt.money(c.realized, { signed: true })}</Money>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={s.note}>{t('pf.cost.note')}</p>
        </section>
      )}
      <p className={s.note}>{t('pf.legal')}</p>
    </>
  )
}
