// Descubrir (F4): listas fijas, iguales para todos (no son recomendaciones
// ni dependen del perfil), con datos reales de la API de Inversiones: precio,
// cambio del día y del último año. En Vista completa, además tendencia y RSI,
// filtros, tus propios símbolos y exportar lo que se ve a CSV (Invest
// renderScreenerSection, :4514).
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, Download, Plus } from 'lucide-react'
import Money from '../../../components/Money.jsx'
import { investApi } from '../../../core/investApi.js'
import { runLimited } from '../../../utils/investHoy.js'
import {
  DEFAULT_FILTERS, DISCOVER_LISTS, DISCOVER_MAX, TREND_FILTERS, applyFilters, discoverCsv, discoverList, followRow, parseTickers,
} from '../../../utils/investFollow.js'
import { demoFollowHistory, demoFollowQuotes } from '../../../demo/demoInvestFollow.js'
import { fmtPx } from '../asset/format.js'
import { downloadText } from '../portfolio/format.js'
import { Day, rsiText } from './ListPane.jsx'
import s from '../portfolio/portfolio.module.css'
import f from './follow.module.css'

// Precios en un pedido (lotes de 10) y un año de cierres de cada uno, de a 3.
export function useDiscover(demo) {
  const [st, setSt] = useState({ key: null, tickers: [], quotes: {}, hist: {}, phase: 'idle' })
  const run = useRef(0)
  const load = useCallback(async (key, tickers) => {
    const n = ++run.current
    setSt({ key, tickers, quotes: {}, hist: {}, phase: 'loading' })
    if (demo) {
      setSt({ key, tickers, quotes: demoFollowQuotes(tickers), hist: Object.fromEntries(tickers.map(t => [t, demoFollowHistory(t)])), phase: 'ready' })
      return
    }
    const quotes = await investApi.quotes(tickers)
    if (n !== run.current) return
    setSt(x => ({ ...x, quotes }))
    await runLimited(tickers.map(t => async () => {
      const rows = await investApi.history(t, '1y', '1d')
      if (n === run.current) setSt(x => ({ ...x, hist: { ...x.hist, [t]: rows || null } }))
    }), 3, () => n === run.current)
    if (n === run.current) setSt(x => ({ ...x, phase: 'ready' }))
  }, [demo])
  return { ...st, load }
}

export default function DiscoverPane({ t, full, demo, watch, onOpen, onFollow, onSay }) {
  const id = useId()
  const dz = useDiscover(demo)
  const [custom, setCustom] = useState('')
  const [note, setNote] = useState(null)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const { load } = dz

  useEffect(() => { if (!dz.key) load('etfBroad', discoverList('etfBroad').tickers) }, [dz.key, load])

  const rows = useMemo(() => dz.tickers.map(tk => followRow(tk, dz.quotes[tk] || null, dz.hist[tk] || null)), [dz.tickers, dz.quotes, dz.hist])
  const shown = full ? applyFilters(rows, filters) : rows
  const failed = dz.phase === 'ready' ? rows.filter(r => r.price == null && dz.hist[r.t] == null).map(r => r.t) : []
  const listMeta = DISCOVER_LISTS.find(l => l.id === dz.key)

  function runCustom(e) {
    e.preventDefault()
    const p = parseTickers(custom)
    if (!p.tickers.length) { setNote(t('fl.disc.emptyInput')); return }
    const parts = []
    if (p.cut) parts.push(t('fl.disc.cut', { n: DISCOVER_MAX }))
    if (p.bad.length) parts.push(t('fl.disc.bad', { list: p.bad.join(', ') }))
    setNote(parts.join(' ') || null)
    load('custom', p.tickers)
  }
  function exportCsv() {
    const csv = discoverCsv(shown, {
      ticker: t('fl.col.asset'), price: t('fl.col.price'), trend: t('fl.col.trend'), sma50: 'SMA 50', sma200: 'SMA 200', year: t('fl.col.year'),
      trends: { UP: t('fl.trend.UP'), MIX: t('fl.trend.MIX'), DOWN: t('fl.trend.DOWN') },
    })
    downloadText(`moyiq-descubrir-${dz.key || 'lista'}.csv`, csv, 'text/csv;charset=utf-8')
    onSay(t('fl.disc.csvDone'))
  }
  const setF = (k) => (e) => setFilters(x => ({ ...x, [k]: e.target.value }))
  const filtered = full && (filters.rsiMin !== DEFAULT_FILTERS.rsiMin || filters.rsiMax !== DEFAULT_FILTERS.rsiMax || filters.trend !== 'all')

  return (
    <section className={s.section} aria-labelledby={`${id}-h`}>
      <div className={s.sectionHead}><h2 id={`${id}-h`} className={s.sectionTitle}>{t('fl.disc.title')}</h2></div>
      <p className={s.note}>{t('fl.disc.intro')}</p>

      <div className={s.actionsRow} role="group" aria-label={t('fl.disc.lists')}>
        {DISCOVER_LISTS.map(l => (
          <button key={l.id} type="button" className={f.chip} aria-pressed={dz.key === l.id} onClick={() => load(l.id, l.tickers)}>{t(`fl.disc.list.${l.id}`)}</button>
        ))}
      </div>
      {listMeta && <p className={s.note}>{t(`fl.disc.desc.${listMeta.id}`)}</p>}

      {full && (
        <form className={s.inline} onSubmit={runCustom} noValidate>
          <div className={s.field}>
            <label htmlFor={`${id}-c`} className={s.fieldLabel}>{t('fl.disc.custom')}</label>
            <input id={`${id}-c`} className={s.input} value={custom} onChange={e => setCustom(e.target.value)} autoCapitalize="characters" autoComplete="off" spellCheck={false} aria-describedby={`${id}-ch`} />
          </div>
          <button type="submit" className={s.btn}>{t('fl.disc.run')}</button>
        </form>
      )}
      {full && <p id={`${id}-ch`} className={s.hint}>{t('fl.disc.customHint', { n: DISCOVER_MAX })}</p>}
      {note && <p className={s.note} role="status">{note}</p>}

      {full && rows.length > 0 && (
        <fieldset className={f.filters}>
          <legend className={s.fieldLabel}>{t('fl.disc.filters')}</legend>
          <div className={s.field}><label htmlFor={`${id}-r1`} className={s.fieldLabel}>{t('fl.disc.rsiMin')}</label><input id={`${id}-r1`} className={s.input} inputMode="numeric" value={filters.rsiMin} onChange={setF('rsiMin')} /></div>
          <div className={s.field}><label htmlFor={`${id}-r2`} className={s.fieldLabel}>{t('fl.disc.rsiMax')}</label><input id={`${id}-r2`} className={s.input} inputMode="numeric" value={filters.rsiMax} onChange={setF('rsiMax')} /></div>
          <div className={s.field}>
            <label htmlFor={`${id}-tr`} className={s.fieldLabel}>{t('fl.disc.trend')}</label>
            <select id={`${id}-tr`} className={s.select} value={filters.trend} onChange={setF('trend')}>
              {TREND_FILTERS.map(k => <option key={k} value={k}>{t(`fl.trend.${k}`)}</option>)}
            </select>
          </div>
          {filtered && <button type="button" className={s.link} onClick={() => setFilters(DEFAULT_FILTERS)}>{t('fl.disc.reset')}</button>}
        </fieldset>
      )}

      {dz.phase === 'loading' && <p className={s.note} role="status">{t('fl.disc.running', { n: dz.tickers.length })}</p>}
      {dz.phase === 'idle' && <p className={s.note}>{t('fl.disc.pick')}</p>}

      {rows.length > 0 && (
        <>
          <div className={s.sectionHead}>
            <span className={s.sectionHint} role="status">{t('fl.disc.meta', { n: shown.length, m: rows.length })}</span>
            {full && shown.length > 0 && <button type="button" className={s.btn} onClick={exportCsv}><Download size={16} strokeWidth={2} aria-hidden="true" />{t('fl.disc.csv')}</button>}
          </div>
          {shown.length ? (
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the table can scroll sideways on a phone; the region takes focus so keyboard users can scroll it (axe scrollable-region-focusable)
            <div className={s.tableScroll} tabIndex={0} role="region" aria-label={t('fl.disc.title')}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th scope="col">{t('fl.col.asset')}</th>
                    <th scope="col">{t('fl.col.price')}</th>
                    <th scope="col">{t('fl.col.day')}</th>
                    <th scope="col" title={t('fl.disc.yearHint')}>{t('fl.col.year')}</th>
                    {full && <th scope="col" title={t('fl.col.trendHint')}>{t('fl.col.trend')}</th>}
                    {full && <th scope="col" title={t('fl.col.rsiHint')}>{t('fl.col.rsi')}</th>}
                    <th scope="col"><span className={s.srOnly}>{t('fl.col.actions')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(r => {
                    const on = watch.includes(r.t)
                    const pending = !(r.t in dz.hist)
                    return (
                      <tr key={r.t}>
                        <th scope="row"><button type="button" className={s.link} onClick={() => onOpen(r.t)} aria-label={t('fl.row.open', { t: r.t })}>{r.t}</button></th>
                        <td>{r.price != null ? <Money>{fmtPx(r.price, r.ccy || 'USD')}</Money> : '—'}</td>
                        <td><Day v={r.changePct} /></td>
                        <td>{pending ? <span className={s.rowSub}>{t('fl.cell.calc')}</span> : <Day v={r.yearPct} />}</td>
                        {full && <td>{pending ? <span className={s.rowSub}>{t('fl.cell.calc')}</span> : r.trend ? t(`fl.trend.${r.trend}`) : t('fl.cell.na')}</td>}
                        {full && <td>{pending ? <span className={s.rowSub}>{t('fl.cell.calc')}</span> : rsiText(t, r)}</td>}
                        <td>
                          <button type="button" className={f.chip} aria-pressed={on} disabled={on} onClick={() => onFollow(r.t)}
                            aria-label={on ? t('fl.disc.followingT', { t: r.t }) : t('fl.disc.followT', { t: r.t })}>
                            {on ? <Check size={14} strokeWidth={2.2} aria-hidden="true" /> : <Plus size={14} strokeWidth={2.2} aria-hidden="true" />}
                            {on ? t('fl.disc.following') : t('fl.disc.follow')}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : <p className={s.note}>{t('fl.disc.none')}</p>}
          {failed.length > 0 && <p className={s.note}>{t('fl.disc.failed', { list: failed.join(', ') })}</p>}
          <p className={s.note}>{t('fl.disc.yearHint')} {t('fl.source')}</p>
        </>
      )}
    </section>
  )
}

