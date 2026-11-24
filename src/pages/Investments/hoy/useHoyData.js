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
// Demo: las posiciones son las de ejemplo (demo/demoInvestHoy.js) y el resto
// sigue el mismo camino que la app, con datos reales de mercado
// (demo/demoMarketApi.js); lo que no responde cae al ejemplo y se rotula.
// "Ver con un ejemplo" (sin posiciones): todo de ejemplo, nada a la red.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { investApi } from '../../../core/investApi.js'
import { investData, RULE_DEFAULTS } from '../../../core/investData.js'
import { assetRates, currencyOf, readArsKind } from '../../../utils/investValuation.js'
import { STRIP_SYMS, historyPlan, historySymbol, runLimited } from '../../../utils/investHoy.js'
import { DEMO_CAPITAL, DEMO_WATCH, demoHistory, demoHoldings, demoHoyStore, demoMarket, demoOperations, demoQuotes } from '../../../demo/demoInvestHoy.js'
import { demoHoyApi, isSample } from '../../../demo/demoMarketApi.js'

const REFRESH_MS = 5 * 60 * 1000
const HISTORY_LIMIT = 4
const SPARK_LIMIT = 3
const readKey = (k) => { try { return localStorage.getItem(k) } catch { return null } }

// Minigráficos de la cinta: una vez por sesión de la página (memoria).
const sparkSession = new Map()

async function loadQuotes(holdings, api = investApi) {
  const crypto = holdings.filter(h => h.type === 'Crypto').map(h => h.t)
  const stocks = holdings.filter(h => h.type !== 'Crypto').map(h => h.t)
  const [a, b] = await Promise.all([
    stocks.length ? api.quotes(stocks) : {},
    crypto.length ? api.crypto(crypto) : {},
  ])
  return { ...a, ...b }
}

async function loadRates(holdings, quotes, api = investApi) {
  const latam = await api.fxLatam()
  const needsArs = holdings.some(h => currencyOf(h.t, quotes[h.t]?.currency) === 'ARS')
  const ars = needsArs ? await api.fxArs() : null
  const { rates } = assetRates(latam, ars, readArsKind(readKey))
  return { rates, latam }
}

const EMPTY = { phase: 'loading', error: null, holdings: [], quotes: {}, quotesFailed: false, rates: {}, latam: null, stopColumn: true, watch: [], capital: null, rule: RULE_DEFAULTS, ops: [], opsMissing: false, at: null }

export function useHoyData({ demo = false, sample = false, range = '1A', cmp = '', needFx = false, demoApi = demoHoyApi } = {}) {
  // fake: el portafolio es de ejemplo (no se guarda nada). pure: además, el
  // mercado también (el ejemplo que se pide sin posiciones).
  const fake = demo || sample
  const pure = sample && !demo
  const api = demo ? demoApi : investApi
  const store = useMemo(() => (demo ? demoHoyStore() : investData), [demo])
  const [base, setBase] = useState(EMPTY)
  const [hist, setHist] = useState({}) // 'SYM|range' → rows | null (falló)
  const [market, setMarket] = useState({ phase: 'loading', items: [], fetchedAt: null })
  const [sparks, setSparks] = useState(() => Object.fromEntries(sparkSession))
  const [retry, setRetry] = useState(0)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  // ── Base: posiciones + lo que no depende de ellas ──
  const loadBase = useCallback(async ({ force = false } = {}) => {
    if (pure) {
      setBase({ ...EMPTY, phase: 'ready', holdings: demoHoldings(), quotes: demoQuotes(), rates: {}, latam: null, stopColumn: true, watch: DEMO_WATCH, capital: DEMO_CAPITAL, rule: RULE_DEFAULTS, ops: demoOperations(), at: Date.now() })
      return
    }
    setBase(b => ({ ...b, phase: b.at ? 'refreshing' : 'loading', error: null }))
    const res = await store.listHoldings({ force })
    if (!alive.current) return
    if (!res.ok) { setBase(b => ({ ...b, phase: b.at ? 'stale' : 'error', error: res.error })); return }
    const holdings = res.data.filter(h => h.sh > 0)
    const [quotes, watchR, profR, opsR] = await Promise.all([
      holdings.length ? loadQuotes(holdings, api) : {},
      store.listWatchlist(),
      store.getProfile(),
      store.listOperations(),
    ])
    const { rates, latam } = holdings.length ? await loadRates(holdings, quotes, api) : { rates: {}, latam: null }
    if (!alive.current) return
    setBase({
      phase: 'ready', error: null, holdings, quotes,
      quotesFailed: holdings.length > 0 && Object.keys(quotes).length === 0,
      rates, latam,
      stopColumn: store.columns().stop,
      watch: watchR.ok ? watchR.data : [],
      capital: profR.ok ? profR.data.capital : null,
      rule: profR.ok ? profR.data.rule : RULE_DEFAULTS,
      ops: opsR.ok ? opsR.data : [],
      opsMissing: !opsR.ok,
      at: Date.now(),
    })
  }, [pure, store, api])

  useEffect(() => { loadBase() }, [loadBase])

  // Refresco de precios cada 5 min, solo con la pestaña visible (Invest: IX:8822).
  useEffect(() => {
    if (pure) return undefined
    let id = null
    const tick = async () => {
      if (document.visibilityState !== 'visible') return
      const holdings = base.holdings
      if (!holdings.length) return
      const quotes = await loadQuotes(holdings, api)
      if (alive.current && Object.keys(quotes).length) setBase(b => ({ ...b, quotes: { ...b.quotes, ...quotes }, quotesFailed: false, at: Date.now() }))
    }
    const start = () => { if (!id) id = setInterval(tick, REFRESH_MS) }
    const stop = () => { if (id) { clearInterval(id); id = null } }
    const onVis = () => { if (document.visibilityState === 'visible') { tick(); start() } else stop() }
    start()
    document.addEventListener('visibilitychange', onVis)
    return () => { stop(); document.removeEventListener('visibilitychange', onVis) }
  }, [pure, api, base.holdings])

  // Sin posiciones no se piden tipos de cambio; pero si hay aportes marcados en
  // moyiq en otra moneda, el aviso necesita la tasa para pasarlos a US$ (si
  // no, nunca se convierte 1:1). needFx lo decide la pantalla.
  useEffect(() => {
    if (fake || !needFx || base.phase !== 'ready' || base.holdings.length || base.latam) return undefined
    let ok = true
    Promise.resolve(investApi.fxLatam()).then(latam => {
      if (ok && alive.current && latam) setBase(b => (b.latam ? b : { ...b, latam }))
    }, () => { /* sin tasa: el aviso pide escribir el monto en US$ */ })
    return () => { ok = false }
  }, [fake, needFx, base.phase, base.holdings.length, base.latam])

  // ── Cinta y VIX ──
  useEffect(() => {
    if (pure) { setMarket({ phase: 'ready', ...demoMarket() }); return undefined }
    let ok = true
    api.marketbar().then(m => {
      if (!ok || !alive.current) return
      setMarket(m ? { phase: 'ready', items: m.items, fetchedAt: m.fetchedAt, sample: isSample(m) } : { phase: 'error', items: [], fetchedAt: null, sample: false })
    })
    return () => { ok = false }
  }, [pure, api])

  // Minigráficos de la cinta: después del primer pintado, una vez por sesión
  // (la cinta de ejemplo trae los suyos).
  useEffect(() => {
    if (pure || market.sample || market.phase !== 'ready') return undefined
    const todo = STRIP_SYMS.filter(s => !sparkSession.has(s) && market.items.some(it => it.sym === s && it.price != null))
    if (!todo.length) return undefined
    let ok = true
    const run = () => runLimited(todo.map(sym => async () => {
      const rows = await api.history(sym, '1mo', '1d')
      const closes = rows && !isSample(rows) ? rows.slice(-22).map(r => r.close) : null
      sparkSession.set(sym, closes)
      if (ok && alive.current) setSparks(s => ({ ...s, [sym]: closes }))
    }), SPARK_LIMIT, () => ok && alive.current)
    const idle = typeof requestIdleCallback === 'function' ? requestIdleCallback(run, { timeout: 1500 }) : setTimeout(run, 300)
    return () => {
      ok = false
      if (typeof cancelIdleCallback === 'function' && typeof requestIdleCallback === 'function') cancelIdleCallback(idle); else clearTimeout(idle)
    }
  }, [pure, api, market])

  // ── Historias agrupadas ──
  // Las monedas dependen de las cotizaciones, que cambian cada 5 min: con una
  // clave estable (lista ordenada) el plan no se rehace ni cancela la corrida
  // en curso si las monedas siguen siendo las mismas.
  const ccyKey = useMemo(() => {
    const out = new Set()
    for (const h of base.holdings) { const c = currencyOf(h.t, base.quotes[h.t]?.currency); if (c && c !== 'USD') out.add(c) }
    return [...out].sort().join(',')
  }, [base.holdings, base.quotes])
  const ccys = useMemo(() => (ccyKey ? ccyKey.split(',') : []), [ccyKey])
  const plan = useMemo(
    () => (base.phase === 'loading' || base.phase === 'error' ? [] : historyPlan({ holdings: base.holdings, watch: base.watch, ccys, range, cmp })),
    [base.phase, base.holdings, base.watch, ccys, range, cmp],
  )
  useEffect(() => {
    const todo = plan.filter(r => !(`${r.sym}|${r.range}` in hist))
    if (!todo.length) return undefined
    let ok = true
    if (pure) {
      const add = {}
      for (const r of todo) add[`${r.sym}|${r.range}`] = demoHistory(r.sym, r.range)
      setHist(h => ({ ...h, ...add }))
      return undefined
    }
    runLimited(todo.map(r => async () => {
      const rows = await api.history(r.sym, r.range, '1d')
      if (ok && alive.current) setHist(h => ({ ...h, [`${r.sym}|${r.range}`]: rows || null }))
    }), HISTORY_LIMIT, () => ok && alive.current)
    return () => { ok = false }
  // `hist` queda fuera a propósito: cada resultado nuevo no vuelve a planear.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, pure, api, retry])

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

  // Qué es de ejemplo: el portafolio (sample) y, pieza por pieza, el mercado.
  const quotesSample = pure || Object.values(base.quotes).some(q => q?.sample)
  const historySample = pure || Object.values(hist).some(isSample)
  return {
    ...base,
    sample: fake,
    quotesSample,
    historySample,
    market: pure ? { ...market, sample: true } : market,
    sparks: pure || market.sample ? Object.fromEntries((market.items || []).map(it => [it.sym, it.spark])) : sparks,
    historyOf,
    historySymbol,
    pendingHistory,
    reload: () => loadBase({ force: true }),
    retryHistory,
  }
}
