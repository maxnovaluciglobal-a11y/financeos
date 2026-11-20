// src/utils/investRebalance.js — Objetivos y "Ajustes para llegar" (F1), puro.
//
// Copia de invest-web/app/lib/rebalance.js con sus reglas:
//  · los objetivos tienen que sumar 100 % (±0,5) antes de proponer ajustes;
//  · nada por debajo de US$10 (ni antes ni después de redondear unidades);
//  · acciones, ETF y bonos van en unidades enteras; cripto admite fracciones;
//  · nunca se propone vender más de lo que hay (Invest solo lo cuidaba con
//    unidades enteras; aquí también con fracciones).
// Todo en USD, sobre las posiciones con tipo de cambio (las demás no entran).
export const SUM_TOLERANCE = 0.5
export const MIN_TRADE_USD = 10
export const DRIFT_HINT_PTS = 2

// Una fila por ticker (los lotes del mismo ticker se suman, INV-N15).
// rows: positionRows(...).rows. → [{ t, type, sh, valueUsd, priceUsd }]
export function rebalanceBase(rows) {
  const by = new Map()
  for (const r of rows || []) {
    if (r.valueUsd == null) continue
    const b = by.get(r.t) || { t: r.t, type: r.type, sh: 0, valueUsd: 0, priceUsd: null }
    b.sh += Number(r.sh) || 0
    b.valueUsd += r.valueUsd
    by.set(r.t, b)
  }
  for (const b of by.values()) b.priceUsd = b.sh > 0 ? b.valueUsd / b.sh : null
  return [...by.values()].sort((a, b) => b.valueUsd - a.valueUsd)
}

// Pesos enteros que suman exactamente 100 (mayor resto).
export function roundTo100(values) {
  const total = values.reduce((s, v) => s + (v > 0 ? v : 0), 0)
  if (!(total > 0)) return values.map(() => 0)
  const exact = values.map(v => ((v > 0 ? v : 0) / total) * 100)
  const floors = exact.map(Math.floor)
  const rest = 100 - floors.reduce((s, v) => s + v, 0)
  const order = exact.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r || a.i - b.i)
  for (let k = 0; k < rest; k++) floors[order[k % order.length].i]++
  return floors
}

// Objetivos iniciales: los pesos actuales redondeados para sumar 100.
export function currentTargets(base) {
  const w = roundTo100((base || []).map(b => b.valueUsd))
  return Object.fromEntries((base || []).map((b, i) => [b.t, w[i]]))
}

// Suma SOLO de las posiciones actuales (los objetivos de un ticker vendido no cuentan).
export function sumTargets(base, targets) {
  return (base || []).reduce((s, b) => {
    const v = Number(targets?.[b.t])
    return s + (Number.isFinite(v) ? v : 0)
  }, 0)
}
export function targetsReady(sum) {
  return Math.abs(sum - 100) <= SUM_TOLERANCE
}

export function clampTarget(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n * 10) / 10))
}

const wholeType = (type) => type !== 'Crypto'

// → { status: 'empty'|'sum'|'aligned'|'trades', total, sum, trades: [{ t, buy, shares, usd, priceUsd }] }
export function rebalanceTrades(base, targets) {
  const list = base || []
  const total = list.reduce((a, b) => a + b.valueUsd, 0)
  const sum = sumTargets(list, targets)
  if (!list.length || !(total > 0)) return { status: 'empty', total, sum, trades: [] }
  if (!targetsReady(sum)) return { status: 'sum', total, sum, trades: [] }
  const trades = []
  for (const b of list) {
    const px = b.priceUsd
    if (!(px > 0)) continue
    let diff = (total * (Number(targets?.[b.t]) || 0)) / 100 - b.valueUsd
    if (Math.abs(diff) < MIN_TRADE_USD) continue
    let shares = diff / px
    if (wholeType(b.type)) shares = shares > 0 ? Math.floor(shares + 1e-9) : Math.ceil(shares - 1e-9)
    // Nunca vender más de lo que hay.
    if (shares < 0 && -shares > b.sh) shares = wholeType(b.type) ? -Math.floor(b.sh + 1e-9) : -b.sh
    if (shares === 0) continue
    diff = shares * px
    if (Math.abs(diff) < MIN_TRADE_USD) continue
    trades.push({ t: b.t, buy: diff > 0, shares, usd: diff, priceUsd: px })
  }
  return { status: trades.length ? 'trades' : 'aligned', total, sum, trades }
}

// Aviso de Posiciones: tickers que se desviaron más de DRIFT_HINT_PTS de su
// objetivo (solo si la persona definió objetivos). → { count, top: { t, pts } }
export function driftHint(base, targets) {
  if (!targets || !Object.keys(targets).length) return null
  const total = (base || []).reduce((a, b) => a + b.valueUsd, 0)
  if (!(total > 0)) return null
  const off = (base || []).map(b => ({ t: b.t, pts: (b.valueUsd / total) * 100 - (Number(targets[b.t]) || 0) }))
    .filter(x => Math.abs(x.pts) >= DRIFT_HINT_PTS)
    .sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts))
  return off.length ? { count: off.length, top: off[0] } : null
}
