// src/demo/demoInvestAsset.js — datos de ejemplo de la ficha del activo en el
// demo. La ficha muestra datos reales (demo/demoMarketApi.js); esto es el
// respaldo de cada pieza si la API no responde, y la fuente de las pruebas.
// Todo es ficticio y la pantalla lo rotula "Datos de ejemplo". Coherente con
// demoInvestRows(): el último cierre de VOO, AAPL, BTC-USD y MSFT es su precio
// de ejemplo, y el cierre anterior da el mismo cambio del día.
import { demoInvestRows } from './demoInvest.js'

export const DEMO_END = Date.UTC(2026, 10, 20)
// Algo más de 3 años de días corridos: alcanza para el rango 3A (756 velas).
export const DEMO_DAYS = 1100

function rng(ticker) {
  let seed = [...String(ticker)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) || 1
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }
}

export function demoRow(ticker) {
  return demoInvestRows().find(r => r.t === String(ticker).toUpperCase()) || null
}

// Velas diarias deterministas por ticker, solo días hábiles (cripto también,
// para simplificar el ejemplo), con volumen.
export function sampleCandles(ticker, days = DEMO_DAYS, end = DEMO_END) {
  const rnd = rng(ticker)
  const out = []
  let px = 50 + rnd() * 250
  const baseVol = 2e6 + rnd() * 3e7
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end - i * 86400000)
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue
    const open = px
    const close = Math.max(1, open * (1 + (rnd() - 0.48) * 0.04))
    const high = Math.max(open, close) * (1 + rnd() * 0.012)
    const low = Math.min(open, close) * (1 - rnd() * 0.012)
    out.push({ date: d.toISOString().slice(0, 10), open, high, low, close, volume: Math.round(baseVol * (0.6 + rnd() * 0.8)) })
    px = close
  }
  const row = demoRow(ticker)
  if (!row || out.length < 2) return out
  // Ancla: todo hasta el penúltimo día se escala para que el cierre anterior
  // sea precio / (1 + cambio del día); la última vela va de ahí al precio.
  const prevTarget = row.price / (1 + row.dayPct)
  const k = prevTarget / out[out.length - 2].close
  for (let i = 0; i < out.length - 1; i++) {
    const c = out[i]
    out[i] = { ...c, open: c.open * k, high: c.high * k, low: c.low * k, close: c.close * k }
  }
  const last = out[out.length - 1]
  const open = prevTarget, close = row.price
  out[out.length - 1] = { ...last, open, close, high: Math.max(open, close) * 1.004, low: Math.min(open, close) * 0.996 }
  return out
}

// Cotización de ejemplo: la de demoInvestRows o la última vela.
export function sampleQuote(ticker) {
  const row = demoRow(ticker)
  const c = sampleCandles(ticker)
  const last = c[c.length - 1], prev = c[c.length - 2]
  const price = row ? row.price : last.close
  return {
    ticker: String(ticker).toUpperCase(), price, prevClose: prev.close, change: price - prev.close,
    changePct: row ? row.dayPct : last.close / prev.close - 1, currency: 'USD', name: row?.name || null,
    high52: null, low52: null, sample: true,
  }
}

// Fundamentales de ejemplo (redondos, ficticios). Cripto no tiene.
const FUND = {
  AAPL: { peRatio: 31.2, forwardPE: 28.4, eps: 6.41, priceToBook: 45.1, roe: 1.47, grossMargin: 0.46, netMargin: 0.24, revenueGrowth: 0.05, beta: 1.2, debtToEquity: 1.5, dividendYield: 0.005, marketCap: 3.0e12, sector: 'Technology', industry: 'Consumer Electronics', country: 'US' },
  MSFT: { peRatio: 33.5, forwardPE: 29.8, eps: 10.45, priceToBook: 10.6, roe: 0.33, grossMargin: 0.69, netMargin: 0.36, revenueGrowth: 0.15, beta: 0.9, debtToEquity: 0.3, dividendYield: 0.008, marketCap: 2.6e12, sector: 'Technology', industry: 'Software', country: 'US' },
  VOO: { peRatio: 24.0, forwardPE: null, eps: null, priceToBook: 4.5, roe: null, grossMargin: null, netMargin: null, revenueGrowth: null, beta: 1.0, debtToEquity: null, dividendYield: 0.013, marketCap: null, sector: 'ETF', industry: 'Large Blend', country: 'US' },
}
export function sampleFundamentals(ticker) {
  const f = FUND[String(ticker).toUpperCase()]
  return f ? { ...f, source: 'sample', fetchedAt: DEMO_END, sample: true } : null
}

export function sampleEarnings(ticker) {
  const t = String(ticker).toUpperCase()
  if (t !== 'AAPL' && t !== 'MSFT') return null
  const base = t === 'AAPL' ? 1.5 : 2.8
  const dates = ['2026-10-30', '2026-07-31', '2026-05-01', '2026-01-30']
  const beats = [true, true, false, true]
  return {
    ticker: t, nextDate: '2027-01-29', nextEpsEst: +(base * 1.12).toFixed(2), source: 'sample', sample: true,
    quarters: dates.map((date, i) => {
      const epsEst = +(base * (1 + (3 - i) * 0.03)).toFixed(2)
      return { date, epsEst, eps: +(epsEst * (beats[i] ? 1.04 : 0.97)).toFixed(2), beat: beats[i] }
    }),
  }
}

// Titulares de ejemplo, sin enlace (no existen) y sin fuente real.
export function sampleNews(ticker) {
  const t = String(ticker).toUpperCase()
  return [
    { id: `${t}-1`, title: `${t}: sample headline about the latest quarter`, tickers: [t], source: null, link: null, hoursAgo: 3, sample: true },
    { id: `${t}-2`, title: `Sample headline: what analysts watch in ${t}`, tickers: [t], source: null, link: null, hoursAgo: 20, sample: true },
  ]
}

// Lista de ejemplo del demo: el demo empieza siguiendo SPY, QQQ y NVDA (la
// misma lista en la ficha y en Siguiendo, demoInvestFollow.js).
export const DEMO_WATCH = ['SPY', 'QQQ', 'NVDA']
