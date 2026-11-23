// src/demo/demoInvestFollow.js — datos de ejemplo de Siguiendo (F4) en el demo.
// Usa las mismas velas y cotizaciones de ejemplo que la ficha del activo
// (demoInvestAsset.js), así la fila de Mi lista y la ficha dicen el mismo
// precio y el mismo RSI. Las alertas de ejemplo se arman sobre esos precios
// (una por encima, una por debajo y un movimiento del día ya avisado) y viven
// solo en memoria: nada se pide a la red ni se guarda.
import { DEMO_WATCH, sampleCandles, sampleQuote } from './demoInvestAsset.js'
import { roundLevel } from '../utils/investAlerts.js'

export { DEMO_WATCH }

export function demoFollowQuotes(tickers) {
  const out = {}
  for (const t of tickers || []) out[String(t).toUpperCase()] = sampleQuote(t)
  return out
}

// Un año de velas (la misma serie de la ficha).
export const demoFollowHistory = (t, range = '1y') => {
  const c = sampleCandles(t)
  const n = { '1mo': 23, '3mo': 66, '6mo': 130, '1y': 260, '5y': c.length }[range] || 260
  return c.slice(-n)
}

export function demoAlerts(now = Date.now()) {
  const [a, b, c] = [DEMO_WATCH[0] || 'SPY', DEMO_WATCH[1] || 'QQQ', DEMO_WATCH[2] || 'NVDA']
  const px = (t) => sampleQuote(t).price
  return [
    { id: 'demo-al-1', symbol: b, condition: 'above', threshold: roundLevel(px(b) * 1.05), active: true, lastTriggeredAt: null, createdAt: null },
    { id: 'demo-al-2', symbol: a, condition: 'below', threshold: roundLevel(px(a) * 0.95), active: true, lastTriggeredAt: null, createdAt: null },
    { id: 'demo-al-3', symbol: c, condition: 'pct_move', threshold: 3, active: true, lastTriggeredAt: new Date(now - 2 * 86400000).toISOString(), createdAt: null },
  ]
}
