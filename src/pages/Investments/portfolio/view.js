// src/pages/Investments/portfolio/view.js — lógica de pantalla de Portafolio
// (F1), pura: lo que las vistas necesitan calcular y conviene probar sin DOM.
import { DISPLAY_CCY } from '../../../utils/investValuation.js'
import { aporteHandoff, monthContributions } from '../../../utils/investNetWorth.js'
import { aportePending, flowUsd, opCcy, realizedSells, tradeStats, dividendsReceived } from '../../../utils/investLedger.js'
import { CASH_CCYS } from '../../../utils/investTrade.js'

export const DISPLAY_CCY_KEY = 'fos_invest_display_ccy'

// Moneda de las cifras: la elegida antes; si no, la de la persona en moyiq si
// Inversiones la sabe mostrar; si no, US$.
export function initialDisplayCcy(saved, userCcy) {
  if (DISPLAY_CCY.includes(saved)) return saved
  const u = String(userCcy || '').toUpperCase()
  return DISPLAY_CCY.includes(u) ? u : 'USD'
}

// Banda de Movimientos: resultado realizado (la MISMA cuenta que la tabla de
// costo promedio: realizedSells), invertido (compras) y dividendos cobrados,
// todo en USD. Invest mostraba esta banda siempre en USD y con un resultado
// distinto del de la tabla; aquí la pantalla lo pasa a la moneda elegida.
export function movementTotals(ops, ccyOf, toUsd) {
  let invested = 0, buys = 0, excluded = 0
  for (const o of ops || []) {
    if (o.type !== 'buy') continue
    const usd = flowUsd(o, opCcy(o, ccyOf), toUsd)
    if (usd == null) { excluded++; continue }
    invested += usd; buys++
  }
  const stats = tradeStats(realizedSells(ops, ccyOf), toUsd)
  const divs = dividendsReceived(ops, ccyOf, toUsd)
  return {
    invested, buys,
    realized: stats.n ? stats.total : null,
    sells: stats.n,
    dividends: divs.rows.reduce((a, r) => a + r.usd, 0),
    dividendPays: divs.rows.reduce((a, r) => a + r.n, 0),
    excluded: excluded + stats.excluded + divs.excluded,
    stats,
    divRows: divs.rows,
  }
}

// Puente desde los gastos de moyiq: lo marcado como inversión este mes que
// falta registrar como depósito (aportePending evita contarlo dos veces). En
// la moneda de la persona si el libro la maneja; si no, en US$ con la tasa
// con fecha de moyiq; sin ninguna, no se propone nada (no se inventa la tasa).
// → { amount, ccy, n, note } | null
export function aporteOffer({ expenses, setAsides = [], month, settings, rate, ops }) {
  const contrib = monthContributions(expenses, month, setAsides)
  const a = aporteHandoff(contrib, settings, rate)
  if (!a) return null
  const inBook = a.ccy && CASH_CCYS.includes(a.ccy)
  const pending = aportePending(inBook ? a : { amount: null, ccy: null, usd: a.usd }, ops, month)
  if (!pending || !(pending.amount > 0)) return null
  return { amount: pending.amount, ccy: pending.ccy, n: a.n }
}

// Las operaciones de la tabla, con los filtros de la pantalla.
export function tickersOf(ops, holdings = []) {
  return [...new Set([...(holdings || []).map(h => h.t), ...(ops || []).filter(o => o.ticker).map(o => o.ticker)])].sort()
}

// Lista de cifras de una barra mensual para el lector de pantalla.
export function monthsSummary(months, fmtMonth, fmtMoney) {
  return (months || []).filter(m => m.usd > 0).map(m => `${fmtMonth(m.ym)}: ${fmtMoney(m.usd)}`).join('; ')
}

// Riesgo al stop sobre el capital o sobre el valor.
export function riskShare(riskUsd, capitalUsd, valueUsd) {
  const base = capitalUsd > 0 ? capitalUsd : valueUsd
  return base > 0 ? { pct: riskUsd / base, onCapital: capitalUsd > 0 } : null
}

// Capital de referencia: lo disponible = capital − lo invertido (costo).
export function capitalLine(capitalUsd, costUsd) {
  if (!(capitalUsd > 0)) return null
  const free = capitalUsd - (costUsd || 0)
  return { capital: capitalUsd, free, over: free < 0 }
}

// Nombres de las fuentes de los precios que se muestran (INV-1: se atribuye
// solo lo que se usa; el ejemplo no se atribuye a nadie).
export function priceSources(rows, quotes, { demo = false } = {}) {
  if (demo) return { yahoo: false, coingecko: false }
  let yahoo = false, coingecko = false
  for (const r of rows || []) {
    if (!quotes?.[r.t]) continue
    if (r.type === 'Crypto') coingecko = true; else yahoo = true
  }
  return { yahoo, coingecko }
}

// Fuentes de los fundamentales (Dividendos): Finnhub y/o FMP.
export function fundamentalSources(fundamentals) {
  const out = new Set()
  for (const f of Object.values(fundamentals || {})) {
    const s = String(f?.source || '').toLowerCase()
    if (s.includes('finnhub')) out.add('Finnhub')
    else if (s.includes('fmp') || s.includes('financial modeling')) out.add('Financial Modeling Prep')
  }
  return [...out]
}
