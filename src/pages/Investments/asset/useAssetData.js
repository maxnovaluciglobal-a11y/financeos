// Datos de la ficha. Todo vive en memoria del componente (y en la caché en
// memoria de investApi/investData): nada de la posición ni del ticker se
// guarda en el dispositivo. Cada pedido de mercado lleva SOLO el ticker de
// esta ficha (nunca la lista del portafolio).
//  · Al abrir: cotización, un año de velas (indicadores y rangos hasta 1A),
//    los lotes de este ticker y la lista (para "Seguir").
//  · Con el rango 3A: cinco años de velas.
//  · Al abrir Fundamentales: fundamentales y resultados trimestrales.
//  · Al abrir Noticias: titulares del ticker.
//  · Con posición (línea de arriba y Mi posición): peso en el portafolio,
//    efecto del tipo de cambio y límite de concentración.
// En el demo, la posición, la lista y los titulares del activo son de ejemplo
// (demo/demoInvestAsset.js); cotización, velas, fundamentales y resultados son
// reales (demo/demoMarketApi.js) y, si no responden, de ejemplo y rotulados
// (`sample` en cada estado).
import { useCallback, useEffect, useRef, useState } from 'react'
import { investApi } from '../../../core/investApi.js'
import { investData } from '../../../core/investData.js'
import { fetchPortfolioDetail } from '../../../core/investBridge.js'
import { demoInvestRows } from '../../../demo/demoInvest.js'
import { DEMO_WATCH, sampleEarnings, sampleNews } from '../../../demo/demoInvestAsset.js'
import { demoMarketApi, isSample, mergePrices } from '../../../demo/demoMarketApi.js'
import { RULE_DEFAULTS } from '../../../core/investData.js'
import { isCryptoTicker } from './format.js'

const READY = (data) => ({ phase: 'ready', data, sample: isSample(data) })
const LOADING = { phase: 'loading', data: null }
const IDLE = { phase: 'idle', data: null }

function demoLots(ticker) {
  return demoInvestRows().filter(r => r.t === ticker).map(r => ({ id: `demo-${r.t}`, t: r.t, type: r.type, sh: r.sh, cost: r.avgCost, stop: null, fxCost: null, note: '' }))
}

export function useAssetData(ticker, { demo = false, demoApi = demoMarketApi } = {}) {
  const api = demo ? demoApi : investApi
  const [quote, setQuote] = useState(LOADING)
  const [hist1y, setHist1y] = useState(LOADING)
  const [hist5y, setHist5y] = useState(IDLE)
  const [fund, setFund] = useState(IDLE)
  const [earn, setEarn] = useState(IDLE)
  const [news, setNews] = useState(IDLE)
  const [lots, setLots] = useState(LOADING)
  const [watch, setWatch] = useState(LOADING)
  const [weight, setWeight] = useState(IDLE)
  const [profile, setProfile] = useState(IDLE)
  const [cols, setCols] = useState({ stop: true, fx: true })
  const alive = useRef(0)

  const loadLots = useCallback(async (force = false) => {
    if (!ticker) return
    if (demo) { setLots(READY(demoLots(ticker))); return }
    const gen = alive.current
    const r = await investData.listHoldings({ force })
    if (gen !== alive.current) return
    if (!r.ok) { setLots({ phase: 'error', data: [], error: r.error }); return }
    setCols(investData.columns())
    setLots(READY(r.data.filter(h => h.t === ticker)))
  }, [ticker, demo])

  useEffect(() => {
    if (!ticker) return undefined
    const gen = ++alive.current
    const ok = () => gen === alive.current
    setQuote(LOADING); setHist1y(LOADING); setHist5y(IDLE); setFund(IDLE); setEarn(IDLE); setNews(IDLE)
    setLots(LOADING); setWatch(LOADING); setWeight(IDLE); setProfile(IDLE)
    ;(async () => {
      let q = await api.quote(ticker)
      if (!q && isCryptoTicker(ticker)) q = await api.quote(ticker.replace(/-USD$/, ''), { crypto: true })
      // Demo: antes que el ejemplo, la otra fuente real de cripto (CoinGecko).
      if (q?.sample && isCryptoTicker(ticker)) {
        const c = await api.quote(ticker, { crypto: true })
        if (c && !c.sample) q = c
      }
      if (ok()) setQuote(q ? READY(q) : { phase: 'none', data: null })
    })()
    api.history(ticker, '1y', '1d').then(rows => { if (ok()) setHist1y(rows ? READY(rows) : { phase: 'error', data: null }) })
    loadLots()
    if (demo) setWatch(READY(DEMO_WATCH))
    else investData.listWatchlist().then(r => { if (ok()) setWatch(r.ok ? READY(r.data) : { phase: 'error', data: [], error: r.error }) })
    const box = alive
    return () => { box.current = gen + 1 }
  }, [ticker, demo, api, loadLots])

  // Reintento del gráfico (la serie que falló: 1 o 5 años).
  const retryHistory = useCallback((long = false) => {
    if (!ticker) return
    if (long) { setHist5y(IDLE); return } // el rango 3A la vuelve a pedir
    const gen = alive.current
    setHist1y(LOADING)
    api.history(ticker, '1y', '1d').then(rows => { if (gen === alive.current) setHist1y(rows ? READY(rows) : { phase: 'error', data: null }) })
  }, [ticker, api])

  const need5y = useCallback(() => {
    if (!ticker || hist5y.phase !== 'idle') return
    const gen = alive.current
    setHist5y(LOADING)
    api.history(ticker, '5y', '1d').then(rows => { if (gen === alive.current) setHist5y(rows ? READY(rows) : { phase: 'error', data: null }) })
  }, [ticker, api, hist5y.phase])

  const needFund = useCallback((retry = false) => {
    if (!ticker || (!retry && fund.phase !== 'idle')) return
    const gen = alive.current
    setFund(LOADING); setEarn(LOADING)
    api.fundamentals([ticker]).then(m => { if (gen === alive.current) setFund(m ? READY(m[ticker] || null) : { phase: 'error', data: null }) })
    // Demo: si la API no trae resultados, los de ejemplo (rotulados).
    api.earnings(ticker).then(e => { if (gen === alive.current) setEarn(READY(e || (demo ? sampleEarnings(ticker) : null))) })
  }, [ticker, demo, api, fund.phase])

  const needNews = useCallback((retry = false) => {
    if (!ticker || (!retry && news.phase !== 'idle')) return
    if (demo) { setNews(READY({ items: sampleNews(ticker), sample: true })); return }
    const gen = alive.current
    setNews(LOADING)
    // Titulares de este activo: va SOLO este ticker, en el cuerpo de un POST
    // (investApi.news con tickers), nunca en la URL.
    investApi.news({ tickers: [ticker] }).then(d => { if (gen === alive.current) setNews(d ? READY(d) : { phase: 'error', data: null }) })
  }, [ticker, demo, news.phase])

  const needMine = useCallback(() => {
    if (!ticker || weight.phase !== 'idle') return
    if (demo) {
      // Peso con los mismos precios que el resto del demo (reales o, si no
      // responden, los de ejemplo de demoInvestRows).
      const rows = demoInvestRows()
      setWeight(LOADING)
      setProfile(READY({ limit: RULE_DEFAULTS.limit }))
      const gen = alive.current
      Promise.all([
        api.quotes(rows.filter(r => r.type !== 'Crypto').map(r => r.t)),
        api.crypto(rows.filter(r => r.type === 'Crypto').map(r => r.t)),
      ]).then(([a, b]) => {
        if (gen !== alive.current) return
        const q = mergePrices(a, b)
        const val = (r) => r.sh * (q[r.t]?.price > 0 ? q[r.t].price : r.price)
        const total = rows.reduce((s, r) => s + val(r), 0)
        const row = rows.find(r => r.t === ticker)
        setWeight(READY(row && total > 0 ? { weight: val(row) / total, valueUsd: val(row), fxEffectUsd: 0, nofx: false } : null))
      })
      return
    }
    const gen = alive.current
    setWeight(LOADING)
    fetchPortfolioDetail().then(({ rows }) => {
      if (gen !== alive.current) return
      const mine = rows.filter(r => r.t === ticker)
      const nofx = mine.some(r => r.status === 'nofx')
      const w = mine.reduce((a, r) => a + (r.weight || 0), 0)
      const usd = mine.reduce((a, r) => a + (r.valueUsd || 0), 0)
      // Efecto del tipo de cambio desde la compra (lo que mostraba la fila de
      // Portafolio al desplegarse): en US$, solo si se conoce.
      const fx = mine.reduce((a, r) => a + (r.fxEffectUsd || 0), 0)
      setWeight(READY(mine.length ? { weight: nofx ? null : w, valueUsd: nofx ? null : usd, fxEffectUsd: nofx ? null : fx, nofx } : null))
    }).catch(() => { if (gen === alive.current) setWeight({ phase: 'error', data: null }) })
    setProfile(LOADING)
    investData.getProfile().then(r => { if (gen === alive.current) setProfile(READY({ limit: r.ok ? r.data.rule.limit : RULE_DEFAULTS.limit })) })
  }, [ticker, demo, api, weight.phase])

  const refreshMine = useCallback(async () => {
    await loadLots(true)
    setWeight(IDLE)
  }, [loadLots])

  return { quote, hist1y, hist5y, fund, earn, news, lots, watch, setWatch, weight, profile, cols, need5y, needFund, needNews, needMine, refreshMine, retryHistory }
}
