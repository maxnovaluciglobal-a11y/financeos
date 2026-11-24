// src/pages/Investments/market/useMarket.js — datos de la pestaña Mercado.
//
// Todo pasa por investApi (caché SOLO en memoria, un pedido por URL en vuelo):
//  · /api/marketbar: los 10 instrumentos + el VIX, en un solo pedido;
//  · /api/history SPY 2 años (la media de 200 días cubre el año del gráfico);
//  · sparklines mensuales: /api/history 1mo de cada instrumento, de a 3 y
//    después del primer pintado (una vez por sesión: caché de 5 min);
//  · /api/earnings por empresa (de a 4, máx. 15, sin cripto);
//  · /api/news SIN tickers (noticias del mercado general: los símbolos de la
//    persona no viajan en la URL, plan de Invest en moyiq, error "tickers en la
//    URL de noticias");
//  · /api/fx-latam y /api/fx-ars.
// Se refresca cada 5 min solo con la pestaña visible, y con el botón.
// En el demo, los mismos pedidos reales (demo/demoMarketApi.js) sobre el
// portafolio de ejemplo; cada pieza que no responde cae a su cifra de ejemplo
// y se rotula sola (`parts`). demoState() queda para las pruebas.
import { useCallback, useEffect, useRef, useState } from 'react'
import { investApi as defaultApi } from '../../../core/investApi.js'
import { investData as defaultData } from '../../../core/investData.js'
import { demoInvestRows } from '../../../demo/demoInvest.js'
import { demoEarnings, demoFx, demoMarketBar, demoMonth, demoNews, demoSpyHistory } from '../../../demo/demoMarket.js'
import { demoMarketApi, isSample } from '../../../demo/demoMarketApi.js'
import { MKT_SYMS, VIX_SYM, cleanNews, earningsUniverse, earningsWindow, monthCloses, runLimited, vixFromBar } from '../../../utils/investMarket.js'

export const REFRESH_MS = 5 * 60 * 1000

const idle = (fn) => {
  if (typeof window === 'undefined') return () => {}
  if (window.requestIdleCallback) { const id = window.requestIdleCallback(fn, { timeout: 1500 }); return () => window.cancelIdleCallback?.(id) }
  const id = setTimeout(fn, 300)
  return () => clearTimeout(id)
}
const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

export const INITIAL = {
  bar: { phase: 'loading', data: null, at: null },
  vix: null,
  spy: { phase: 'loading', rows: null },
  sparks: {},
  earn: { phase: 'loading', result: null, universe: null },
  news: { phase: 'loading', items: [] },
  fx: { phase: 'loading', latam: null, ars: null },
  // Qué piezas son cifras de ejemplo (demo sin respuesta de la API).
  parts: { bar: false, spy: false, earn: false, news: false, fx: false },
}
const ALL_SAMPLE = { bar: true, spy: true, earn: true, news: true, fx: true }

// El portafolio de ejemplo como fuente de posiciones (sin lista).
const ok = (data) => Promise.resolve({ ok: true, data })
export const demoMarketData = {
  listHoldings: () => ok(demoInvestRows().map(r => ({ t: r.t, type: r.type }))),
  listWatchlist: () => ok([]),
}

// Estado completo del demo (también lo usan las pruebas de la vista).
export function demoState(t = (k) => k, at = Date.now()) {
  const bar = demoMarketBar(at)
  const sparks = {}
  for (const s of MKT_SYMS) sparks[s.sym] = demoMonth(s.sym)
  const rows = demoInvestRows()
  const universe = earningsUniverse({ holdings: rows.map(r => ({ t: r.t, type: r.type })) })
  const ed = demoEarnings(at)
  const result = earningsWindow(universe.tickers.map(tk => ({ ticker: tk, data: ed[tk] || { nextDate: null, source: 'sample' } })), at)
  return {
    bar: { phase: 'ready', data: bar, at }, vix: vixFromBar(bar), spy: { phase: 'ready', rows: demoSpyHistory() }, sparks,
    earn: { phase: 'ready', result, universe }, news: { phase: 'ready', items: cleanNews(demoNews(t || ((k) => k))) },
    fx: { phase: 'ready', ...demoFx() },
    parts: ALL_SAMPLE,
  }
}

// ── Transiciones de estado (puras, se prueban sin DOM) ──
// Cinta: con algún precio > 0 queda lista; si no, conserva lo último ('stale')
// o queda en error. El VIX sale de la cinta o de su historia de 3 meses.
export function barState(prev, b, vix, at) {
  const ok = !!b && (b.items || []).some(x => x && x.price > 0)
  return {
    bar: ok ? { phase: 'ready', data: b, at: b.fetchedAt || at } : { phase: prev.bar.data ? 'stale' : 'error', data: prev.bar.data, at: prev.bar.at },
    vix: vix ?? prev.vix,
  }
}
export function newsState(prev, n) {
  const items = cleanNews(n?.items)
  return { news: items.length ? { phase: 'ready', items } : { phase: prev.news.items.length ? 'ready' : 'error', items: prev.news.items } }
}
export const spyState = (rows) => ({ spy: rows ? { phase: 'ready', rows } : { phase: 'error', rows: null } })
export const fxState = (latam, ars) => ({ fx: latam || ars ? { phase: 'ready', latam, ars } : { phase: 'error', latam: null, ars: null } })
export async function vixOf(api, b, { quick = false } = {}) {
  const ok = b && (b.items || []).some(x => x && x.price > 0)
  const v = ok ? vixFromBar(b) : null
  if (v != null || quick) return v
  const h = await api.history(VIX_SYM, '3mo', '1d')
  return h?.length ? h[h.length - 1].close : null
}
// Universo (portafolio + lista, en memoria) y fechas de resultados, de a 4.
// `fallback` (demo): si NINGUNA fecha respondió, todas salen del ejemplo; si
// respondió alguna, las que faltan cuentan como fallidas (como en la app).
export async function loadEarningsWith(api, data, at, { fallback = null } = {}) {
  let holdings = [], watch = []
  try {
    const [h, w] = await Promise.all([data.listHoldings(), data.listWatchlist()])
    if (h?.ok) holdings = h.data || []
    if (w?.ok) watch = w.data || []
  } catch { /* sin sesión o sin red: empresas de referencia */ }
  const universe = earningsUniverse({ holdings, watch })
  let replies = await runLimited(universe.tickers, 4, async (tk) => ({ ticker: tk, data: await api.earnings(tk) }))
  let sample = false
  if (fallback && replies.length && replies.every(r => !r.data || !r.data.source)) {
    replies = await Promise.all(universe.tickers.map(async (tk) => ({ ticker: tk, data: (await fallback(tk)) || { nextDate: null, source: 'sample' } })))
    sample = true
  }
  return { earn: { phase: 'ready', result: earningsWindow(replies, at()), universe }, sample }
}

const systemNow = () => Date.now()

export function useMarket({ demo = false, api: liveApi = defaultApi, data: liveData = defaultData, demoApi = demoMarketApi, now: nowProp = systemNow } = {}) {
  const api = demo ? demoApi : liveApi
  const data = demo ? demoMarketData : liveData
  // El reloj va por ref: una función nueva en cada render no debe rehacer los
  // loaders (eso relanzaría la carga en cada render).
  const nowRef = useRef(nowProp)
  useEffect(() => { nowRef.current = nowProp }, [nowProp])
  const now = useCallback(() => nowRef.current(), [])
  const [st, setSt] = useState(INITIAL)
  const [offline, setOffline] = useState(isOffline)
  const [refreshing, setRefreshing] = useState(false)
  const alive = useRef(true)
  const set = useCallback((patch) => { if (alive.current) setSt(s => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) })) }, [])

  const part = (k, v) => (s) => ({ parts: { ...s.parts, [k]: !!v } })
  // Minigráficos: en el demo, el de ejemplo solo acompaña a la cinta de
  // ejemplo (nunca una línea inventada junto a un precio real).
  const barSample = useRef(false)
  const loadSparks = useCallback(async () => {
    const todo = MKT_SYMS.map(s => s.sym)
    await runLimited(todo, 3, async (sym) => {
      const rows = await api.history(sym, '1mo', '1d')
      const c = monthCloses(rows) || (demo && barSample.current ? demoMonth(sym) : null)
      set(s => ({ sparks: { ...s.sparks, [sym]: c || null } }))
    })
  }, [api, demo, set])

  const loadEarnings = useCallback(async () => {
    const r = await loadEarningsWith(api, data, now, { fallback: demo ? (tk) => demoEarnings(now())[tk] || null : null })
    set(s => ({ earn: r.earn, ...part('earn', r.sample)(s) }))
  }, [api, data, demo, now, set])

  const loadLive = useCallback(async ({ quick = false } = {}) => {
    const bar = api.marketbar().then(async (b) => {
      const vix = await vixOf(api, b, { quick })
      if (demo) barSample.current = isSample(b)
      set(prev => ({ ...barState(prev, b, vix, now()), ...(b ? part('bar', isSample(b))(prev) : {}) }))
      // Cinta de ejemplo: sus minigráficos de ejemplo (los reales no llegaron).
      if (demo && isSample(b)) set(s => ({ sparks: Object.fromEntries(MKT_SYMS.map(x => [x.sym, s.sparks[x.sym] || demoMonth(x.sym)])) }))
    })
    const news = api.news().then(n => set(prev => ({ ...newsState(prev, n), ...(n ? part('news', isSample(n))(prev) : {}) })))
    if (quick) { await Promise.all([bar, news]); return }
    const spy = api.history('SPY', '2y', '1d').then(rows => set(s => ({ ...spyState(rows), ...part('spy', isSample(rows))(s) })))
    const fx = Promise.all([api.fxLatam(), api.fxArs()]).then(([latam, ars]) => {
      // Demo: si una de las dos fuentes cayó al ejemplo, la tabla entera es de
      // ejemplo (una sola fila de ejemplo entre tasas reales no se distingue).
      const sample = demo && (isSample(latam) || isSample(ars))
      if (sample) { const f = demoFx(); latam = f.latam; ars = f.ars }
      set(s => ({ ...fxState(latam, ars), ...part('fx', sample)(s) }))
    })
    await Promise.all([bar, news, spy, fx, loadEarnings()])
  }, [api, demo, loadEarnings, now, set])

  useEffect(() => {
    alive.current = true
    loadLive()
    const cancelIdle = idle(() => { loadSparks() })
    return () => { alive.current = false; cancelIdle() }
  }, [loadLive, loadSparks])

  // Refresco cada 5 min con la pestaña visible; al volver a la pestaña o a la
  // red, uno enseguida (la caché de investApi evita pedidos de más).
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const tick = () => { if (!document.hidden && !isOffline()) loadLive({ quick: true }) }
    const id = setInterval(tick, REFRESH_MS)
    const onVis = () => { if (!document.hidden) tick() }
    const onOnline = () => { setOffline(false); tick() }
    const onOffline = () => setOffline(true)
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [loadLive])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    api.forget('marketbar', 'news:', 'history:SPY:', 'history:^VIX:', 'fxLatam', 'fxArs')
    try { await loadLive() } finally { if (alive.current) setRefreshing(false) }
  }, [api, loadLive])

  // sample: alguna pieza es de ejemplo; demo: el portafolio es de ejemplo.
  return { ...st, offline, refreshing, refresh, demo, sample: Object.values(st.parts).some(Boolean) }
}
