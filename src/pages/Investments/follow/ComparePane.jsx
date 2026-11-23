// Comparar (F4): hasta 4 activos en el mismo período, partiendo de 0 %
// (Invest renderCompSection, :8103). Vista esencial: cómo le fue a cada uno y
// "cuánto se mueve" en palabras. Vista completa: volatilidad diaria y anual,
// índice de Sharpe, punto más alto y más bajo, y la correlación de los
// rendimientos diarios por par. "3A" son 3 años de calendario (Invest pedía 5).
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { investApi } from '../../../core/investApi.js'
import { runLimited } from '../../../utils/investHoy.js'
import {
  COMPARE_PERIODS, COMPARE_SUGGESTIONS, DEFAULT_COMPARE, addToCompare, compareSet, periodOf, removeFromCompare, slicePeriod,
} from '../../../utils/investFollow.js'
import { takeQueuedCompare } from '../../../utils/investNav.js'
import { fmtDecimal } from '../../../utils/index.js'
import { demoFollowHistory } from '../../../demo/demoInvestFollow.js'
import { pctOrDash } from './shared.js'
import s from '../portfolio/portfolio.module.css'
import f from './follow.module.css'

export const LINE_COLORS = ['var(--chart-net)', 'var(--chart-income)', 'var(--chart-expense)', 'var(--accent2, var(--chart-axis))']
const DASH = [null, '6 4', '2 3', '10 3 2 3']
const REF = 'SPY'

// Trazos del gráfico: x por fecha (en común para todas), y por rendimiento.
export function compareChart(seriesByT, W = 600, H = 220, pad = 8) {
  const all = Object.values(seriesByT).flat()
  if (all.length < 2) return null
  const t0 = Math.min(...all.map(p => p.ts)), t1 = Math.max(...all.map(p => p.ts))
  const lo = Math.min(0, ...all.map(p => p.pct)), hi = Math.max(0, ...all.map(p => p.pct))
  const span = hi - lo || 1, tspan = t1 - t0 || 1
  const x = (ts) => ((ts - t0) / tspan) * W
  const y = (v) => pad + (1 - (v - lo) / span) * (H - pad * 2)
  const paths = {}
  for (const [k, pts] of Object.entries(seriesByT)) {
    if (pts.length < 2) continue
    paths[k] = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.ts).toFixed(1)},${y(p.pct).toFixed(1)}`).join('')
  }
  return { paths, zero: y(0), lo, hi }
}

export default function ComparePane({ t, demo, full, initial = null }) {
  const id = useId()
  const [tickers, setTickers] = useState(() => initial || takeQueuedCompare() || DEFAULT_COMPARE.tickers)
  const [period, setPeriod] = useState(DEFAULT_COMPARE.period)
  const [input, setInput] = useState('')
  const [err, setErr] = useState(null)
  const [ref, setRef] = useState(false)
  const [hist, setHist] = useState({}) // `${t}:${range}` → filas | null
  const p = periodOf(period)
  const wanted = useMemo(() => [...new Set([...tickers, ...(ref ? [REF] : [])])], [tickers, ref])
  const run = useRef(0)

  useEffect(() => {
    const todo = wanted.filter(tk => !(`${tk}:${p.range}` in hist))
    if (!todo.length) return undefined
    if (demo) { setHist(h => ({ ...h, ...Object.fromEntries(todo.map(tk => [`${tk}:${p.range}`, demoFollowHistory(tk, p.range)])) })); return undefined }
    const n = ++run.current
    runLimited(todo.map(tk => async () => {
      const rows = await investApi.history(tk, p.range, '1d')
      if (n === run.current) setHist(h => ({ ...h, [`${tk}:${p.range}`]: rows || null }))
    }), 3, () => n === run.current)
    return undefined
  // `hist` queda fuera: cada resultado nuevo no vuelve a planear.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, p.range, demo])

  const byT = useMemo(() => Object.fromEntries(wanted.map(tk => [tk, hist[`${tk}:${p.range}`] || null])), [wanted, hist, p.range])
  const loading = wanted.some(tk => !(`${tk}:${p.range}` in hist))
  const cmp = useMemo(() => compareSet(tickers, byT, period), [tickers, byT, period])
  const refSeries = useMemo(() => {
    if (!ref || tickers.includes(REF) || !byT[REF]) return null
    const rows = slicePeriod(byT[REF], p.months)
    if (rows.length <= 5) return null
    return rows.map(r => ({ ts: r.ts, pct: r.close / rows[0].close - 1 }))
  }, [ref, tickers, byT, p.months])
  const drawn = Object.keys(cmp.series)
  const chart = compareChart({ ...cmp.series, ...(refSeries ? { [REF]: refSeries } : {}) })
  const periodLabel = t(`fl.cmp.p.${period}`)

  function add(e) {
    e.preventDefault()
    const r = addToCompare(tickers, input)
    if (!r.ok) { setErr(t(`fl.cmp.err.${r.error}`, { t: input.toUpperCase().trim() })); return }
    setTickers(r.list); setInput(''); setErr(null)
  }
  function remove(tk) {
    const r = removeFromCompare(tickers, tk)
    if (!r.ok) { setErr(t('fl.cmp.err.min')); return }
    setTickers(r.list); setErr(null)
  }
  const color = (tk) => LINE_COLORS[tickers.indexOf(tk) % LINE_COLORS.length]
  const dash = (tk) => DASH[tickers.indexOf(tk) % DASH.length]

  return (
    <section className={s.section} aria-labelledby={`${id}-h`}>
      <div className={s.sectionHead}><h2 id={`${id}-h`} className={s.sectionTitle}>{t('fl.cmp.title')}</h2></div>
      <p className={s.note}>{t('fl.cmp.intro')}</p>

      <ul className={s.actionsRow} aria-label={t('fl.cmp.assets')} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {tickers.map(tk => (
          <li key={tk} className={f.pill}>
            <span className={f.swatch} style={{ background: color(tk) }} aria-hidden="true" />{tk}
            <button type="button" className={s.iconBtn} onClick={() => remove(tk)} aria-label={t('fl.cmp.remove', { t: tk })}><X size={16} strokeWidth={2} aria-hidden="true" /></button>
          </li>
        ))}
      </ul>
      <form className={s.inline} onSubmit={add} noValidate>
        <div className={s.field}>
          <label htmlFor={`${id}-a`} className={s.fieldLabel}>{t('fl.cmp.addLabel')}</label>
          <input id={`${id}-a`} className={s.input} value={input} onChange={e => { setInput(e.target.value); setErr(null) }} autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={15}
            aria-invalid={err ? 'true' : undefined} aria-describedby={err ? `${id}-err` : undefined} />
        </div>
        <button type="submit" className={s.btn}>{t('fl.cmp.add')}</button>
      </form>
      {err && <p id={`${id}-err`} className={s.error} role="alert">{err}</p>}

      <div className={s.field}>
        <span id={`${id}-p`} className={s.fieldLabel}>{t('fl.cmp.period')}</span>
        <div className={s.actionsRow} role="group" aria-labelledby={`${id}-p`}>
          {COMPARE_PERIODS.map(x => <button key={x.key} type="button" className={f.chip} aria-pressed={period === x.key} onClick={() => setPeriod(x.key)}>{t(`fl.cmp.p.${x.key}`)}</button>)}
        </div>
      </div>
      <div className={s.field}>
        <span id={`${id}-s`} className={s.fieldLabel}>{t('fl.cmp.sugg')}</span>
        <div className={s.actionsRow} role="group" aria-labelledby={`${id}-s`}>
          {COMPARE_SUGGESTIONS.map(x => <button key={x.id} type="button" className={f.chip} onClick={() => { setTickers(x.tickers); setErr(null) }}>{t(`fl.cmp.s.${x.id}`)}</button>)}
        </div>
      </div>
      <label className={s.check}><input type="checkbox" checked={ref} onChange={e => setRef(e.target.checked)} />{t('fl.cmp.ref')}</label>

      {tickers.length < 2 ? <p className={s.note}>{t('fl.cmp.need2')}</p> : loading && !drawn.length ? <p className={s.note} role="status">{t('fl.cmp.loading')}</p> : !drawn.length ? <p className={s.note}>{t('fl.cmp.noHist')}</p> : (
        <>
          <figure className={f.chartFig}>
            <svg viewBox="0 0 600 220" preserveAspectRatio="none" className={f.chart} role="img"
              aria-label={`${t('fl.cmp.chart')}. ${drawn.map(tk => t('fl.cmp.chartSummary', { t: tk, pct: pctOrDash(cmp.stats[tk].ret, { signed: true }) })).join('; ')}`}>
              {chart && <line x1="0" x2="600" y1={chart.zero} y2={chart.zero} stroke="var(--chart-grid)" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
              {chart?.paths[REF] && refSeries && <path d={chart.paths[REF]} fill="none" stroke="var(--chart-prev)" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
              {drawn.map(tk => chart?.paths[tk] && <path key={tk} d={chart.paths[tk]} fill="none" stroke={color(tk)} strokeWidth="2" strokeDasharray={dash(tk) || undefined} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
            </svg>
            <figcaption>
              <ul className={s.legend}>
                {drawn.map(tk => (
                  <li key={tk} className={s.legendItem}>
                    <svg width="22" height="10" aria-hidden="true"><line x1="0" x2="22" y1="5" y2="5" stroke={color(tk)} strokeWidth="2.5" strokeDasharray={dash(tk) || undefined} /></svg>
                    {tk}<span className={s.legendPct}>{pctOrDash(cmp.stats[tk].ret, { signed: true })}</span>
                  </li>
                ))}
                {refSeries && <li className={s.legendItem}><svg width="22" height="10" aria-hidden="true"><line x1="0" x2="22" y1="5" y2="5" stroke="var(--chart-prev)" strokeWidth="2" strokeDasharray="4 4" /></svg>{REF}<span className={s.legendPct}>{pctOrDash(refSeries[refSeries.length - 1].pct, { signed: true })}</span></li>}
              </ul>
            </figcaption>
          </figure>
          {cmp.missing.length > 0 && <p className={s.note}>{t('fl.cmp.missing', { t: cmp.missing.join(', ') })}</p>}

          {cmp.best && <p className={s.notice}>{t('fl.cmp.best', { period: periodLabel, t: cmp.best, pct: pctOrDash(cmp.stats[cmp.best].ret, { signed: true }) })}{cmp.calmest && drawn.length > 1 ? ` ${t('fl.cmp.calmest', { t: cmp.calmest })}` : ''}</p>}

          {!full && (
            <ul className={s.cells} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {drawn.map(tk => {
                const st = cmp.stats[tk]
                return (
                  <li key={tk} className={s.cell}>
                    <span className={s.cellLabel}>{tk}</span>
                    <span className={s.cellValue}>{t('fl.cmp.inPeriod', { pct: pctOrDash(st.ret, { signed: true }), period: periodLabel })}</span>
                    {st.move && <span className={s.cellSub}><strong>{t(`fl.cmp.move.${st.move}`)}</strong>. {st.vol != null && t('fl.cmp.typical', { pct: pctOrDash(st.vol) })}</span>}
                  </li>
                )
              })}
            </ul>
          )}

          {full && (
            <>
              {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the table can scroll sideways on a phone; the region takes focus so keyboard users can scroll it (axe scrollable-region-focusable) */}
              <div className={s.tableScroll} tabIndex={0} role="region" aria-label={t('fl.cmp.tbl')}>
                <table className={s.table}>
                  <caption>{t('fl.cmp.tbl')}</caption>
                  <thead><tr>
                    <th scope="col">{t('fl.col.asset')}</th><th scope="col">{t('fl.cmp.c.ret')}</th><th scope="col">{t('fl.cmp.c.vol')}</th>
                    <th scope="col">{t('fl.cmp.c.volYear')}</th><th scope="col">{t('fl.cmp.c.sharpe')}</th><th scope="col">{t('fl.cmp.c.max')}</th><th scope="col">{t('fl.cmp.c.min')}</th>
                  </tr></thead>
                  <tbody>
                    {drawn.map(tk => {
                      const st = cmp.stats[tk]
                      return (
                        <tr key={tk}>
                          <th scope="row">{tk}</th>
                          <td>{pctOrDash(st.ret, { signed: true })}</td><td>{pctOrDash(st.vol, { decimals: 2 })}</td><td>{pctOrDash(st.volYear)}</td>
                          <td>{st.sharpe == null || !Number.isFinite(st.sharpe) ? '—' : fmtDecimal(st.sharpe, 2)}</td>
                          <td>{pctOrDash(st.max, { signed: true })}</td><td>{pctOrDash(st.min, { signed: true })}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className={s.note}>{t('fl.cmp.sharpeNote')}</p>
              {cmp.pairs.length > 0 && (
                // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the table can scroll sideways on a phone; the region takes focus so keyboard users can scroll it (axe scrollable-region-focusable)
                <div className={s.tableScroll} tabIndex={0} role="region" aria-label={t('fl.cmp.corr')}>
                  <table className={s.table}>
                    <caption>{t('fl.cmp.corr')}</caption>
                    <thead><tr><th scope="col">{t('fl.cmp.c.pair')}</th><th scope="col">{t('fl.cmp.c.corr')}</th><th scope="col">{t('fl.cmp.c.reading')}</th></tr></thead>
                    <tbody>
                      {cmp.pairs.map(pr => (
                        <tr key={`${pr.a}-${pr.b}`}>
                          <th scope="row">{pr.a} · {pr.b}</th>
                          <td>{pr.r == null || !Number.isFinite(pr.r) ? '—' : fmtDecimal(pr.r, 2)}</td>
                          <td>{t(`fl.cmp.r.${pr.reading}`)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {cmp.pairs.length > 0 && <p className={s.note}>{t('fl.cmp.corrNote')}</p>}
            </>
          )}
          <p className={s.note}>{t('fl.cmp.past')} {t('fl.cmp.foot')}</p>
        </>
      )}
    </section>
  )
}
