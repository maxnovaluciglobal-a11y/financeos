// Datos de la ficha. Todo vive en memoria del componente (y en la caché en
// memoria de investApi/investData): nada de la posición ni del ticker se
// guarda en el dispositivo. Cada pedido de mercado lleva SOLO el ticker de
// esta ficha (nunca la lista del portafolio).
//  · Al abrir: cotización, un año de velas (indicadores y rangos hasta 1A),
//    los lotes de este ticker y la lista (para "Seguir").
//  · Con el rango 3A: cinco años de velas.
//  · Al abrir Fundamentales: fundamentales y resultados trimestrales.
//  · Al abrir Noticias: titulares del ticker.
//  · Al abrir Mi posición: peso en el portafolio y límite de concentración.
// En el demo, todo sale de demo/demoInvestAsset.js (la API no acepta su origen).
import { useCallback, useEffect, useRef, useState } from 'react'
import { investApi } from '../../../core/investApi.js'
import { investData } from '../../../core/investData.js'
import { fetchPortfolioDetail } from '../../../core/investBridge.js'
import { demoInvestRows } from '../../../demo/demoInvest.js'
import { DEMO_WATCH, sampleCandles, sampleEarnings, sampleFundamentals, sampleNews, sampleQuote } from '../../../demo/demoInvestAsset.js'
import { RULE_DEFAULTS } from '../../../core/investData.js'
import { isCryptoTicker } from './format.js'

const READY = (data) => ({ phase: 'ready', data })
const LOADING = { phase: 'loading', data: null }
const IDLE = { phase: 'idle', data: null }

function demoLots(ticker) {
  return demoInvestRows().filter(r => r.t === ticker).map(r => ({ id: `demo-${r.t}`, t: r.t, type: r.type, sh: r.sh, cost: r.avgCost, stop: null, fxCost: null, note: '' }))
}

export function useAssetData(ticker, { demo = false } = {}) {
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
    if (demo) {
      setQuote(READY(sampleQuote(ticker)))
      const c = sampleCandles(ticker)
      setHist1y(READY(c.slice(-252)))
      setLots(READY(demoLots(ticker)))
      setWatch(READY(DEMO_WATCH))
      return undefined
    }
    ;(async () => {
      let q = await investApi.quote(ticker)
      if (!q && isCryptoTicker(ticker)) q = await investApi.quote(ticker.replace(/-USD$/, ''), { crypto: true })
      if (ok()) setQuote(q ? READY(q) : { phase: 'none', data: null })
    })()
    investApi.history(ticker, '1y', '1d').then(rows => { if (ok()) setHist1y(rows ? READY(rows) : { phase: 'error', data: null }) })
    loadLots()
    investData.listWatchlist().then(r => { if (ok()) setWatch(r.ok ? READY(r.data) : { phase: 'error', data: [], error: r.error }) })
    const box = alive
    return () => { box.current = gen + 1 }
  }, [ticker, demo, loadLots])

  // Reintento del gráfico (la serie que falló: 1 o 5 años).
  const retryHistory = useCallback((long = false) => {
    if (!ticker || demo) return
    if (long) { setHist5y(IDLE); return } // el rango 3A la vuelve a pedir
    const gen = alive.current
    setHist1y(LOADING)
    investApi.history(ticker, '1y', '1d').then(rows => { if (gen === alive.current) setHist1y(rows ? READY(rows) : { phase: 'error', data: null }) })
  }, [ticker, demo])

  const need5y = useCallback(() => {
    if (!ticker || hist5y.phase !== 'idle') return
    if (demo) { setHist5y(READY(sampleCandles(ticker))); return }
    const gen = alive.current
    setHist5y(LOADING)
    investApi.history(ticker, '5y', '1d').then(rows => { if (gen === alive.current) setHist5y(rows ? READY(rows) : { phase: 'error', data: null }) })
  }, [ticker, demo, hist5y.phase])

  const needFund = useCallback((retry = false) => {
    if (!ticker || (!retry && fund.phase !== 'idle')) return
    if (demo) { setFund(READY(sampleFundamentals(ticker))); setEarn(READY(sampleEarnings(ticker))); return }
    const gen = alive.current
    setFund(LOADING); setEarn(LOADING)
    investApi.fundamentals([ticker]).then(m => { if (gen === alive.current) setFund(m ? READY(m[ticker] || null) : { phase: 'error', data: null }) })
    investApi.earnings(ticker).then(e => { if (gen === alive.current) setEarn(READY(e || null)) })
  }, [ticker, demo, fund.phase])

  const needNews = useCallback((retry = false) => {
    if (!ticker || (!retry && news.phase !== 'idle')) return
    if (demo) { setNews(READY({ items: sampleNews(ticker), sample: true })); return }
    const gen = alive.current
    setNews(LOADING)
    // /api/news exige tickers para traer titulares de un activo: va SOLO este.
    investApi.news({ tickers: [ticker] }).then(d => { if (gen === alive.current) setNews(d ? READY(d) : { phase: 'error', data: null }) })
  }, [ticker, demo, news.phase])

  const needMine = useCallback(() => {
    if (!ticker || weight.phase !== 'idle') return
    if (demo) {
      const row = demoInvestRows().find(r => r.t === ticker)
      setWeight(READY(row ? { weight: row.weight, valueUsd: row.valueUsd, nofx: false } : null))
      setProfile(READY({ limit: RULE_DEFAULTS.limit }))
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
      setWeight(READY(mine.length ? { weight: nofx ? null : w, valueUsd: nofx ? null : usd, nofx } : null))
    }).catch(() => { if (gen === alive.current) setWeight({ phase: 'error', data: null }) })
    setProfile(LOADING)
    investData.getProfile().then(r => { if (gen === alive.current) setProfile(READY({ limit: r.ok ? r.data.rule.limit : RULE_DEFAULTS.limit })) })
  }, [ticker, demo, weight.phase])

  const refreshMine = useCallback(async () => {
    await loadLots(true)
    setWeight(IDLE)
  }, [loadLots])

  return { quote, hist1y, hist5y, fund, earn, news, lots, watch, setWatch, weight, profile, cols, need5y, needFund, needNews, needMine, refreshMine, retryHistory }
}
