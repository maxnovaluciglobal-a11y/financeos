// src/pages/Investments/market/Market.jsx — pestaña Mercado de Inversiones (F6).
//
// Port de renderMercado de Invest (inventario 05-mercado.md): cinta, horario
// de la bolsa y frescura, contexto (tendencia de SPY con "¿Qué significa para
// mí?", minigráfico SPY vs media de 200 días, VIX con zonas 15/25/35), tabla
// de 10 índices y materias primas con sparkline mensual, próximos resultados,
// noticias con 6 filtros y tipos de cambio LatAm (ARS oficial y MEP).
// Se carga con lazy() desde el hub: nada de esto entra al JS inicial.
//
// `MarketView` es solo presentación (se prueba con renderToStaticMarkup); el
// componente por defecto le pasa los datos de useMarket.
import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowLeftRight, ArrowUp, Equal, ExternalLink, RefreshCw, TrendingDown, TrendingUp, TriangleAlert } from 'lucide-react'
import Sparkline from '../../../components/charts/Sparkline.jsx'
import { ChoiceGroup } from '../../../components/ui/index.jsx'
import { useT } from '../../../i18n/useT.js'
import { MINUS, NNBSP, dateLocale, fmtDecimal } from '../../../utils/index.js'
import { ARS_KIND_KEY, arsRateFor, readArsKind } from '../../../utils/investValuation.js'
import {
  EARN_MAX_TICKERS, EARN_SOURCE_NAME, NEWS_CATS, VIX_ZONES, chartPaths, feedFreshness, filterNews, fmtChange,
  fmtMarketValue, fxDecimals, fxRows, marketRows, newsAgo, newsCatKey, newsCounts, nyseSession, periodChange,
  regimeFrom, spyChartSeries, symName, vixGaugePct, vixZone, whenKey,
} from '../../../utils/investMarket.js'
import NewsThumb from '../news/NewsThumb.jsx'
import { useMarket } from './useMarket.js'
import { shows } from '../../../utils/investView.js'
import s from './market.module.css'

// ── Formatos (idioma de la interfaz) ──
export function fmtTime(ms) {
  if (!ms) return ''
  try { return new Date(ms).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}
function fmtWhen(ms, now) {
  if (!ms) return ''
  const same = new Date(ms).toDateString() === new Date(now).toDateString()
  try {
    return same ? fmtTime(ms) : new Date(ms).toLocaleString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch { return fmtTime(ms) }
}
function fmtDay(ymd) {
  try { return new Date(`${ymd}T12:00:00Z`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) } catch { return ymd }
}
function ccyName(ccy, lang) {
  try {
    const n = new Intl.DisplayNames([lang || 'es'], { type: 'currency' }).of(ccy)
    return n && n !== ccy ? n.charAt(0).toUpperCase() + n.slice(1) : ccy
  } catch { return ccy }
}
const usd = (v) => `US$${NNBSP}${fmtDecimal(v, 2)}`

const safeStore = {
  get: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { localStorage.setItem(k, v) } catch { /* modo privado: vale para esta visita */ } },
}

function Change({ frac }) {
  const c = fmtChange(frac)
  if (!c) return <span className={s.muted}>—</span>
  const Ic = c.dir === 'up' ? ArrowUp : c.dir === 'down' ? ArrowDown : Equal
  return <span className={s.chg} data-tone={c.dir}><Ic size={13} strokeWidth={2.4} aria-hidden="true" />{c.text}</span>
}

// ── Cabecera: horario de la bolsa, frescura y "Actualizar" ──
export function freshText(t, f) {
  if (f.state === 'sample') return t('invest.mkt.fresh.sample', { time: fmtTime(f.at) })
  if (f.state === 'ok') return t('invest.mkt.fresh.at', { time: fmtTime(f.at) })
  if (f.state === 'loading') return t('invest.mkt.fresh.loading')
  if (f.state === 'offline') return f.at ? t('invest.mkt.fresh.offline', { time: fmtTime(f.at) }) : t('invest.mkt.fresh.offlineNone')
  return t('invest.mkt.fresh.failed')
}
export function sessionText(t, ses, now) {
  if (ses.open) return t(ses.early ? 'invest.mkt.session.openEarly' : 'invest.mkt.session.open', { time: fmtTime(ses.closesAt) })
  const when = fmtWhen(ses.opensAt, now)
  return t(ses.reason === 'holiday' ? 'invest.mkt.session.holiday' : 'invest.mkt.session.closed', { when })
}

function Head({ t, m, now }) {
  const ses = nyseSession(now)
  const f = feedFreshness({ at: m.bar.at, loading: m.bar.phase === 'loading', failed: m.bar.phase === 'error' || m.bar.phase === 'stale', offline: m.offline, sample: samplePart(m, 'bar') })
  return (
    <section className={s.head} aria-label={t('invest.mkt.session.label')}>
      <div className={s.headText}>
        <p className={s.session} data-open={ses.open ? 'true' : 'false'}>
          <span className={s.dot} aria-hidden="true" />{sessionText(t, ses, now)}
        </p>
        <p className={s.note}>{t('invest.mkt.session.note')}</p>
        <p className={s.note} role="status" data-tone={f.state === 'failed' || f.state === 'offline' ? 'warn' : undefined}>{freshText(t, f)}</p>
      </div>
      <button type="button" className={s.btn} onClick={m.refresh} disabled={m.refreshing} aria-busy={m.refreshing || undefined}>
        <RefreshCw size={16} strokeWidth={2} aria-hidden="true" className={m.refreshing ? s.spin : undefined} />
        {m.refreshing ? t('invest.mkt.refreshing') : t('invest.mkt.refresh')}
      </button>
    </section>
  )
}

// ── Cinta ──
export function Strip({ t, rows, sparks, loading, onPick }) {
  const items = rows.filter(r => loading || r.price != null)
  if (!items.length) return null
  return (
    <section className={s.strip} aria-label={t('invest.mkt.idx.title')}>
      <ul className={s.stripList}>
        {items.map(r => {
          const name = symName(r, t)
          const val = r.price != null ? fmtMarketValue(r.sym, r.price) : ''
          const c = fmtChange(r.changePct)
          const aria = r.price == null ? name : c ? t('invest.mkt.strip.item', { name, value: val, pct: c.text }) : t('invest.mkt.strip.itemNoChg', { name, value: val })
          return (
            <li key={r.sym}>
              <button type="button" className={s.stripItem} aria-label={aria} onClick={() => onPick?.(r.sym)}>
                <span className={s.stripName}>{name}</span>
                {r.price != null
                  ? <><span className={s.num}>{val}</span>{c && <Change frac={r.changePct} />}</>
                  : <span className={s.skel} aria-hidden="true" />}
                <Sparkline values={sparks?.[r.sym] || null} width={48} height={16} />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ── Contexto: tendencia, gráfico, VIX ──
const REGIME_ICON = { up: TrendingUp, down: TrendingDown, mixed: ArrowLeftRight }
function SpyChart({ t, series, showMa = true }) {
  const W = 600, H = 120
  const p = chartPaths(series, W, H)
  if (!p) return null
  const last = series[series.length - 1]
  return (
    <figure className={s.spyFig}>
      <svg className={s.spy} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
        aria-label={showMa
          ? t('invest.mkt.spy.label', { spy: usd(last.close), ma: usd(last.ma) })
          : t('invest.mkt.spy.labelSimple', { spy: usd(last.close) })}>
        {showMa && <path d={p.ma} fill="none" stroke="var(--chart-prev)" strokeWidth="1.6" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />}
        <path d={p.price} fill="none" stroke="var(--chart-net)" strokeWidth="1.8" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className={s.legend}>
        <span><i className={s.keyPx} aria-hidden="true" />SPY</span>
        {showMa && <span><i className={s.keyMa} aria-hidden="true" />{t('invest.mkt.spy.ma')}</span>}
        <span>{t('invest.mkt.spy.range')}</span>
      </figcaption>
    </figure>
  )
}

export function VixGauge({ t, v }) {
  const z = vixZone(v)
  const pct = vixGaugePct(v)
  if (!z) return null
  return (
    <div className={s.gauge} role="img" aria-label={t('invest.mkt.vix.gauge', { v: fmtDecimal(v, 1), zone: t(`invest.mkt.vix.${z}`) })}>
      <div className={s.gaugeBar} aria-hidden="true">
        <span data-z="low" style={{ width: '30%' }} /><span data-z="normal" style={{ width: '20%' }} />
        <span data-z="elevated" style={{ width: '20%' }} /><span data-z="extreme" style={{ width: '30%' }} />
        <i className={s.gaugeMark} style={{ left: `${pct}%` }} />
      </div>
      <div className={s.gaugeTicks} aria-hidden="true">
        {VIX_ZONES.map((n, i) => <span key={n} style={{ left: `${[30, 50, 70][i]}%` }}>{n}</span>)}
      </div>
    </div>
  )
}

// Vista esencial: sin la media de 200 días (línea y cifra); la tendencia y su
// explicación quedan.
export function Context({ t, m, essential = false }) {
  const loading = m.spy.phase === 'loading'
  const reg = regimeFrom((m.spy.rows || []).map(r => r.close))
  const series = spyChartSeries(m.spy.rows)
  const Ic = REGIME_ICON[reg.regime] || TriangleAlert
  const z = vixZone(m.vix)
  const p200 = reg.pct200
  return (
    <section className={s.sec} aria-labelledby="mkt-ctx-h">
      <h2 id="mkt-ctx-h" className={s.h2}>{t('invest.mkt.ctx.title')}</h2>
      {loading ? <p className={s.note} role="status">{t('invest.mkt.ctx.loading')}</p> : (
        <>
          <p className={s.regime} data-tone={reg.regime || 'none'}>
            <Ic size={18} strokeWidth={2.2} aria-hidden="true" />{t(`invest.mkt.regime.${reg.regime || 'none'}`)}
          </p>
          {/* En la esencial, sin "medias de 50 y 200 días": lo mismo en palabras simples. */}
          <p className={s.body}>{reg.regime ? t(`invest.mkt.regime.${reg.regime}.${essential ? 'descSimple' : 'desc'}`) : t(reg.reason === 'short' ? (essential ? 'invest.mkt.regime.shortSimple' : 'invest.mkt.regime.short') : 'invest.mkt.regime.none.desc')}</p>
          {reg.regime && (
            <details className={s.meaning}>
              <summary>{t('invest.mkt.meaning.q')}</summary>
              <p>{t(`invest.mkt.meaning.${reg.regime}${essential ? '.simple' : ''}`)} {t('invest.mkt.meaning.note')}</p>
              <p className={s.note}>{t(essential ? 'invest.mkt.ruleSimple' : 'invest.mkt.rule')}</p>
            </details>
          )}
          {series ? <SpyChart t={t} series={series} showMa={!essential} /> : (reg.last != null && <p className={s.note}>{t(essential ? 'invest.mkt.spy.shortSimple' : 'invest.mkt.spy.short')}</p>)}
          {samplePart(m, 'spy') && !samplePart(m, 'bar') && <p className={s.note}>{t('invest.chart.sample')}</p>}
        </>
      )}
      <div className={s.figs} role="group" aria-label={t('invest.mkt.figsLabel')}>
        <div className={s.fig}>
          <span className={s.figK}>{t('invest.mkt.vix.k')}</span>
          <span className={s.figV}>
            <b className={s.num}>{z ? fmtDecimal(m.vix, 1) : '—'}</b>{' '}
            {z ? (
              <span className={s.zone} data-z={z}>
                {(z === 'elevated' || z === 'extreme') && <TriangleAlert size={14} strokeWidth={2.2} aria-hidden="true" />}
                {t(`invest.mkt.vix.${z}`)}
              </span>
            ) : <span className={s.muted}>{t('invest.mkt.vix.none')}</span>}
          </span>
          {z && <VixGauge t={t} v={m.vix} />}
          <span className={s.note}>{t('invest.mkt.vix.scale')}</span>
        </div>
        {!essential && <div className={s.fig}>
          <span className={s.figK}>{t('invest.mkt.p200.k')}</span>
          <span className={s.figV}>
            <b className={s.num} data-tone={p200 == null ? undefined : p200 >= 0 ? 'up' : 'down'}>
              {p200 == null ? '—' : `${p200 >= 0 ? '+' : MINUS}${fmtDecimal(Math.abs(p200) * 100, 1)}${NNBSP}%`}
            </b>{' '}
            <span className={s.muted}>{p200 == null ? t('invest.mkt.vix.none') : t(p200 >= 0 ? 'invest.mkt.p200.above' : 'invest.mkt.p200.below', { spy: usd(reg.last), ma: usd(reg.sma200) })}</span>
          </span>
        </div>}
      </div>
    </section>
  )
}

// ── Índices y materias primas ──
export function Indices({ t, rows, sparks, phase, f }) {
  const loading = phase === 'loading'
  return (
    <section className={s.sec} aria-labelledby="mkt-idx-h">
      <h2 id="mkt-idx-h" className={s.h2}>{t('invest.mkt.idx.title')}</h2>
      <p className={s.note}>{freshText(t, f)}</p>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th scope="col">{t('invest.mkt.idx.col.name')}</th>
              <th scope="col" className={s.r}>{t('invest.mkt.idx.col.value')}</th>
              <th scope="col" className={s.r}>{t('invest.mkt.idx.col.day')}</th>
              <th scope="col"><abbr title={t('invest.mkt.idx.monthHint')} className={s.abbr}>{t('invest.mkt.idx.col.month')}</abbr></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const name = symName(r, t)
              const sp = sparks?.[r.sym]
              const pc = periodChange(sp)
              return (
                <tr key={r.sym} id={`mkt-row-${r.sym.replace(/[^A-Z0-9]/gi, '')}`} tabIndex={-1}>
                  <th scope="row">{name}</th>
                  <td className={`${s.r} ${s.num}`}>{r.price != null ? fmtMarketValue(r.sym, r.price) : <span className={s.muted}>{loading ? t('invest.mkt.idx.loading') : t('invest.mkt.idx.none')}</span>}</td>
                  <td className={s.r}>{r.price != null ? <Change frac={r.changePct} /> : <span className={s.muted}>—</span>}</td>
                  <td>
                    {sp ? <Sparkline values={sp} width={72} height={20} label={t('invest.mkt.idx.spark', { name, pct: fmtChange(pc)?.text || '' })} />
                      : sp === null ? <span className={s.muted}>—</span> : <span className={s.skel} aria-hidden="true" />}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className={s.note}>{t('invest.mkt.idx.monthHint')}</p>
    </section>
  )
}

// ── Próximos resultados ──
export function Earnings({ t, earn, onOpen, sample }) {
  const head = <h2 id="mkt-earn-h" className={s.h2}>{t('invest.mkt.earn.title')}</h2>
  if (earn.phase === 'loading' || !earn.result) {
    return <section className={s.sec} aria-labelledby="mkt-earn-h">{head}<p className={s.note} role="status">{t('invest.mkt.earn.loading')}</p></section>
  }
  const { result: r, universe: u } = earn
  const note = u?.defaults ? t('invest.mkt.earn.defaults') : t('invest.mkt.earn.mine')
  let body
  if (r.total && r.failed === r.total) body = <p className={s.body}>{t('invest.mkt.earn.failed')}</p>
  else if (!r.items.length) body = <p className={s.body}>{t('invest.mkt.earn.empty')}</p>
  else {
    body = (
      <ul className={s.list}>
        {r.items.map(x => {
          const w = whenKey(x.days)
          const when = t(w.key, { n: w.n })
          const mine = u?.portfolio?.has(x.ticker) ? t('invest.mkt.earn.inPortfolio') : u?.watch?.has(x.ticker) ? t('invest.mkt.earn.inList') : ''
          return (
            <li key={x.ticker}>
              <button type="button" className={s.row} onClick={() => onOpen?.(x.ticker)} aria-label={t('invest.mkt.earn.open', { t: x.ticker, date: fmtDay(x.date), when })}>
                <span className={s.rowL1}><b className={s.ticker}>{x.ticker}</b><span className={s.num}>{fmtDay(x.date)}</span><span className={s.when}>{when}</span></span>
                {mine && <span className={s.rowL2}>{mine}</span>}
              </button>
            </li>
          )
        })}
      </ul>
    )
  }
  const src = sample ? t('invest.mkt.sampleShort') : (r.sources || []).map(k => EARN_SOURCE_NAME[k] || k).join(', ')
  return (
    <section className={s.sec} aria-labelledby="mkt-earn-h">
      {head}
      <p className={s.note}>{note}</p>
      {r.failed > 0 && r.failed < r.total && <p className={s.note}>{t('invest.mkt.earn.partial', { n: r.failed, total: r.total })}</p>}
      {u?.capped && <p className={s.note}>{t('invest.mkt.earn.capped', { n: EARN_MAX_TICKERS })}</p>}
      {body}
      {src && <p className={s.note}>{t('invest.mkt.earn.source', { source: src })}</p>}
      {!sample && !u?.defaults && <p className={s.note}>{t('invest.mkt.earn.privacy')}</p>}
    </section>
  )
}

// ── Noticias ──
export function News({ t, news, filter, setFilter, sample }) {
  const all = news.items || []
  const head = (
    <div className={s.secHead}>
      <h2 id="mkt-news-h" className={s.h2}>{t('invest.mkt.news.title')}</h2>
      {all.length > 0 && <span className={s.note}>{t(all.length === 1 ? 'invest.mkt.news.countOne' : 'invest.mkt.news.countMany', { n: all.length })}</span>}
    </div>
  )
  if (!all.length) {
    return (
      <section className={s.sec} aria-labelledby="mkt-news-h">{head}
        <p className={s.body} role="status">{news.phase === 'loading' ? t('invest.mkt.news.loading') : t('invest.mkt.news.none')}</p>
      </section>
    )
  }
  const counts = newsCounts(all)
  const f = NEWS_CATS.some(c => c.id === filter) ? filter : 'all'
  const shown = filterNews(all, f)
  return (
    <section className={s.sec} aria-labelledby="mkt-news-h">
      {head}
      <div className={s.chips} role="group" aria-label={t('invest.mkt.news.filterLabel')}>
        {NEWS_CATS.map(c => {
          const n = counts[c.id] || 0
          const on = f === c.id
          return (
            <button key={c.id} type="button" className="fos-chip fos-chip--tall" aria-pressed={on} disabled={!on && n === 0}
              onClick={() => setFilter(c.id)}>
              {t(c.key)} <span className={s.num}>{n}</span>
            </button>
          )
        })}
      </div>
      {!shown.length ? (
        <p className={s.body}>
          {t('invest.mkt.news.emptyCat', { cat: t(newsCatKey(f)) })}{' '}
          <button type="button" className={s.link} onClick={() => setFilter('all')}>{t('invest.mkt.news.seeAll')}</button>
        </p>
      ) : (
        <ul className={s.news}>
          {shown.map(n => {
            const ago = newsAgo(n.hoursAgo)
            const meta = [n.sourceKey ? t(n.sourceKey) : n.source, ago && t(ago.key, { n: ago.n }), f === 'all' && t(newsCatKey(n.cat))].filter(Boolean).join(' · ')
            return (
              <li key={n.id} className={s.newsItem}>
                <div className={s.newsText}>
                  {n.link ? (
                    <a href={n.link} target="_blank" rel="noopener noreferrer" lang="en" className={s.newsLink}>
                      {n.title}<ExternalLink size={13} strokeWidth={2} aria-hidden="true" className={s.ext} /><span className="sr-only"> {t('invest.mkt.news.newTab')}</span>
                    </a>
                  ) : <span className={s.newsTitle} lang={n.sample ? undefined : 'en'}>{n.titleKey ? t(n.titleKey) : n.title}</span>}
                  {meta && <span className={s.note}>{meta}</span>}
                </div>
                {n.image && <NewsThumb key={n.image} url={n.image} />}
              </li>
            )
          })}
        </ul>
      )}
      <p className={s.note}>{sample ? t('invest.mkt.news.footSample') : t('invest.mkt.news.foot')}</p>
    </section>
  )
}

// ── Tipos de cambio ──
const FX_SRC = { mindicador: 'invest.mkt.fx.src.mindicador', yahoo: 'invest.mkt.fx.src.yahoo', dolarapi: 'invest.mkt.fx.src.dolarapi', sample: 'invest.mkt.sampleShort' }
export function Fx({ t, lang, fx, sample, kind, setKind }) {
  const head = <h2 id="mkt-fx-h" className={s.h2}>{t('invest.mkt.fx.title')}</h2>
  if (fx.phase === 'loading') return <section className={s.sec} aria-labelledby="mkt-fx-h">{head}<p className={s.note} role="status">{t('invest.mkt.fx.loading')}</p></section>
  if (fx.phase === 'error') return <section className={s.sec} aria-labelledby="mkt-fx-h">{head}<p className={s.body}>{t('invest.mkt.fx.failed')}</p></section>
  const rows = fxRows(fx.latam, fx.ars, { sample })
  const oficial = rows.find(r => r.id === 'ARS-Oficial')?.rate ?? null
  const choice = arsRateFor(kind, fx.ars?.mep, oficial)
  const usesDolarApi = rows.some(r => r.source === 'dolarapi')
  return (
    <section className={s.sec} aria-labelledby="mkt-fx-h">
      {head}
      <p className={s.note}>{t('invest.mkt.fx.sub')}</p>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead><tr><th scope="col">{t('invest.mkt.fx.col.ccy')}</th><th scope="col" className={s.r}>{t('invest.mkt.fx.col.rate')}</th><th scope="col">{t('invest.mkt.fx.col.source')}</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <th scope="row">
                  <span className={s.ccy}>{r.ccy}</span>{' '}
                  <span className={s.ccyName}>{r.kind ? t(r.kind === 'MEP' ? 'invest.mkt.fx.arsMep' : 'invest.mkt.fx.arsOficial') : ccyName(r.ccy, lang)}</span>
                </th>
                <td className={`${s.r} ${s.num}`}>{r.rate != null ? fmtDecimal(r.rate, fxDecimals(r.ccy, r.rate)) : '—'}</td>
                <td className={s.src}>
                  {r.rate == null ? <span className={s.warn}>{t('invest.mkt.fx.src.none')}</span>
                    : r.date ? t('invest.mkt.fx.src.dated', { source: t(FX_SRC[r.source]), date: fmtDay(r.date) }) : t(FX_SRC[r.source])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={s.kind}>
        <span id="mkt-ars-kind" className={s.figK}>{t('invest.mkt.fx.kind.label')}</span>
        <ChoiceGroup labelledBy="mkt-ars-kind" value={kind} onChange={setKind}
          options={[{ value: 'MEP', label: t('invest.mkt.fx.kind.mep') }, { value: 'Oficial', label: t('invest.mkt.fx.kind.oficial') }]} />
        {choice?.fallback && <p className={s.note} role="status">{t(choice.kind === 'Oficial' ? 'invest.mkt.fx.fallbackMep' : 'invest.mkt.fx.fallbackOficial')}</p>}
        {!choice && <p className={s.note}>{t('invest.mkt.fx.arsNone')}</p>}
      </div>
      <p className={s.note}>{t('invest.mkt.fx.note')}</p>
      {usesDolarApi && <p className={s.note}>{t('invest.mkt.fx.citeDolarApi')} <a href="https://dolarapi.com" target="_blank" rel="noopener noreferrer" className={s.link}>dolarapi.com<span className="sr-only"> {t('invest.mkt.news.newTab')}</span></a></p>}
    </section>
  )
}

// ¿Esta pieza es de ejemplo? En el demo cada una cae sola al ejemplo si la
// API no responde (useMarket → parts); sin `parts`, todo o nada.
export const samplePart = (m, k) => !!m.sample && (m.parts ? !!m.parts[k] : true)

// ── Vista completa ──
export function MarketView({ t, lang = 'es', m, now = Date.now(), onOpen, onTab, filter = 'all', setFilter = () => {}, kind = 'MEP', setKind = () => {}, view = 'completa' }) {
  const essential = !shows(view, 'strip')
  const rows = marketRows(m.bar.data)
  const loading = m.bar.phase === 'loading'
  const f = feedFreshness({ at: m.bar.at, loading, failed: m.bar.phase === 'error' || m.bar.phase === 'stale', offline: m.offline, sample: samplePart(m, 'bar') })
  const pick = useCallback((sym) => {
    const el = typeof document !== 'undefined' ? document.getElementById(`mkt-row-${sym.replace(/[^A-Z0-9]/gi, '')}`) : null
    if (el) { el.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); el.focus?.({ preventScroll: true }) }
  }, [])
  return (
    <div className={s.market}>
      {/* Solo si todo lo que enumera es real; si no, cada sección se rotula sola. */}
      {m.demo && !m.sample && m.bar.phase !== 'loading' && <p className={s.sample} role="note">{t('invest.mkt.demoLive')}</p>}
      {m.sample && <p className={s.sample} role="note">{t('invest.mkt.sample')}</p>}
      {!essential && <Strip t={t} rows={rows} sparks={m.sparks} loading={loading} onPick={pick} />}
      <Head t={t} m={m} now={now} />
      <p className={s.body}>{t('invest.mkt.sub')}</p>
      <Context t={t} m={m} essential={essential} />
      <Indices t={t} rows={rows} sparks={m.sparks} phase={m.bar.phase} f={f} />
      <Earnings t={t} earn={m.earn} onOpen={onOpen} sample={samplePart(m, 'earn')} />
      <News t={t} news={m.news} filter={filter} setFilter={setFilter} sample={samplePart(m, 'news')} />
      <Fx t={t} lang={lang} fx={m.fx} sample={samplePart(m, 'fx')} kind={kind} setKind={setKind} />
      <section className={s.foot} aria-label={t('invest.mkt.sources.label')}>
        <p className={s.note}>{m.sample ? t('invest.mkt.sources.sample') : t('invest.mkt.sources')}</p>
        <p className={s.note}>{t('invest.mkt.disclaimer')}</p>
        <p className={s.body}>{t('invest.mkt.foot')}</p>
        <button type="button" className={s.btn} onClick={() => onTab?.('siguiendo')}>{t('invest.mkt.toList')}</button>
      </section>
    </div>
  )
}

export default function Market({ demo = false, onOpen, onTab, view = 'esencial' }) {
  const { t, lang } = useT()
  const m = useMarket({ demo, t })
  const [filter, setFilter] = useState('all')
  const [kind, setKindState] = useState(() => readArsKind(safeStore.get))
  const setKind = useCallback((k) => { setKindState(k); safeStore.set(ARS_KIND_KEY, k) }, [])
  // Reloj de la cabecera: el horario de la bolsa ("abre a las…") se recalcula
  // cada minuto aunque no lleguen datos nuevos.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])
  return <MarketView t={t} lang={lang} m={m} now={now} onOpen={onOpen} onTab={onTab} filter={filter} setFilter={setFilter} kind={kind} setKind={setKind} view={view} />
}
