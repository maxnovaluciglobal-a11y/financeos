// src/pages/Investments/hoy/useHoyData.js — datos de la pestaña Hoy (F2).
//
// Todo en memoria, nunca en el dispositivo (posiciones, tickers, historias):
//  · posiciones, lista, capital, regla de riesgo y operaciones: core/investData.js
//    (RLS por auth.uid(); caché en memoria por cuenta);
//  · precios, tipos de cambio, cinta e historias: core/investApi.js (caché en
//    memoria, un pedido en vuelo por URL).
// Las historias se piden UNA vez por (símbolo, rango) con historyPlan y de a
// 4 en paralelo (runLimited): gráfico, "Para revisar hoy" y régimen usan las
// mismas. Los minigráficos de la cinta se piden después del primer pintado y
// una vez por sesión de la página (de a 3).
// Precios: se refrescan cada 5 minutos solo con la pestaña visible.
// Demo: nada sale a la red; todo viene de demo/demoInvestHoy.js.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { investApi } from '../../../core/investApi.js'
import { investData, RULE_DEFAULTS } from '../../../core/investData.js'
import { assetRates, currencyOf, readArsKind } from '../../../utils/investValuation.js'
import { STRIP_SYMS, historyPlan, historySymbol, runLimited } from '../../../utils/investHoy.js'
import { DEMO_CAPITAL, DEMO_WATCH, demoHistory, demoHoldings, demoMarket, demoOperations, demoQuotes } from '../../../demo/demoInvestHoy.js'

const REFRESH_MS = 5 * 60 * 1000
const HISTORY_LIMIT = 4
const SPARK_LIMIT = 3
const readKey = (k) => { try { return localStorage.getItem(k) } catch { return null } }

// Minigráficos de la cinta: una vez por sesión de la página (memoria).
const sparkSession = new Map()

async function loadQuotes(holdings) {
  const crypto = holdings.filter(h => h.type === 'Crypto').map(h => h.t)
  const stocks = holdings.filter(h => h.type !== 'Crypto').map(h => h.t)
  const [a, b] = await Promise.all([
    stocks.length ? investApi.quotes(stocks) : {},
    crypto.length ? investApi.crypto(crypto) : {},
  ])
  return { ...a, ...b }
}

async function loadRates(holdings, quotes) {
  const latam = await investApi.fxLatam()
  const needsArs = holdings.some(h => currencyOf(h.t, quotes[h.t]?.currency) === 'ARS')
  const ars = needsArs ? await investApi.fxArs() : null
  const { rates } = assetRates(latam, ars, readArsKind(readKey))
  return { rates, latam }
}

const EMPTY = { phase: 'loading', error: null, holdings: [], quotes: {}, quotesFailed: false, rates: {}, latam: null, stopColumn: true, watch: [], capital: null, rule: RULE_DEFAULTS, ops: [], opsMissing: false, at: null }

export function useHoyData({ demo = false, sample = false, range = '1A', cmp = '' } = {}) {
  const fake = demo || sample
  const [base, setBase] = useState(EMPTY)
  const [hist, setHist] = useState({}) // 'SYM|range' → rows | null (falló)
  const [market, setMarket] = useState({ phase: 'loading', items: [], fetchedAt: null })
  const [sparks, setSparks] = useState(() => Object.fromEntries(sparkSession))
  const [retry, setRetry] = useState(0)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  // ── Base: posiciones + lo que no depende de ellas ──
  const loadBase = useCallback(async ({ force = false } = {}) => {
    if (fake) {
      setBase({ ...EMPTY, phase: 'ready', holdings: demoHoldings(), quotes: demoQuotes(), rates: {}, latam: null, stopColumn: true, watch: DEMO_WATCH, capital: DEMO_CAPITAL, rule: RULE_DEFAULTS, ops: demoOperations(), at: Date.now() })
      return
    }
    setBase(b => ({ ...b, phase: b.at ? 'refreshing' : 'loading', error: null }))
    const res = await investData.listHoldings({ force })
    if (!alive.current) return
    if (!res.ok) { setBase(b => ({ ...b, phase: b.at ? 'stale' : 'error', error: res.error })); return }
    const holdings = res.data.filter(h => h.sh > 0)
    const [quotes, watchR, profR, opsR] = await Promise.all([
      holdings.length ? loadQuotes(holdings) : {},
      investData.listWatchlist(),
      investData.getProfile(),
      investData.listOperations(),
    ])
    const { rates, latam } = holdings.length ? await loadRates(holdings, quotes) : { rates: {}, latam: null }
    if (!alive.current) return
    setBase({
      phase: 'ready', error: null, holdings, quotes,
      quotesFailed: holdings.length > 0 && Object.keys(quotes).length === 0,
      rates, latam,
      stopColumn: investData.columns().stop,
      watch: watchR.ok ? watchR.data : [],
      capital: profR.ok ? profR.data.capital : null,
      rule: profR.ok ? profR.data.rule : RULE_DEFAULTS,
      ops: opsR.ok ? opsR.data : [],
      opsMissing: !opsR.ok,
      at: Date.now(),
    })
  }, [fake])

  useEffect(() => { loadBase() }, [loadBase])

  // Refresco de precios cada 5 min, solo con la pestaña visible (Invest: IX:8822).
  useEffect(() => {
    if (fake) return undefined
    let id = null
    const tick = async () => {
      if (document.visibilityState !== 'visible') return
      const holdings = base.holdings
      if (!holdings.length) return
      const quotes = await loadQuotes(holdings)
      if (alive.current && Object.keys(quotes).length) setBase(b => ({ ...b, quotes: { ...b.quotes, ...quotes }, quotesFailed: false, at: Date.now() }))
    }
    const start = () => { if (!id) id = setInterval(tick, REFRESH_MS) }
    const stop = () => { if (id) { clearInterval(id); id = null } }
    const onVis = () => { if (document.visibilityState === 'visible') { tick(); start() } else stop() }
    start()
    document.addEventListener('visibilitychange', onVis)
    return () => { stop(); document.removeEventListener('visibilitychange', onVis) }
  }, [fake, base.holdings])

  // ── Cinta y VIX ──
  useEffect(() => {
    if (fake) { setMarket({ phase: 'ready', ...demoMarket() }); return undefined }
    let ok = true
    investApi.marketbar().then(m => {
      if (!ok || !alive.current) return
      setMarket(m ? { phase: 'ready', items: m.items, fetchedAt: m.fetchedAt } : { phase: 'error', items: [], fetchedAt: null })
    })
    return () => { ok = false }
  }, [fake])

  // Minigráficos de la cinta: después del primer pintado, una vez por sesión.
  useEffect(() => {
    if (fake || market.phase !== 'ready') return undefined
    const todo = STRIP_SYMS.filter(s => !sparkSession.has(s) && market.items.some(it => it.sym === s && it.price != null))
    if (!todo.length) return undefined
    let ok = true
    const run = () => runLimited(todo.map(sym => async () => {
      const rows = await investApi.history(sym, '1mo', '1d')
      const closes = rows ? rows.slice(-22).map(r => r.close) : null
      sparkSession.set(sym, closes)
      if (ok && alive.current) setSparks(s => ({ ...s, [sym]: closes }))
    }), SPARK_LIMIT)
    const idle = typeof requestIdleCallback === 'function' ? requestIdleCallback(run, { timeout: 1500 }) : setTimeout(run, 300)
    return () => {
      ok = false
      if (typeof cancelIdleCallback === 'function' && typeof requestIdleCallback === 'function') cancelIdleCallback(idle); else clearTimeout(idle)
    }
  }, [fake, market])

  // ── Historias agrupadas ──
  const ccys = useMemo(() => {
    const out = new Set()
    for (const h of base.holdings) { const c = currencyOf(h.t, base.quotes[h.t]?.currency); if (c && c !== 'USD') out.add(c) }
    return [...out]
  }, [base.holdings, base.quotes])
  const plan = useMemo(
    () => (base.phase === 'loading' || base.phase === 'error' ? [] : historyPlan({ holdings: base.holdings, watch: base.watch, ccys, range, cmp })),
    [base.phase, base.holdings, base.watch, ccys, range, cmp],
  )
  useEffect(() => {
    const todo = plan.filter(r => !(`${r.sym}|${r.range}` in hist))
    if (!todo.length) return undefined
    let ok = true
    if (fake) {
      const add = {}
      for (const r of todo) add[`${r.sym}|${r.range}`] = demoHistory(r.sym, r.range)
      setHist(h => ({ ...h, ...add }))
      return undefined
    }
    runLimited(todo.map(r => async () => {
      const rows = await investApi.history(r.sym, r.range, '1d')
      if (ok && alive.current) setHist(h => ({ ...h, [`${r.sym}|${r.range}`]: rows || null }))
    }), HISTORY_LIMIT)
    return () => { ok = false }
  // `hist` queda fuera a propósito: cada resultado nuevo no vuelve a planear.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, fake, retry])

  const historyOf = useCallback((sym, r = '1y') => hist[`${sym}|${r}`], [hist])
  const pendingHistory = plan.filter(r => !(`${r.sym}|${r.range}` in hist)).length

  const retryHistory = useCallback(() => {
    setHist(h => {
      const next = { ...h }
      for (const k of Object.keys(next)) if (next[k] == null) delete next[k]
      return next
    })
    setRetry(n => n + 1)
  }, [])

  return {
    ...base,
    sample: fake,
    market,
    sparks: fake ? Object.fromEntries((market.items || []).map(it => [it.sym, it.spark])) : sparks,
    historyOf,
    historySymbol,
    pendingHistory,
    reload: () => loadBase({ force: true }),
    retryHistory,
  }
}
