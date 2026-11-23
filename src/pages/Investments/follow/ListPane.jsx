// Mi lista (F4): los activos que sigues (tabla watchlist, RLS por cuenta) con
// precio y cambio del día. En Vista completa, además tendencia, RSI, MACD,
// volumen y rango de 52 semanas, con un año de cierres diarios (Invest
// renderWatch, :4379) y el filtro por tendencia.
import { useId, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Bell, BellRing, Equal, X } from 'lucide-react'
import Money from '../../../components/Money.jsx'
import { TICKER_RE, TREND_FILTERS, byTrend, followRow, trendCounts } from '../../../utils/investFollow.js'
import { alertsBySymbol } from '../../../utils/investAlerts.js'
import { fmtDecimal } from '../../../utils/index.js'
import { fmtPx } from '../asset/format.js'
import { dirOf, pctOrDash } from './shared.js'
import s from '../portfolio/portfolio.module.css'
import f from './follow.module.css'

const ICON = { up: ArrowUp, down: ArrowDown, flat: Equal }
export function Day({ v }) {
  if (v == null) return <span className={s.rowSub}>—</span>
  const dir = dirOf(v)
  const Ic = ICON[dir]
  return <span className={`${s.rowMeta} ${s.tone}`} data-tone={dir}><Ic size={13} strokeWidth={2.4} aria-hidden="true" />{pctOrDash(v, { signed: true })}</span>
}

function Cell({ t, scored, missing, children }) {
  if (missing) return <span className={s.rowSub}>{t('fl.cell.na')}</span>
  if (!scored) return <span className={s.rowSub}>{t('fl.cell.calc')}</span>
  return children
}

export function rsiText(t, r) {
  if (r.rsi == null) return t('fl.cell.na')
  const n = fmtDecimal(r.rsi, 0)
  return r.rsiZone === 'high' ? t('fl.rsi.high', { n }) : r.rsiZone === 'low' ? t('fl.rsi.low', { n }) : t('fl.rsi.mid', { n })
}
export function macdText(t, r) {
  if (!r.macd) return t('fl.cell.na')
  const sgn = t(r.macd.sign === 'pos' ? 'fl.macd.pos' : 'fl.macd.neg')
  return r.macd.fading ? t('fl.macd.fading', { s: sgn }) : sgn
}

export default function ListPane({ t, d, full, demo, onOpen, onAlert, onSay, onErr }) {
  const id = useId()
  const [input, setInput] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [trend, setTrend] = useState('all')
  const bySym = useMemo(() => alertsBySymbol(d.alerts.list), [d.alerts.list])
  const rows = useMemo(() => d.watch.list.map(tk => followRow(tk, d.quotes[tk] || null, full ? d.hist[tk] || null : null)), [d.watch.list, d.quotes, d.hist, full])
  const counts = trendCounts(rows)
  const shown = full ? byTrend(rows, trend) : rows

  async function add(e) {
    e.preventDefault()
    const tk = input.toUpperCase().trim()
    if (!tk) { setErr(t('fl.cmp.err.empty')); return }
    if (!TICKER_RE.test(tk)) { setErr(t('fl.cmp.err.invalid')); return }
    setErr(null); setBusy(true)
    const r = await d.follow(tk)
    setBusy(false)
    if (!r.ok) { onErr(r.error); return }
    setInput('')
    onSay(t(r.data?.existed ? 'fl.list.exists' : 'fl.list.added', { t: tk }))
  }
  async function remove(tk) {
    const idx = d.watch.list.indexOf(tk)
    const r = await d.unfollow(tk)
    if (!r.ok) { onErr(r.error); return }
    onSay(t('fl.list.removed', { t: tk }), { label: t('fl.undo'), onAction: () => d.refollow(tk, idx) })
  }

  const bell = (tk) => {
    const n = (bySym.get(tk) || []).length
    const Ic = n ? BellRing : Bell
    return (
      <button type="button" className={s.iconBtn} onClick={() => onAlert(tk, n > 0)}
        aria-label={n ? t('fl.row.alertSee', { t: tk, n }) : t('fl.row.alertCreate', { t: tk })} title={n ? t(n === 1 ? 'fl.row.alertOne' : 'fl.row.alertMany', { n }) : undefined}>
        <Ic size={18} strokeWidth={2} aria-hidden="true" />{n > 0 && <span className={f.count} aria-hidden="true">{n}</span>}
      </button>
    )
  }
  const removeBtn = (tk) => (
    <button type="button" className={s.iconBtn} onClick={() => remove(tk)} aria-label={t('fl.row.remove', { t: tk })}>
      <X size={18} strokeWidth={2} aria-hidden="true" />
    </button>
  )
  const price = (r) => (r.price != null ? <Money>{fmtPx(r.price, r.ccy || 'USD')}</Money> : <span className={s.rowSub}>{t('fl.row.noPrice')}</span>)

  return (
    <section className={s.section} aria-labelledby={`${id}-h`}>
      <div className={s.sectionHead}>
        <h2 id={`${id}-h`} className={s.sectionTitle}>{t('fl.list.title')}</h2>
      </div>
      <p className={s.note}>{full ? t('fl.list.introFull') : t('fl.list.intro')}</p>

      <form className={s.inline} onSubmit={add} noValidate>
        <div className={s.field}>
          <label htmlFor={`${id}-add`} className={s.fieldLabel}>{t('fl.list.addLabel')}</label>
          <input id={`${id}-add`} className={s.input} value={input} onChange={e => { setInput(e.target.value); setErr(null) }}
            autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={15}
            aria-invalid={err ? 'true' : undefined} aria-describedby={`${id}-add-hint${err ? ` ${id}-add-err` : ''}`} />
        </div>
        <button type="submit" className={`${s.btn} ${s.btnPrimary}`} disabled={busy || d.watch.phase === 'error'}>{t('fl.list.addBtn')}</button>
      </form>
      <p id={`${id}-add-hint`} className={s.hint}>{t('fl.list.addHint')}</p>
      {err && <p id={`${id}-add-err`} className={s.error} role="alert">{err}</p>}

      {d.watch.phase === 'loading' && <p className={s.note} role="status">{t('fl.loading')}</p>}
      {d.watch.phase === 'error' && (
        <div className={s.notice} data-tone="warn" role="alert">
          <span>{d.watch.error === 'session_required' ? t('fl.list.session') : t('fl.list.err')}</span>
          {d.watch.error !== 'session_required' && <div className={s.noticeActions}><button type="button" className={s.btn} onClick={d.reload}>{t('fl.retry')}</button></div>}
        </div>
      )}
      {d.watch.phase !== 'loading' && d.watch.phase !== 'error' && !rows.length && (
        <div className={s.empty}>
          <h3 className={s.emptyTitle}>{t('fl.list.empty.title')}</h3>
          <p className={s.note}>{t('fl.list.empty.body')}</p>
        </div>
      )}
      {rows.length > 0 && d.quotesFailed && !demo && <p className={s.note} role="status" data-tone="warn">{t('fl.list.noQuotes')}</p>}

      {rows.length > 0 && full && (
        <div className={s.actionsRow} role="group" aria-label={t('fl.filter.label')}>
          {TREND_FILTERS.map(k => (
            <button key={k} type="button" className={f.chip} aria-pressed={trend === k} onClick={() => setTrend(k)}>
              {t(`fl.trend.${k}`)} ({counts[k]})
            </button>
          ))}
        </div>
      )}

      {rows.length > 0 && !full && (
        <ul className={s.list}>
          {shown.map(r => (
            <li key={r.t} className={`${s.item} ${f.listRow}`}>
              <button type="button" className={s.rowHead} onClick={() => onOpen(r.t)} aria-label={t('fl.row.open', { t: r.t })}>
                <span className={s.badge} aria-hidden="true">{r.t.slice(0, 4)}</span>
                <span className={s.rowMain}>
                  <span className={s.rowTitle}>{r.t}</span>
                  {r.name && r.name !== r.t && <span className={s.rowSub}>{r.name}</span>}
                </span>
                <span className={s.rowRight}>
                  <span className={s.rowValue}>{price(r)}</span>
                  <Day v={r.changePct} />
                </span>
              </button>
              <span className={f.rowActs}>{bell(r.t)}{removeBtn(r.t)}</span>
            </li>
          ))}
        </ul>
      )}

      {rows.length > 0 && full && (shown.length ? (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the table can scroll sideways on a phone; the region takes focus so keyboard users can scroll it (axe scrollable-region-focusable)
        <div className={s.tableScroll} tabIndex={0} role="region" aria-label={t('fl.list.title')}>
          <table className={`${s.table} ${f.wide}`}>
            <thead>
              <tr>
                <th scope="col">{t('fl.col.asset')}</th>
                <th scope="col">{t('fl.col.price')}</th>
                <th scope="col">{t('fl.col.day')}</th>
                <th scope="col" title={t('fl.col.trendHint')}>{t('fl.col.trend')}</th>
                <th scope="col" title={t('fl.col.rsiHint')}>{t('fl.col.rsi')}</th>
                <th scope="col" title={t('fl.col.macdHint')}>{t('fl.col.macd')}</th>
                <th scope="col" title={t('fl.col.volHint')}>{t('fl.col.vol')}</th>
                <th scope="col" title={t('fl.col.rangeHint')}>{t('fl.col.range')}</th>
                <th scope="col"><span className={s.srOnly}>{t('fl.col.actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map(r => {
                const missing = d.hist[r.t] === null
                return (
                  <tr key={r.t}>
                    <th scope="row"><button type="button" className={s.link} onClick={() => onOpen(r.t)} aria-label={t('fl.row.open', { t: r.t })}>{r.t}</button></th>
                    <td>{price(r)}</td>
                    <td><Day v={r.changePct} /></td>
                    <td><Cell t={t} scored={r.scored} missing={missing}>{r.trend ? t(`fl.trend.${r.trend}`) : t('fl.cell.na')}</Cell></td>
                    <td><Cell t={t} scored={r.scored} missing={missing}>{rsiText(t, r)}</Cell></td>
                    <td><Cell t={t} scored={r.scored} missing={missing}>{macdText(t, r)}</Cell></td>
                    <td><Cell t={t} scored={r.scored} missing={missing}>{r.vol == null ? t('fl.cell.na') : pctOrDash(r.vol, { signed: true, decimals: 0 })}</Cell></td>
                    <td>
                      {r.range ? (
                        <span className={f.range} title={t('fl.range.title', { lo: fmtPx(r.range.lo, r.ccy || 'USD'), hi: fmtPx(r.range.hi, r.ccy || 'USD') })}>
                          <span className={f.rangeBar} aria-hidden="true"><span className={f.rangeDot} style={{ left: `${(r.range.pos * 100).toFixed(1)}%` }} /></span>
                          {t('fl.range.pos', { pct: pctOrDash(r.range.pos, { decimals: 0 }) })}
                        </span>
                      ) : <Cell t={t} scored={r.scored} missing={missing}>{t('fl.cell.na')}</Cell>}
                    </td>
                    <td><span className={f.rowActs}>{bell(r.t)}{removeBtn(r.t)}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : <p className={s.note}>{t('fl.filter.none')}</p>)}

      {rows.length > 0 && <p className={s.note}>{full ? t('fl.list.footFull') : t('fl.list.foot')} {t('fl.source')}</p>}
    </section>
  )
}
