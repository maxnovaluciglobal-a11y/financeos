// src/utils/investPositions.js — filas de Posiciones (F1), puro.
//
// Error de Invest corregido al pasarlo: su fila calculaba el resultado con el
// tipo de cambio de HOY y el total con el de la COMPRA (fx_at_cost), así que
// las filas no sumaban el total. Aquí cada fila usa las mismas reglas que
// portfolioTotals (utils/investValuation.js): costo al tipo de cambio de la
// compra si se conoce, valor al de hoy, y el pie es la suma de las filas.
// Una posición sin precio vale su costo al tipo de cambio de hoy; su
// "resultado" es solo el efecto cambiario (0 en USD), y así también suma.
//
// Riesgo al stop (invest-web/app/lib/risk.js: computeRiskAtStop): con stop
// propio, (precio − stop) × unidades; sin stop no suma y se cuenta. El stop se
// guarda en la moneda del activo y se compara en USD.
import { currencyOf, fxCostOf, rateOf } from './investValuation.js'

export const DEFAULT_LIMIT = 25
// Referencia estándar (risk.js) cuando la base no tiene la columna stop: −8 %.
export const DEFAULT_STOP_PCT = 0.08

// holdings: [{ id, t, type, sh, cost, stop, fxCost, note }] · quotes: { T: quote }
// rates: tasas reales (assetRates). limit: % de concentración (5–100).
// estimate: sin la columna stop, el riesgo se estima con −8 % (y se marca).
export function positionRows(holdings, quotes = {}, rates = {}, { limit = DEFAULT_LIMIT, estimate = false } = {}) {
  const rows = (holdings || []).map((h) => {
    const q = quotes[h.t] || null
    const ccy = currencyOf(h.t, q?.currency)
    const r = rateOf(ccy, rates)
    const px = q && q.price > 0 ? q.price : null
    const base = {
      id: h.id ?? null, t: h.t, type: h.type || 'Stock', sh: Number(h.sh) || 0, ccy, avgCost: Number(h.cost) || 0,
      price: px, stop: h.stop > 0 ? Number(h.stop) : null, fxCost: h.fxCost > 0 ? Number(h.fxCost) : null, note: h.note || '',
      name: q?.name || null, changePct: px ? (q.changePct || 0) : null, fx: r,
    }
    if (r == null) return { ...base, status: 'nofx', valueUsd: null, costUsd: null, plUsd: null, plPct: null, dayUsd: null, fxEffectUsd: null, riskUsd: null }
    const conv = (v) => (r === 1 ? v : v / r)
    const fc = r === 1 ? null : fxCostOf(h)
    const costUsd = fc ? (base.sh * base.avgCost) / fc : conv(base.sh * base.avgCost)
    const valueUsd = conv(base.sh * (px || base.avgCost))
    const fxEffectUsd = fc ? conv(base.sh * base.avgCost) - costUsd : 0
    const plUsd = valueUsd - costUsd
    const cp = px ? (q.changePct || 0) : 0
    const dayUsd = px ? conv(base.sh * (px - px / (1 + cp))) : null
    const priceNow = px || base.avgCost
    const stopUsed = base.stop != null ? base.stop : estimate ? priceNow * (1 - DEFAULT_STOP_PCT) : null
    const riskUsd = stopUsed != null ? Math.max(0, conv((priceNow - stopUsed) * base.sh)) : null
    return {
      ...base,
      status: px ? 'live' : 'cost',
      valueUsd, costUsd, plUsd, plPct: costUsd > 0 ? plUsd / costUsd : null,
      dayUsd, fxEffectUsd, riskUsd, riskEstimated: base.stop == null && estimate, priceUsd: base.sh > 0 ? valueUsd / base.sh : null,
    }
  })
  const counted = rows.filter(r => r.valueUsd != null)
  const value = counted.reduce((a, r) => a + r.valueUsd, 0)
  const cost = counted.reduce((a, r) => a + r.costUsd, 0)
  const day = counted.reduce((a, r) => a + (r.dayUsd || 0), 0)
  const risk = counted.reduce((a, r) => a + (r.riskUsd || 0), 0)
  // Peso por TICKER (los lotes del mismo ticker suman su peso, INV-N15).
  const byT = new Map()
  for (const r of counted) byT.set(r.t, (byT.get(r.t) || 0) + r.valueUsd)
  for (const r of rows) {
    r.weight = value > 0 && r.valueUsd != null ? r.valueUsd / value : null
    r.tickerWeight = value > 0 && r.valueUsd != null ? byT.get(r.t) / value : null
    r.overLimit = r.tickerWeight != null && r.tickerWeight * 100 > limit
  }
  const live = counted.filter(r => r.status === 'live')
  rows.sort((a, b) => (a.valueUsd == null) - (b.valueUsd == null) || (b.valueUsd ?? 0) - (a.valueUsd ?? 0))
  const top = [...byT.entries()].sort((a, b) => b[1] - a[1])[0] || null
  return {
    rows,
    totals: {
      value, cost, pl: value - cost, plPct: cost > 0 ? (value - cost) / cost : null,
      day, dayPct: value - day > 0 && live.length ? day / (value - day) : null,
      risk, noStop: estimate ? 0 : counted.filter(r => r.stop == null).length, estimated: estimate,
      fxEffect: counted.reduce((a, r) => a + (r.fxEffectUsd || 0), 0),
      fxKnown: counted.filter(r => r.fx !== 1 && r.fxCost != null).length,
      fxUnknown: counted.filter(r => r.fx !== 1 && r.fxCost == null).length,
      excluded: rows.filter(r => r.status === 'nofx').length,
      excludedCcys: [...new Set(rows.filter(r => r.status === 'nofx').map(r => r.ccy || '?'))],
      unpriced: counted.filter(r => r.status === 'cost').length,
      priced: live.length,
      top: top ? { t: top[0], weight: value > 0 ? top[1] / value : 0 } : null,
      limit,
    },
  }
}

// Con un capital de referencia, el riesgo se mide sobre él; si no, sobre el valor.
export function riskBase(capitalUsd, valueUsd) {
  return capitalUsd > 0 ? capitalUsd : valueUsd
}

// Cuántas unidades caben para no pasar el límite (risk.js: concentrationAlternative).
export function concentrationAlternative(priceUsd, units, totalUsd, limitPct) {
  if (!(priceUsd > 0) || !(totalUsd > 0) || !(limitPct > 0)) return null
  const maxUnits = Math.floor((totalUsd * (limitPct / 100)) / priceUsd)
  if (maxUnits >= units) return null
  return { units: maxUnits, weight: (maxUnits * priceUsd) / totalUsd }
}

// Reparto del valor por tipo (para la barra de diversificación).
export function allocation(rows) {
  const by = new Map()
  let total = 0
  for (const r of rows || []) {
    if (r.valueUsd == null) continue
    const k = ['Stock', 'ETF', 'Crypto'].includes(r.type) ? r.type : 'Otro'
    by.set(k, (by.get(k) || 0) + r.valueUsd)
    total += r.valueUsd
  }
  return [...by.entries()].map(([type, v]) => ({ type, valueUsd: v, share: total > 0 ? v / total : 0 })).sort((a, b) => b.valueUsd - a.valueUsd)
}

// Tickers por tipo de API para pedir cotizaciones (Crypto → CoinGecko).
export function quoteLists(holdings) {
  const stocks = new Set(), crypto = new Set()
  for (const h of holdings || []) (h.type === 'Crypto' ? crypto : stocks).add(h.t)
  return { stocks: [...stocks], crypto: [...crypto] }
}
