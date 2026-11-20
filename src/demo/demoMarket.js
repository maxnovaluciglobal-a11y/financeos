// src/demo/demoMarket.js — datos de ejemplo de la pestaña Mercado en el demo.
// La API de Invest no acepta el origen del demo (403): todo esto es ficticio,
// determinista y se rotula "Datos de ejemplo". Coherente con demoInvestRows
// (Bitcoin a US$ 84.000, VOO a US$ 550 → S&P 500 cerca de 6.030 y SPY de 600;
// AAPL y MSFT publican resultados; BTC-USD no, es cripto; VOO es un ETF).
import { DEFAULT_USD_RATES } from '../pages/shared/constants.js'

const DAY = 86400000

// Generador determinista por texto (mismo patrón que sampleCandles).
function rng(text) {
  let seed = [...String(text)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) || 1
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }
}

export const DEMO_BAR = [
  { sym: '^GSPC', price: 6030.4, changePct: 0.0042 },
  { sym: '^DJI', price: 45210.8, changePct: 0.0031 },
  { sym: '^IXIC', price: 20480.2, changePct: 0.0068 },
  { sym: '^RUT', price: 2315.6, changePct: -0.0021 },
  { sym: 'CL=F', price: 61.24, changePct: -0.0115 },
  { sym: 'GC=F', price: 4052.3, changePct: 0.0054 },
  { sym: 'SI=F', price: 50.41, changePct: 0.0092 },
  { sym: 'EURUSD=X', price: 1.158, changePct: -0.0008 },
  { sym: '^TNX', price: 4.12, changePct: 0.0049 },
  { sym: 'BTC-USD', price: 84000, changePct: 0.0119 },
  { sym: '^VIX', price: 17.8, changePct: -0.034 },
]

export function demoMarketBar(now = Date.now()) {
  return { items: DEMO_BAR.map(it => ({ ...it, change: null, spark: [] })), missing: [], fetchedAt: now, sample: true }
}

// Cierres de un mes que terminan en el precio de la cinta y suben o bajan
// según el signo de su cambio del día (para que la flecha y la línea no se
// contradigan).
export function demoMonth(sym, n = 22) {
  const it = DEMO_BAR.find(x => x.sym === sym)
  if (!it) return null
  const r = rng(sym)
  const dir = it.changePct >= 0 ? 1 : -1
  const out = []
  let v = 1
  for (let i = 0; i < n; i++) { out.push(v); v *= 1 + dir * 0.002 + (r() - 0.5) * 0.012 }
  const k = it.price / out[out.length - 1]
  const closes = out.map(x => x * k)
  // Asegura la dirección del período.
  if ((closes[closes.length - 1] - closes[0]) * dir < 0) closes[0] = it.price * (1 - dir * 0.02)
  return closes
}

// Dos años de SPY (días hábiles) que terminan en 600 con tendencia alcista
// suave: SPY sobre su media de 200 días por más de 1 % y la de 50 sobre la de
// 200 → "Tendencia alcista".
export function demoSpyHistory(end = Date.UTC(2026, 10, 20), sessions = 504) {
  const r = rng('SPY')
  const rows = []
  let d = end
  while (rows.length < sessions) {
    const wd = new Date(d).getUTCDay()
    if (wd !== 0 && wd !== 6) rows.push({ ts: Math.floor(d / 1000), date: new Date(d).toISOString().slice(0, 10) })
    d -= DAY
  }
  rows.reverse()
  let v = 1
  for (let i = 0; i < rows.length; i++) {
    v *= 1 + 0.0006 + Math.sin(i / 9) * 0.003 + (r() - 0.5) * 0.006
    rows[i].close = v
  }
  const k = 600 / rows[rows.length - 1].close
  for (const row of rows) row.close = +(row.close * k).toFixed(2)
  return rows
}

// Próximos resultados: AAPL y MSFT (las acciones del portafolio de ejemplo).
export function demoEarnings(now = Date.now()) {
  const at = (days) => new Date(now + days * DAY).toISOString().slice(0, 10)
  return { AAPL: { nextDate: at(12), source: 'sample' }, MSFT: { nextDate: at(26), source: 'sample' }, VOO: { nextDate: null, source: 'sample' } }
}

// Titulares de ejemplo (textos en el idioma de la interfaz, sin enlace).
export const DEMO_NEWS = [
  { id: 'd1', cat: 'Fed', key: 'invest.mkt.demo.news.1', hoursAgo: 1 },
  { id: 'd2', cat: 'Earnings', key: 'invest.mkt.demo.news.2', hoursAgo: 3 },
  { id: 'd3', cat: 'IA & Tech', key: 'invest.mkt.demo.news.3', hoursAgo: 5 },
  { id: 'd4', cat: 'Macro', key: 'invest.mkt.demo.news.4', hoursAgo: 8 },
  { id: 'd5', cat: 'Geopolítica', key: 'invest.mkt.demo.news.5', hoursAgo: 14 },
  { id: 'd6', cat: 'Macro', key: 'invest.mkt.demo.news.6', hoursAgo: 30 },
]
export function demoNews(t) {
  return DEMO_NEWS.map(n => ({ id: n.id, cat: n.cat, title: t(n.key), titleKey: n.key, link: null, source: t('invest.mkt.demo.source'), sourceKey: 'invest.mkt.demo.source', hoursAgo: n.hoursAgo, sample: true }))
}

// Tipos de cambio de ejemplo: los de la app (DEFAULT_USD_RATES) y un MEP 5 %
// sobre el oficial.
export function demoFx() {
  const R = DEFAULT_USD_RATES
  return {
    latam: { rates: { CLP: R.CLP, MXN: R.MXN, COP: R.COP, ARS: R.ARS, PEN: R.PEN }, sources: { CLP: 'sample', MXN: 'sample', COP: 'sample', ARS: 'sample', PEN: 'sample' } },
    ars: { mep: { rate: Math.round(R.ARS * 1.05), date: null }, oficial: null },
  }
}
