// Mi lista (F4): los activos que sigues (tabla watchlist, RLS por cuenta) con
// precio y cambio del día, y debajo de cada uno su alerta de precio (desde el
// 26-nov-2026 las alertas ya no son otra sub-pestaña). Arriba, una fila con
// "+ Seguir", "Nueva alerta" y "Comparar". La campana abre la hoja de alerta de
// ese activo con el símbolo puesto; tocar la fila (o su alerta) abre la ficha.
// En Vista completa, además tendencia, RSI, MACD, volumen y rango de 52
// semanas, con un año de cierres diarios (Invest renderWatch, :4379) y el
// filtro por tendencia.
import { useEffect, useId, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Equal, Plus, X } from 'lucide-react'
import Money from '../../../components/Money.jsx'
import { TICKER_RE, TREND_FILTERS, byTrend, followRow, trendCounts } from '../../../utils/investFollow.js'
import { alertsBySymbol } from '../../../utils/investAlerts.js'
import { fmtDecimal } from '../../../utils/index.js'
import { fmtPx } from '../asset/format.js'
import { dirOf, focusLater, pctOrDash } from './shared.js'
import { AlertLine, AlertsBar, BellBtn, ImportOld, OrphanAlerts } from './AlertParts.jsx'
import s from '../portfolio/portfolio.module.css'
import f from './follow.module.css'

const ICON = { up: ArrowUp, down: ArrowDown, flat: Equal }
// Columnas técnicas de la Vista completa, con su explicación en la leyenda.
const LEGEND = ['trend', 'rsi', 'macd', 'vol', 'range']
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

export default function ListPane({ t, d, full, demo = false, push, now = Date.now(), focusAlerts = false, onFocused, onOpen, onAlert, onNewAlert, onCompare, onSay, onErr }) {
  const id = useId()
  const [adding, setAdding] = useState(false)
  const [input, setInput] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [trend, setTrend] = useState('all')
  const bySym = useMemo(() => alertsBySymbol(d.alerts.list), [d.alerts.list])
  const rows = useMemo(() => d.watch.list.map(tk => followRow(tk, d.quotes[tk] || null, full ? d.hist[tk] || null : null)), [d.watch.list, d.quotes, d.hist, full])
  const counts = trendCounts(rows)
  const shown = full ? byTrend(rows, trend) : rows
  const empty = d.watch.phase !== 'loading' && d.watch.phase !== 'error' && !rows.length
  // Sin activos, el campo para seguir uno queda abierto.
  const formOpen = adding || empty
  const alertsOff = d.alerts.phase === 'error' && d.alerts.error === 'table_missing'
  const sumId = `${id}-al`
  // Llegada desde el aviso de una alerta (o Ajustes): las alertas a la vista.
  useEffect(() => {
    if (!focusAlerts) return
    focusLater(sumId)
    // Se consume: volver a Mi lista después no vuelve a saltar a las alertas.
    onFocused?.()
    try { if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => document.getElementById(sumId)?.scrollIntoView?.({ block: 'center' })) } catch { /* sin DOM */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- onFocused cambia en cada render
  }, [focusAlerts, sumId])
  function toggleAdd() {
    setAdding(v => !v)
    if (!adding) focusLater(`${id}-add`)
  }

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
    setAdding(false)
    onSay(t(r.data?.existed ? 'fl.list.exists' : 'fl.list.added', { t: tk }))
  }
  async function remove(tk) {
    const idx = d.watch.list.indexOf(tk)
    const si = shown.findIndex(r => r.t === tk)
    const next = shown[si + 1]?.t || shown[si - 1]?.t || null
    const r = await d.unfollow(tk)
    if (!r.ok) { onErr(r.error); return }
    // La fila desaparece con el botón que tenía el foco: pasa a la vecina o al título.
    focusLater(next ? rmId(next) : `${id}-h`)
    onSay(t('fl.list.removed', { t: tk }), { label: t('fl.undo'), onAction: () => d.refollow(tk, idx) })
  }

  const bell = (tk) => <BellBtn t={t} tk={tk} n={(bySym.get(tk) || []).length} onClick={() => onAlert(tk)} />
  const line = (tk) => <AlertLine t={t} list={bySym.get(tk)} quote={d.quotes[tk] || null} now={now} />
  const rmId = (tk) => `${id}-rm-${tk}`
  const removeBtn = (tk) => (
    <button type="button" id={rmId(tk)} className={s.iconBtn} onClick={() => remove(tk)} aria-label={t('fl.row.remove', { t: tk })}>
      <X size={18} strokeWidth={2} aria-hidden="true" />
    </button>
  )
  const price = (r) => (r.price != null ? <Money>{fmtPx(r.price, r.ccy || 'USD')}</Money> : <span className={s.rowSub}>{t('fl.row.noPrice')}</span>)

  return (
    <section className={s.section} aria-labelledby={`${id}-h`}>
      <div className={s.sectionHead}>
        <h2 id={`${id}-h`} className={s.sectionTitle} tabIndex={-1}>{t('fl.list.title')}</h2>
      </div>
      <div className={s.actionsRow} role="group" aria-label={t('fl.bar.label')}>
        <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={toggleAdd} aria-expanded={formOpen} aria-controls={`${id}-form`} disabled={empty}>
          <Plus size={16} strokeWidth={2.4} aria-hidden="true" />{t('fl.bar.follow')}
        </button>
        <button type="button" className={s.btn} onClick={() => onNewAlert('')} disabled={alertsOff || d.alerts.phase === 'loading'}>{t('fl.al.new')}</button>
        <button type="button" className={s.btn} onClick={() => onCompare(d.watch.list)}>{t('fl.bar.compare')}</button>
      </div>

      {formOpen && <>
      <form id={`${id}-form`} className={s.inline} onSubmit={add} noValidate>
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
      </>}

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
      {rows.length > 0 && d.quotesFailed && <p className={s.note} role="status" data-tone="warn">{t('fl.list.noQuotes')}</p>}

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
              <button type="button" className={`${s.rowHead} ${f.rowHead2}`} onClick={() => onOpen(r.t)} aria-label={t('fl.row.open', { t: r.t })}>
                <span className={s.badge} aria-hidden="true">{r.t.slice(0, 4)}</span>
                <span className={s.rowMain}>
                  <span className={s.rowTitle}>{r.t}</span>
                  {r.name && r.name !== r.t && <span className={s.rowSub}>{r.name}</span>}
                  {line(r.t)}
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
                {LEGEND.map(k => <th key={k} scope="col">{t(`fl.col.${k}`)}</th>)}
                <th scope="col"><span className={s.srOnly}>{t('fl.col.actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map(r => {
                const missing = d.hist[r.t] === null
                return (
                  <tr key={r.t}>
                    <th scope="row">
                      <button type="button" className={`${s.link} ${f.cellOpen}`} onClick={() => onOpen(r.t)} aria-label={t('fl.row.open', { t: r.t })}>
                        <span>{r.t}</span>{line(r.t)}
                      </button>
                    </th>
                    <td>{price(r)}</td>
                    <td><Day v={r.changePct} /></td>
                    <td><Cell t={t} scored={r.scored} missing={missing}>{r.trend ? t(`fl.trend.${r.trend}`) : t('fl.cell.na')}</Cell></td>
                    <td><Cell t={t} scored={r.scored} missing={missing}>{rsiText(t, r)}</Cell></td>
                    <td><Cell t={t} scored={r.scored} missing={missing}>{macdText(t, r)}</Cell></td>
                    <td><Cell t={t} scored={r.scored} missing={missing}>{r.vol == null ? t('fl.cell.na') : pctOrDash(r.vol, { signed: true, decimals: 0 })}</Cell></td>
                    <td>
                      {r.range ? (
                        <span className={f.range}>
                          <span className={f.rangeBar} aria-hidden="true"><span className={f.rangeDot} style={{ left: `${(r.range.pos * 100).toFixed(1)}%` }} /></span>
                          {t('fl.range.pos', { pct: pctOrDash(r.range.pos, { decimals: 0 }) })}
                          <span className={s.srOnly}> ({t('fl.range.title', { lo: fmtPx(r.range.lo, r.ccy || 'USD'), hi: fmtPx(r.range.hi, r.ccy || 'USD') })})</span>
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

      {rows.length > 0 && full && (
        // Qué significa cada columna, visible (en el teléfono no hay "title").
        <dl className={f.legend} aria-label={t('fl.legend.label')}>
          {LEGEND.map(k => (
            <div key={k} className={f.legendItem}><dt className={f.legendTerm}>{t(`fl.col.${k}`)}</dt><dd>{t(`fl.col.${k}Hint`)}</dd></div>
          ))}
        </dl>
      )}

      <AlertsBar t={t} d={d} push={push || { state: demo ? 'demo' : 'off', enable: () => {} }} now={now} sumId={sumId} />
      <OrphanAlerts t={t} d={d} watch={d.watch.list} now={now} onOpen={onOpen} onBell={onAlert} />

      <p className={s.note}>
        {full && `${t('fl.list.introFull')} `}{t('fl.list.foot2')} {d.alerts.list.length > 0 && `${t('fl.al.how')} ${t('fl.al.foot')} `}{t('fl.source')}
      </p>
      {!demo && !alertsOff && d.alerts.phase === 'ready' && <ImportOld t={t} d={d} onErr={onErr} />}
    </section>
  )
}
