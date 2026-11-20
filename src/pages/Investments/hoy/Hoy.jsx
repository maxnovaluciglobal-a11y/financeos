// src/pages/Investments/hoy/Hoy.jsx — pestaña Hoy de Inversiones (F2).
// Responde "¿cómo voy y cuánto arriesgo?", en el orden de renderDash de Invest:
// frescura de precios · cinta · aviso de aportes de moyiq · banda de valor ·
// Tu riesgo hoy · Para revisar hoy · Valor en el tiempo · avisos de tipo de
// cambio · tus 5 posiciones · efectivo y aportes · aporte del mes · régimen y VIX.
// Sin posiciones: estado vacío con 3 caminos (agregar, importar, ver un ejemplo).
// Las noticias, índices y próximos resultados viven en Mercado (otra fase); la
// línea de régimen lleva allá.
// Decisiones frente a Invest (no se portan): ?aporte=N al entrar
// (applyAporteParam) era el puente desde moyiq hacia otro sitio; acá el aporte
// pasa por memoria y un evento (aporteStore.js). El evento de analítica
// bridge_aporte tampoco: la política de privacidad dice que la app no registra
// eventos ni clics dentro de ella.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, ChevronRight, Clock, Equal, FileUp, FlaskConical, Minus, Plus, TrendingDown, TrendingUp, WifiOff } from 'lucide-react'
import Money, { useMoney } from '../../../components/Money.jsx'
import Sparkline from '../../../components/charts/Sparkline.jsx'
import { EmptyChoice, EmptyChoices } from '../../../components/ui/index.jsx'
import { useApp } from '../../../context/AppContext.jsx'
import { useT } from '../../../i18n/useT.js'
import { INVEST_ORIGIN } from '../../../core/investBridge.js'
import { cashBook } from '../../../utils/investCash.js'
import {
  VIX_SYM, STRIP_SYMS, aportePending, aporteUsd, buildSeries, computeRiskAtStop, fetchRangeOf, fxSymbol, heaviest,
  rebase, regimeOf, reviewToday, scoreCloses, sliceRange, stripFadeOf, stripFormat, summarizeFreshness, topPositions, validateAporte,
  vixLevel, withLivePoint, PVH_CMP, PVH_RANGES, REVIEW_MAX_CHIPS,
} from '../../../utils/investHoy.js'
import { convertHoldings, currencyOf, holdingRows, portfolioTotals, toUsd } from '../../../utils/investValuation.js'
import { monthContributions, resolveUserRate } from '../../../utils/investNetWorth.js'
import { currencySymbol, currentMonth, dateLocale, fmtAmount, fmtMoney, fmtPct, moneyLocale } from '../../../utils/index.js'
import { commitAporte, readAporte } from './aporteStore.js'
import ValueChart from './ValueChart.jsx'
import { useHoyData } from './useHoyData.js'
import s from './hoy.module.css'

const readKey = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const writeKey = (k, v) => { try { localStorage.setItem(k, v) } catch { /* modo privado: vale solo en esta visita */ } }
// Preferencias del gráfico: claves fos_* (de la cuenta, core/deviceOwner.js).
// Son el período y el índice elegidos, nunca tickers del portafolio.
const RANGE_KEY = 'fos_invest_pvh_range'
const CMP_KEY = 'fos_invest_pvh_cmp'

const dirOf = (n) => (n > 0 ? 'up' : n < 0 ? 'down' : 'flat')
const SIGN = (n) => (n < 0 ? '−' : n > 0 ? '+' : '')
function Arrow({ n, size = 12 }) {
  const d = dirOf(n)
  const Ic = d === 'up' ? ArrowUp : d === 'down' ? ArrowDown : Equal
  return <Ic size={size} strokeWidth={2.4} aria-hidden="true" />
}
const hhmm = (ms) => { try { return new Date(ms).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
const STRIP_KEY = { '^GSPC': 'gspc', '^DJI': 'dji', '^IXIC': 'ixic', '^RUT': 'rut', 'CL=F': 'oil', 'GC=F': 'gold', 'SI=F': 'silver', 'EURUSD=X': 'eurusd', '^TNX': 'tnx', 'BTC-USD': 'btc' }

// US$ con los separadores de la persona (investNetWorth.fmtUsd), con o sin centavos.
function usdFmt(currency) {
  const sym = currency === 'USD' ? currencySymbol('USD') : 'US$'
  const f = (n, signed = false, decimals = 2) => `${signed ? SIGN(n) : n < 0 ? '−' : ''}${sym}${fmtAmount(Math.abs(Number(n) || 0), decimals)}`
  return { money: (n, signed) => f(n, signed, 2), money0: (n, signed) => f(n, signed, 0) }
}

// ── Etiqueta de frescura ──────────────────────────────────────────
function Freshness({ sample, fresh, hasCrypto, hasStocks }) {
  const { t } = useT()
  let text, Ic = Clock
  if (sample) { text = t('invest.state.sample'); Ic = FlaskConical }
  else if (fresh.state === 'offline') { text = fresh.time ? t('invest.hoy.fresh.offline', { at: hhmm(fresh.time) }) : t('invest.state.offline'); Ic = WifiOff }
  else if (fresh.state === 'closed') text = t('invest.hoy.fresh.closed', { at: hhmm(fresh.time) })
  else if (fresh.state === 'live') text = t('invest.hoy.fresh.live', { at: hhmm(fresh.time) })
  else if (fresh.state === 'delayed') text = t('invest.hoy.fresh.delayed', { n: fresh.minutes, at: hhmm(fresh.time) })
  else if (fresh.state === 'unknown') text = fresh.time ? t('invest.hoy.fresh.unknownAt', { at: hhmm(fresh.time) }) : t('invest.hoy.fresh.unknown')
  else text = t('invest.hoy.fresh.loading')
  const src = [hasStocks && 'Yahoo Finance', hasCrypto && 'CoinGecko'].filter(Boolean).join(', ')
  return (
    <div className={s.freshRow}>
      <span className={s.fresh} role="status" aria-live="polite" data-state={sample ? 'sample' : fresh.state}><Ic size={14} strokeWidth={2} aria-hidden="true" />{text}</span>
      {!sample && src && <span className={s.muted}>{t('invest.hoy.fresh.source', { source: src })}</span>}
    </div>
  )
}

// ── Cinta de mercado ──────────────────────────────────────────────
function stripValue(sym, price) {
  const f = stripFormat(sym, price)
  const n = price.toLocaleString(moneyLocale(), { minimumFractionDigits: f.decimals, maximumFractionDigits: f.decimals })
  if (f.kind === 'yield') return `${n} %`
  if (f.kind === 'usd') return `${currencySymbol('USD')}${n}`
  return n
}
function Strip({ market, sparks, sample, onTab }) {
  const { t } = useT()
  const items = STRIP_SYMS.map(sym => (market.items || []).find(it => it.sym === sym)).filter(it => it && it.price != null)
  const ref = useRef(null)
  const [fade, setFade] = useState({ l: false, r: false })
  const syncFade = useCallback(() => {
    const next = stripFadeOf(ref.current)
    setFade(f => (f.l === next.l && f.r === next.r ? f : next))
  }, [])
  useEffect(() => {
    syncFade()
    if (typeof window === 'undefined') return undefined
    window.addEventListener('resize', syncFade)
    return () => window.removeEventListener('resize', syncFade)
  }, [syncFade, items.length])
  if (market.phase === 'loading') {
    return <div className={s.strip} aria-hidden="true">{STRIP_SYMS.slice(0, 5).map(k => <span key={k} className={`${s.stripItem} ${s.skeleton}`} />)}</div>
  }
  if (!items.length) return null
  return (
    <section className={s.stripWrap} aria-label={t('invest.hoy.strip.label')}>
      <ul ref={ref} className={s.strip} onScroll={syncFade} data-fade-l={fade.l || undefined} data-fade-r={fade.r || undefined}>
        {items.map(it => {
          const name = t(`invest.hoy.strip.sym.${STRIP_KEY[it.sym]}`)
          const value = stripValue(it.sym, it.price)
          const pct = fmtPct(it.changePct || 0, { signed: true, decimals: 2 })
          const sp = sparks?.[it.sym]
          return (
            <li key={it.sym}>
              <button type="button" className={s.stripItem} onClick={() => onTab('mercado')}
                aria-label={t('invest.hoy.strip.aria', { name, v: value, pct })}>
                <span className={s.stripName}>{name}</span>
                <span className={s.stripValue}>{value}</span>
                <span className={s.tone} data-tone={dirOf(it.changePct)}><Arrow n={it.changePct} />{pct}</span>
                {sp && sp.length > 1 ? <Sparkline values={sp} width={48} height={16} /> : <span className={s.sparkSlot} aria-hidden="true" />}
              </button>
            </li>
          )
        })}
      </ul>
      <p className={s.muted}>{sample ? t('invest.state.sample') : market.fetchedAt ? t('invest.hoy.strip.delay', { at: hhmm(Date.parse(market.fetchedAt) || market.fetchedAt) }) : t('invest.hoy.strip.delayNoTime')}</p>
    </section>
  )
}

// ── Aviso de aportes marcados en moyiq ────────────────────────────
function AporteBanner({ a, usd, pending, onGo, onClose, sym, noRate }) {
  const { t } = useT()
  const { m } = useMoney()
  const amount = m(fmtMoney(a.amount, sym))
  const approx = usd && a.ccy !== 'USD' ? ` (≈ ${m(`US$${fmtAmount(usd, 2)}`)})` : ''
  const done = pending && pending.amount <= 0.005
  return (
    <section className={s.banner} aria-labelledby="hoy-aporte-banner">
      <div>
        <h2 id="hoy-aporte-banner" className={s.bannerTitle}>{t('invest.hoy.aporteBanner.title')}</h2>
        <p className={s.bannerBody}>{t(a.n === 1 ? 'invest.hoy.aporteBanner.one' : 'invest.hoy.aporteBanner.many', { n: a.n, amount: amount + approx })}</p>
        <p className={s.bannerBody}>{done ? t('invest.hoy.aporteBanner.done') : t('invest.hoy.aporteBanner.next')}</p>
        {noRate && <p className={s.fieldErr} role="alert"><AlertTriangle size={14} aria-hidden="true" />{t('invest.hoy.aporteBanner.noRate', { ccy: noRate })}</p>}
      </div>
      <div className={s.bannerActs}>
        <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={onGo}>{t('invest.hoy.aporteBanner.go')}</button>
        <button type="button" className={s.btn} onClick={onClose}>{t('invest.hoy.aporteBanner.close')}</button>
      </div>
    </section>
  )
}

// ── Banda de valor ────────────────────────────────────────────────
function ValueBand({ T, local, money, priced }) {
  const { t } = useT()
  const sub = T.missing > 0
    ? t(T.missing === 1 ? 'invest.hoy.band.loadingOne' : 'invest.hoy.band.loadingMany', { n: T.missing })
    : local
  return (
    <section className={s.band} aria-labelledby="hoy-band-label">
      <span id="hoy-band-label" className={s.bandLabel}>{t('invest.hoy.band.label')}</span>
      <div className={s.bandValue}><Money>{money(T.value)}</Money></div>
      {sub && <div className={s.bandSub}>{sub}</div>}
      <dl className={s.bandRow}>
        <div>
          <dt>{t('invest.card.day')}</dt>
          <dd data-tone={priced ? dirOf(T.day) : 'flat'}>
            {priced ? <><Arrow n={T.day} /><Money>{money(T.day, true)}</Money> <span>{fmtPct(T.dayPct, { signed: true })}</span></> : '—'}
          </dd>
        </div>
        <div>
          <dt>{t('invest.hoy.band.unrealized')}</dt>
          <dd data-tone={dirOf(T.total)}>
            <Arrow n={T.total} /><Money>{money(T.total, true)}</Money> <span>{t('invest.hoy.band.onCost', { pct: fmtPct(T.totalPct, { signed: true }) })}</span>
          </dd>
        </div>
      </dl>
    </section>
  )
}

// ── Tu riesgo hoy ─────────────────────────────────────────────────
function RiskCard({ rs, limit, real, money, onTab }) {
  const { t } = useT()
  const top = heaviest(rs)
  const lim = fmtPct(limit, { decimals: 0 })
  return (
    <section className={s.card} aria-labelledby="hoy-risk-title">
      <div className={s.cardHead}>
        <h2 id="hoy-risk-title" className={s.cardTitle}>{t('invest.hoy.risk.title')}</h2>
        <button type="button" className={s.link} onClick={() => onTab('portafolio')}>{t('invest.hoy.risk.see')}<ChevronRight size={14} aria-hidden="true" /></button>
      </div>
      <p className={s.riskValue} data-tone={rs.totalRisk > 0 ? 'down' : 'flat'}><Money>{rs.totalRisk > 0 ? money(-rs.totalRisk, true) : money(0)}</Money></p>
      <p className={s.muted}>{t(rs.base === 'capital' ? 'invest.hoy.risk.pctCapital' : 'invest.hoy.risk.pctPortfolio', { pct: fmtPct(rs.totalRiskPct, { decimals: 1 }) })}</p>
      <ul className={s.riskList}>
        <li>{real
          ? (rs.noStopCount ? t(rs.noStopCount === 1 ? 'invest.hoy.risk.noStopOne' : 'invest.hoy.risk.noStopMany', { n: rs.noStopCount }) : t('invest.hoy.risk.allStops'))
          : t('invest.hoy.risk.estimated')}</li>
        {top && (
          <li>
            {t('invest.hoy.risk.top', { t: top.t, pct: fmtPct(top.weight, { decimals: 0 }) })}{' '}
            {top.overLimit
              ? <span className={s.warnTag}><AlertTriangle size={12} strokeWidth={2.4} aria-hidden="true" />{t('invest.hoy.risk.over', { lim })}</span>
              : <span className={s.muted}>{t('invest.hoy.risk.limit', { lim })}</span>}
          </li>
        )}
      </ul>
    </section>
  )
}

// ── Para revisar hoy ──────────────────────────────────────────────
function ReviewCard({ review, onOpen, onRetry, labelOf = (x) => x }) {
  const { t } = useT()
  const chips = (arr, rsi) => (
    <div className={s.chips}>
      {arr.slice(0, REVIEW_MAX_CHIPS).map(x => (
        <button key={x.t} type="button" className={s.chip} onClick={() => onOpen(x.t)} aria-label={t('invest.search.open', { t: labelOf(x.t) }) + (rsi ? `, RSI ${x.rsi}` : '')}>
          {labelOf(x.t)}{rsi && <span className={s.chipNum}> RSI {x.rsi}</span>}
        </button>
      ))}
    </div>
  )
  const n = (arr, one, many) => t(arr.length === 1 ? one : many, { n: arr.length })
  let body
  if (review.state === 'loading') body = <p className={s.muted} role="status"><span className={s.spinner} aria-hidden="true" />{t('invest.hoy.review.loading')}</p>
  else if (review.state === 'empty') body = <p className={s.text}>{t('invest.hoy.review.empty')}</p>
  else if (review.state === 'failed') {
    body = <><p className={s.text}>{t('invest.hoy.review.failed')}</p><button type="button" className={s.btn} onClick={onRetry}>{t('invest.card.retry')}</button></>
  } else if (!review.below.length && !review.belowShort.length && !review.rsiOut.length) body = <p className={s.text}>{t('invest.hoy.review.none')}</p>
  else {
    body = (
      <>
        {review.below.length > 0 && <div className={s.group}><p className={s.text}>{n(review.below, 'invest.hoy.review.belowOne', 'invest.hoy.review.belowMany')}</p>{chips(review.below)}</div>}
        {review.belowShort.length > 0 && <div className={s.group}><p className={s.text}>{n(review.belowShort, 'invest.hoy.review.shortOne', 'invest.hoy.review.shortMany')}</p>{chips(review.belowShort)}</div>}
        {review.rsiOut.length > 0 && <div className={s.group}><p className={s.text}>{n(review.rsiOut, 'invest.hoy.review.rsiOne', 'invest.hoy.review.rsiMany')}</p>{chips(review.rsiOut, true)}</div>}
      </>
    )
  }
  return (
    <section className={s.card} aria-labelledby="hoy-review-title">
      <div className={s.cardHead}><h2 id="hoy-review-title" className={s.cardTitle}>{t('invest.hoy.review.title')}</h2></div>
      {body}
      {review.state === 'ready' && review.failed.length > 0 && <p className={s.muted}>{t('invest.hoy.review.partial', { list: review.failed.map(labelOf).join(', ') })}</p>}
      <p className={s.muted}>{t('invest.hoy.review.foot')}</p>
    </section>
  )
}

// ── Tus posiciones (top 5) ────────────────────────────────────────
function TopPositions({ top, total, money, onOpen, onTab }) {
  const { t } = useT()
  const typeKey = (ty) => (['Stock', 'ETF', 'Crypto'].includes(ty) ? ty : 'Otro')
  return (
    <section className={s.card} aria-labelledby="hoy-top-title">
      <div className={s.cardHead}>
        <div>
          <h2 id="hoy-top-title" className={s.cardTitle}>{t('invest.port.holdings')}</h2>
          <p className={s.muted}>{total > top.length ? t('invest.hoy.top.sub', { n: total }) : t('invest.hoy.top.sorted')}</p>
        </div>
        <button type="button" className={s.link} onClick={() => onTab('portafolio')}>{t('invest.card.view')}<ChevronRight size={14} aria-hidden="true" /></button>
      </div>
      <ul className={s.topList}>
        {top.map((r, i) => {
          const rk = r.risk
          const riskText = !rk || rk.noStop ? t('invest.hoy.top.noStop') : `${money(-rk.riskAtStop, true)}${rk.stopIsDefault ? ` ${t('invest.hoy.top.est')}` : ''}`
          return (
            <li key={r.id ?? `${r.t}-${i}`}>
              <button type="button" className={s.topRow} onClick={() => onOpen(r.t)} aria-label={t('invest.search.open', { t: r.t })}>
                <span className={s.topMain}>
                  <span className={s.topTicker}>{r.t}</span>
                  <span className={s.muted}>{[r.name, t(`invest.type.${typeKey(r.type)}`)].filter(Boolean).join(' · ')}</span>
                </span>
                <span className={s.topCell}><span className={s.cellLabel}>{t('invest.detail.value')}</span><Money>{money(r.valueUsd)}</Money></span>
                <span className={s.topCell}>
                  <span className={s.cellLabel}>{t('invest.hoy.top.result')}</span>
                  {r.plUsd == null
                    ? <span className={s.muted}>{t('invest.port.atCost')}</span>
                    : <span className={s.tone} data-tone={dirOf(r.plUsd)}><Arrow n={r.plUsd} /><Money>{money(r.plUsd, true)}</Money> · {fmtPct(r.plPct, { signed: true })}</span>}
                </span>
                <span className={s.topCell}>
                  <span className={s.cellLabel}>{t('invest.hoy.top.weight')}</span>
                  {r.weight != null ? fmtPct(r.weight, { decimals: 0 }) : '—'}
                  {rk?.overLimit && <span className={s.warnTag}><AlertTriangle size={12} strokeWidth={2.4} aria-hidden="true" />{t('invest.hoy.top.over')}</span>}
                </span>
                <span className={s.topCell}>
                  <span className={s.cellLabel}>{t('invest.hoy.top.risk')}</span>
                  <span data-tone={rk && !rk.noStop && rk.riskAtStop > 0 ? 'down' : 'flat'} className={s.tone}><Money>{riskText}</Money></span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ── Efectivo y aportes ────────────────────────────────────────────
function CashBlock({ B, money, onTab }) {
  const { t } = useT()
  const r = B.returnPct
  const ccys = Object.keys(B.cashByCcy)
  const ccyLine = !ccys.length ? t('invest.hoy.cash.noMoves')
    : ccys.length === 1 && ccys[0] === 'USD' ? t('invest.hoy.cash.balance')
    : ccys.map(c => (c === '?' ? t('invest.hoy.cash.unknownCcy') : `${c} ${fmtAmount(B.cashByCcy[c], 2)}`)).join(' · ')
  const sub = []
  if (B.deposits || B.withdrawals) sub.push(t('invest.hoy.cash.depMinusWd'))
  if (B.implicit > 0) sub.push(t('invest.hoy.cash.outside'))
  if (B.opening > 0) sub.push(t(B.openingCount === 1 ? 'invest.hoy.cash.openingOne' : 'invest.hoy.cash.openingMany', { n: B.openingCount }))
  const excl = [...B.excludedCcys.map(c => (c === '?' ? t('invest.hoy.cash.unknownCcy') : c)), ...B.excludedPositions]
  const neg = ccys.filter(c => B.cashByCcy[c] < -0.005).map(c => (c === '?' ? t('invest.hoy.cash.unknownCcy') : c))
  return (
    <section className={s.card} aria-labelledby="hoy-cash-title">
      <div className={s.cardHead}>
        <h2 id="hoy-cash-title" className={s.cardTitle}>{t('invest.hoy.cash.title')}</h2>
        <button type="button" className={s.link} onClick={() => onTab('portafolio')}>{t('invest.hoy.cash.see')}<ChevronRight size={14} aria-hidden="true" /></button>
      </div>
      <dl className={s.cashGrid}>
        <div><dt>{t('invest.hoy.cash.cash')}</dt><dd data-tone={B.cash < 0 ? 'down' : 'flat'}><Money>{money(B.cash)}</Money></dd><dd className={s.muted}><Money>{ccyLine}</Money></dd></div>
        <div><dt>{t('invest.hoy.cash.contributed')}</dt><dd><Money>{money(B.contributed)}</Money></dd><dd className={s.muted}>{sub.length ? sub.join(' + ') : t('invest.hoy.cash.noContrib')}</dd></div>
        <div><dt>{t('invest.hoy.cash.value')}</dt><dd><Money>{money(B.value)}</Money></dd><dd className={s.muted}><Money>{t('invest.hoy.cash.valueSub', { v: money(B.positionsValue) })}</Money></dd></div>
        <div>
          <dt>{t('invest.hoy.cash.return')}</dt>
          <dd data-tone={r == null ? 'flat' : dirOf(r)} className={s.tone}>{r == null ? '—' : <><Arrow n={r} />{fmtPct(r, { signed: true })}</>}</dd>
          <dd className={s.muted}>{r != null ? <Money>{t('invest.hoy.cash.gain', { v: money(B.gain, true) })}</Money> : B.complete ? t('invest.hoy.cash.noContribYet') : t('invest.hoy.cash.missingFx')}</dd>
        </div>
      </dl>
      {(excl.length > 0 || B.excludedOps > 0) && <p className={s.note} role="note"><AlertTriangle size={14} aria-hidden="true" />{excl.length ? t('invest.hoy.cash.exclFor', { list: excl.join(', ') }) : t('invest.hoy.cash.excl')}</p>}
      {neg.length > 0 && <p className={s.note} role="note"><AlertTriangle size={14} aria-hidden="true" />{t('invest.hoy.cash.negative', { list: neg.join(', ') })}</p>}
      {B.orphans.map(o => (
        <p key={o.t} className={s.note} role="note"><AlertTriangle size={14} aria-hidden="true" />{t('invest.hoy.cash.orphan', { n: o.sh.toLocaleString(moneyLocale(), { maximumFractionDigits: 8 }), t: o.t })}</p>
      ))}
      {B.unpriced.length > 0 && <p className={s.note} role="note">{t('invest.hoy.cash.unpriced', { list: B.unpriced.join(', ') })}</p>}
    </section>
  )
}

// ── ¿Cuánto puedes aportar este mes? ─────────────────────────────
function AporteForm({ initial, hasMoyiq, onDone }) {
  const { t } = useT()
  const [value, setValue] = useState(initial ? String(initial) : '')
  const [err, setErr] = useState(null)
  useEffect(() => { if (initial) setValue(String(initial)) }, [initial])
  function submit(e) {
    e.preventDefault()
    const v = validateAporte(value)
    if (!v.ok) { setErr(v.error); document.getElementById('hoy-aporte-in')?.focus(); return }
    setErr(null)
    onDone(v.value)
  }
  return (
    <form className={s.card} noValidate onSubmit={submit} aria-labelledby="hoy-aporte-title">
      <h2 id="hoy-aporte-title" className={s.cardTitle}>{t('invest.hoy.aporte.title')}</h2>
      <p className={s.text}>{hasMoyiq ? t('invest.hoy.aporte.bodyMoyiq') : t('invest.hoy.aporte.body')}</p>
      <div className={s.formRow}>
        <label htmlFor="hoy-aporte-in" className="sr-only">{t('invest.hoy.aporte.label')}</label>
        <input id="hoy-aporte-in" className={s.input} type="text" inputMode="decimal" autoComplete="off"
          placeholder={t('invest.hoy.aporte.placeholder')} value={value}
          onChange={e => { setValue(e.target.value); if (err) setErr(null) }}
          aria-invalid={err ? 'true' : undefined} aria-describedby={err ? 'hoy-aporte-err' : undefined} />
        <button type="submit" className={`${s.btn} ${s.btnPrimary}`}>{t('invest.hoy.aporte.go')}</button>
      </div>
      {err && <p id="hoy-aporte-err" className={s.fieldErr} role="alert"><AlertTriangle size={14} aria-hidden="true" />{t(err === 'empty' ? 'invest.hoy.aporte.errEmpty' : 'invest.hoy.aporte.errInvalid')}</p>}
    </form>
  )
}

// ── Régimen y VIX ─────────────────────────────────────────────────
function ContextLine({ regime, vix, done, onTab }) {
  const { t } = useT()
  const RIc = regime?.regime === 'risk_on' ? TrendingUp : regime?.regime === 'risk_off' ? TrendingDown : Minus
  const level = vixLevel(vix)
  const parts = []
  if (regime) parts.push(<span key="r" className={s.ctxTag}><RIc size={14} strokeWidth={2.2} aria-hidden="true" />{t(`invest.hoy.ctx.regime.${regime.regime}`)}</span>)
  else if (done) parts.push(<span key="r" className={s.ctxTag}><AlertTriangle size={14} strokeWidth={2.2} aria-hidden="true" />{t('invest.hoy.ctx.regime.none')}</span>)
  if (level) parts.push(<span key="v">{t('invest.hoy.ctx.vix', { v: vix.toLocaleString(moneyLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }), level: t(`invest.hoy.ctx.vix.${level}`) })}</span>)
  return (
    <section className={s.ctx} aria-label={t('invest.hoy.ctx.label')}>
      <p className={s.ctxText} aria-live="polite">
        {parts.length ? parts : <span className={s.muted}>{done ? t('invest.hoy.ctx.none') : t('invest.hoy.ctx.loading')}</span>}
      </p>
      <button type="button" className={s.link} onClick={() => onTab('mercado')}>{t('invest.hoy.ctx.see')}<ChevronRight size={14} aria-hidden="true" /></button>
    </section>
  )
}

// ── Estado vacío ──────────────────────────────────────────────────
function EmptyHoy({ onAdd, onImport, onSample }) {
  const { t } = useT()
  return (
    <section className={s.empty} aria-labelledby="hoy-empty-title">
      <h2 id="hoy-empty-title" className={s.cardTitle}>{t('invest.hoy.empty.title')}</h2>
      <p className={s.text}>{t('invest.hoy.empty.body')}</p>
      <EmptyChoices label={t('invest.hoy.empty.label')}>
        <EmptyChoice icon={Plus} label={t('invest.port.addFirst')} sub={t('invest.hoy.empty.addSub')} onClick={onAdd} />
        <EmptyChoice icon={FileUp} label={t('invest.hoy.empty.import')} sub={t('invest.hoy.empty.importSub')} onClick={onImport} />
        <EmptyChoice icon={FlaskConical} label={t('invest.hoy.empty.sample')} sub={t('invest.hoy.empty.sampleSub')} onClick={onSample} />
      </EmptyChoices>
    </section>
  )
}

// ── Pantalla ──────────────────────────────────────────────────────
export { usdFmt, stripValue }

export default function Hoy({ demo = false, onOpen, onTab, useData = useHoyData }) {
  const [sample, setSample] = useState(false)
  // Al entrar o salir del ejemplo se monta de nuevo: nada del ejemplo se mezcla
  // con los datos reales (ni historias ni cinta).
  return <HoyView key={demo || sample ? 'sample' : 'live'} demo={demo} sample={sample} setSample={setSample} onOpen={onOpen} onTab={onTab} useData={useData} />
}

function HoyView({ demo, sample, setSample, onOpen, onTab, useData }) {
  const { t } = useT()
  const app = useApp() || {}
  const appSettings = app.settings
  const settings = useMemo(() => appSettings || {}, [appSettings])
  const currency = settings.currency
  const { money, money0 } = useMemo(() => usdFmt(currency), [currency])
  const [range, setRange] = useState(() => (PVH_RANGES.includes(readKey(RANGE_KEY)) ? readKey(RANGE_KEY) : '1A'))
  const [cmp, setCmp] = useState(() => (PVH_CMP.includes(readKey(CMP_KEY)) ? readKey(CMP_KEY) : ''))
  const [bannerOff, setBannerOff] = useState(false)
  const [noRate, setNoRate] = useState(null)
  // Aportes marcados en moyiq este mes (no dependen de Inversiones): si están
  // en otra moneda, Hoy necesita la tasa aunque no haya posiciones.
  const month = settings.activeMonth || currentMonth()
  const contrib = monthContributions(app.expenses, month)
  const ccy = String(currency || '').toUpperCase() || null
  const needFx = !(demo || sample) && contrib.count > 0 && contrib.sum > 0 && !!ccy && ccy !== 'USD'
  const d = useData({ demo, sample, range, cmp, needFx })
  const fake = d.sample

  const pickRange = (r) => { setRange(r); writeKey(RANGE_KEY, r) }
  const pickCmp = (c) => { setCmp(c); writeKey(CMP_KEY, c) }

  // ── Valuación (misma regla que Portafolio y la tarjeta de Panorama) ──
  const ccyOf = useCallback((tk) => currencyOf(tk, d.quotes[tk]?.currency), [d.quotes])
  const T = useMemo(() => portfolioTotals(d.holdings, tk => d.quotes[tk] || null, ccyOf, d.rates), [d.holdings, d.quotes, ccyOf, d.rates])
  const rows = useMemo(() => holdingRows(d.holdings, d.quotes, d.rates), [d.holdings, d.quotes, d.rates])
  const conv = useMemo(() => convertHoldings(d.holdings.map(h => ({ ...h, cur: d.quotes[h.t]?.price > 0 ? d.quotes[h.t].price : h.cost })), ccyOf, d.rates), [d.holdings, d.quotes, ccyOf, d.rates])
  const limit = (d.rule?.limit ?? 25) / 100
  const realStops = d.stopColumn !== false
  const rs = useMemo(() => computeRiskAtStop(conv.rows.map(h => ({ id: h.id, t: h.t, sh: h.sh, cur: h.cur, stop: h.stop })), d.capital > 0 ? d.capital : 0, limit, { estimateMissing: !realStops }), [conv.rows, d.capital, limit, realStops])
  const top = useMemo(() => topPositions(rows, rs), [rows, rs])

  // ── Frescura ──
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  const fresh = summarizeFreshness(Object.values(d.quotes), Date.now(), offline || d.quotesFailed)
  const hasCrypto = Object.values(d.quotes).some(q => q?.source === 'coingecko')
  const hasStocks = Object.values(d.quotes).some(q => q && q.source !== 'coingecko')

  // ── Moneda de la persona para el equivalente de la banda ──
  const userRate = useMemo(() => (fake ? resolveUserRate(settings, null, readKey) : resolveUserRate(settings, d.latam ? { rates: d.latam.rates, at: d.latam.updatedAt ? Date.parse(d.latam.updatedAt) : null } : null, readKey)), [fake, settings, d.latam])
  const sym = currencySymbol(settings.currency, settings.language)
  const local = currency && currency !== 'USD' && userRate?.rate > 0 ? `≈ ${fmtMoney(T.value * userRate.rate, sym)}` : t('invest.hoy.band.inUsd')

  // ── Para revisar hoy (posiciones + lista, cripto incluida) ──
  // La cripto se lee con su par en dólares (BTC → BTC-USD); el chip abre la
  // ficha con el ticker de la persona.
  const { holdings, watch, historyOf, historySymbol: symOf, rates, quotes } = d
  const reviewHoldings = useMemo(() => holdings.map(h => ({ t: symOf(h), own: h.t })), [holdings, symOf])
  const review = useMemo(() => {
    const scores = {}
    let pending = 0
    for (const tk of new Set([...reviewHoldings.map(h => h.t), ...watch])) {
      const rws = historyOf(tk, '1y')
      if (rws === undefined) { pending++; continue }
      scores[tk] = rws ? scoreCloses(rws.map(r => r.close)) : null
    }
    return reviewToday({ holdings: reviewHoldings, watch, scores, pending })
  }, [reviewHoldings, watch, historyOf])
  const ownTicker = useMemo(() => new Map(reviewHoldings.map(h => [h.t, h.own])), [reviewHoldings])
  const openReview = useCallback((sym) => onOpen?.(ownTicker.get(sym) || sym), [onOpen, ownTicker])

  // ── Valor en el tiempo ──
  const chart = useMemo(() => {
    const fr = fetchRangeOf(range)
    const pos = conv.rows.filter(h => h.sh > 0)
    const hists = {}, fxh = {}
    let waiting = false
    for (const h of pos) {
      const r = historyOf(symOf(h), fr)
      if (r === undefined) waiting = true
      else if (r) hists[h.t] = r
    }
    const ccys = [...new Set(pos.map(h => h.ccy).filter(c => c && c !== 'USD'))]
    for (const c of ccys) {
      const f = fxSymbol(c)
      const r = f ? historyOf(f.sym, fr) : null
      if (r === undefined) waiting = true
      else if (r) fxh[c] = f.mult === 1 ? r : r.map(x => ({ ...x, close: x.close * f.mult }))
    }
    // Hasta que no llegan TODAS las historias no se dibuja: con una serie
    // parcial el inicio se corre, la cifra parpadea y las que siguen cargando
    // aparecerían como "Sin historial en la fuente".
    if (waiting) return { state: 'loading' }
    const series = buildSeries(pos.map(h => ({ t: h.t, sh: h.sh, ccy: h.ccy })), hists, fxh, { fxNow: rates, weekdaysOnly: pos.some(h => h.type !== 'Crypto') })
    // Último punto con los precios de la banda (si todas las incluidas tienen precio).
    let live = 0, allPriced = true
    for (const tk of series.included) {
      const h = pos.find(x => x.t === tk)
      const q = quotes[tk]
      const v = q?.price > 0 ? toUsd(h.sh * q.price, h.ccy, rates) : null
      if (v == null) allPriced = false; else live += v
    }
    const full = allPriced ? withLivePoint(series.points, live) : series.points
    const pts = sliceRange(full, range)
    const ixRows = cmp ? historyOf(cmp, fr) : null
    const index = ixRows ? rebase(ixRows, pts) : null
    const invested = conv.rows.filter(h => series.included.includes(h.t)).reduce((a, h) => a + (h.costUsdBuy != null ? h.costUsdBuy : h.sh * h.cost), 0)
    const allFailed = !waiting && !series.points.length && pos.length > 0 && series.missing.length === pos.length
    return { state: pts.length >= 2 ? 'ready' : allFailed ? 'error' : waiting ? 'loading' : 'short', pts, index, invested, series, ixMissing: cmp && ixRows === null }
  }, [conv.rows, historyOf, symOf, rates, quotes, range, cmp])

  const chartNotes = []
  if (chart.state === 'ready' || chart.state === 'short') {
    chartNotes.push(t('invest.hoy.pvh.note.what'))
    chartNotes.push(fake ? t('invest.chart.sample') : t('invest.hoy.pvh.note.source'))
    chartNotes.push(t('invest.hoy.pvh.note.usd'))
    if (chart.series?.fxApprox?.length) chartNotes.push(t('invest.hoy.pvh.note.fxApprox', { list: chart.series.fxApprox.join(', ') }))
    if (chart.series?.missing?.length) chartNotes.push(t('invest.hoy.pvh.note.missing', { list: chart.series.missing.join(', ') }))
    if (cmp === 'ECH') chartNotes.push(t('invest.hoy.pvh.note.ech'))
    if (chart.ixMissing) chartNotes.push(t('invest.hoy.pvh.note.ixFail', { ix: t(`invest.hoy.pvh.cmp.${cmp}`) }))
    if (range === 'MAX' && chart.pts?.length) chartNotes.push(t('invest.hoy.pvh.note.max', { d: new Date(chart.pts[0].ts * 1000).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) }))
  }

  // ── Efectivo y aportes ──
  const B = useMemo(() => (d.opsMissing ? null : cashBook(d.ops, d.holdings, {
    ccyOf,
    priceOf: (tk) => (d.quotes[tk]?.price > 0 ? d.quotes[tk].price : null),
    toUsd: (v, c) => toUsd(v, c, d.rates),
  })), [d.ops, d.opsMissing, d.holdings, d.quotes, d.rates, ccyOf])

  // ── Aportes marcados en moyiq este mes ──
  const aporte = contrib.count > 0 && contrib.sum > 0
    ? { amount: Math.round(contrib.sum * 100) / 100, ccy, n: contrib.count, usd: ccy === 'USD' ? contrib.sum : userRate?.rate > 0 ? Math.round((contrib.sum / userRate.rate) * 100) / 100 : null }
    : null
  const aUsd = aporte ? aporteUsd(aporte) : null
  const pending = aporte ? aportePending(aporte, d.ops, month) : null
  const [saved] = useState(() => readAporte(readKey))
  const initialAporte = aUsd || saved || null

  // ── Régimen y VIX ──
  const spy = d.historyOf('SPY', '1y')
  const regime = spy ? regimeOf(spy.map(r => r.close)) : null
  const vixItem = (d.market.items || []).find(it => it.sym === VIX_SYM)
  const vix = vixItem?.price ?? null
  const ctxDone = spy !== undefined && d.market.phase !== 'loading'

  // Con monto en US$: se guarda (salvo en el ejemplo) y se va a Planificar.
  function goAporte(usd) {
    const r = commitAporte({ usd, ccy, sample: fake }, writeKey)
    if (!r.ok) return
    setNoRate(null)
    app.showToast?.(t('invest.hoy.aporte.toast', { v: money(r.usd) }))
    onTab('planificar')
  }
  // "Ir a Planificar" del aviso: sin tipo de cambio no convierte 1:1 ni usa un
  // monto guardado de otro mes. Avisa y lleva al formulario del aporte; si no
  // hay formulario (sin posiciones), abre Planificar sin monto.
  function goFromBanner() {
    const r = commitAporte({ usd: aUsd, ccy, sample: fake }, writeKey)
    if (r.ok) {
      setNoRate(null)
      app.showToast?.(t('invest.hoy.aporte.toast', { v: money(r.usd) }))
      onTab('planificar')
      return
    }
    const missing = r.noRate || ccy || '?'
    setNoRate(missing)
    const input = typeof document !== 'undefined' ? document.getElementById('hoy-aporte-in') : null
    if (input) { input.focus(); return }
    app.showToast?.(t('invest.hoy.aporteBanner.noRate', { ccy: missing }))
    onTab('planificar')
  }
  const intent = (what) => {
    try { window.dispatchEvent(new CustomEvent('fos:invest-intent', { detail: { intent: what } })) } catch { /* sin ventana (pruebas) */ }
    onTab('portafolio')
  }

  // ── Estados de carga y error ──
  if (d.phase === 'loading') return <p className={s.muted} role="status">{t('invest.card.loading')}</p>
  if (d.phase === 'error') {
    return (
      <div className={s.hoy}>
        <p className={s.text} role="alert">{offline ? t('invest.card.errorOffline') : t('invest.card.error')}</p>
        <button type="button" className={s.btn} onClick={d.reload}>{t('invest.card.retry')}</button>
      </div>
    )
  }

  const footer = (
    <div className={s.footer}>
      {fake && <p className={s.muted}>{t('invest.chart.sample')}</p>}
      <div className={s.links}>
        <a href={`${INVEST_ORIGIN}/datos-y-licencias.html`} target="_blank" rel="noopener noreferrer">{t('invest.card.sourcesLink')}</a>
        {!fake && hasCrypto && <a href="https://www.coingecko.com/en/api" target="_blank" rel="noopener noreferrer">Powered by CoinGecko API</a>}
      </div>
      <p className={s.muted}>{t('invest.privacy')}</p>
      <p className={s.muted}>{t('invest.legal')}</p>
    </div>
  )

  const banner = aporte && !bannerOff
    ? <AporteBanner a={aporte} usd={aUsd} pending={pending} sym={sym} noRate={noRate} onGo={goFromBanner} onClose={() => setBannerOff(true)} />
    : null

  if (!d.holdings.length) {
    return (
      <div className={s.hoy}>
        {banner}
        {B?.usesCash && <CashBlock B={B} money={money} onTab={onTab} />}
        <EmptyHoy onAdd={() => intent('add')} onImport={() => intent('import')} onSample={() => setSample(true)} />
        {footer}
      </div>
    )
  }

  return (
    <div className={s.hoy}>
      {sample && (
        <div className={s.sampleBar} role="note">
          <span><FlaskConical size={14} aria-hidden="true" />{t('invest.hoy.sample.note')}</span>
          <button type="button" className={s.btn} onClick={() => setSample(false)}>{t('invest.hoy.sample.exit')}</button>
        </div>
      )}
      <Freshness sample={fake} fresh={fresh} hasCrypto={hasCrypto} hasStocks={hasStocks} />
      <Strip market={d.market} sparks={d.sparks} sample={fake} onTab={onTab} />
      {banner}

      <div className={s.top}>
        <ValueBand T={T} local={local} money={money} priced={T.priced > 0} />
        <RiskCard rs={rs} limit={limit} real={realStops} money={money} onTab={onTab} />
        <ReviewCard review={review} onOpen={openReview} onRetry={d.retryHistory} labelOf={(x) => ownTicker.get(x) || x} />
      </div>

      <ValueChart points={chart.pts} index={chart.index} invested={chart.invested} range={range} cmp={cmp}
        onRange={pickRange} onCmp={pickCmp} state={chart.state} notes={chartNotes} money={money} money0={money0}
        onRetry={chart.state === 'error' || chart.state === 'short' ? d.retryHistory : null} />

      {conv.excluded.length > 0 && (
        <p className={s.note} role="note"><AlertTriangle size={14} aria-hidden="true" />
          {t(conv.excluded.length === 1 ? 'invest.hoy.fx.exclOne' : 'invest.hoy.fx.exclMany', { n: conv.excluded.length, list: [...new Set(conv.excluded.map(h => h.ccy || '?'))].join(', ') })}
        </p>
      )}
      {Math.abs(T.fxEffect) >= 0.5 && <p className={s.note} role="note"><Money>{t('invest.hoy.fx.effect', { v: money(T.fxEffect, true) })}</Money></p>}
      {T.fxUnknown > 0 && <p className={s.note} role="note">{t(T.fxUnknown === 1 ? 'invest.hoy.fx.unknownOne' : 'invest.hoy.fx.unknownMany', { n: T.fxUnknown })}</p>}

      <TopPositions top={top} total={rows.filter(r => r.valueUsd != null).length} money={money} onOpen={onOpen} onTab={onTab} />
      {B?.usesCash && <CashBlock B={B} money={money} onTab={onTab} />}
      <AporteForm initial={initialAporte} hasMoyiq={!!aUsd} onDone={goAporte} />
      <ContextLine regime={regime} vix={vix} done={ctxDone} onTab={onTab} />
      {footer}
    </div>
  )
}
