// src/utils/investIndicators.js — indicadores técnicos de Inversiones, lógica pura.
//
// Copia de las fórmulas de Invest para que las dos apps den el mismo número:
//  · sma, ema, macd, bb, atr: `TI` de invest-web/app/index.html (~2967).
//  · rsiSeries / lastRsi (RSI de Wilder) y classifyTrend: app/lib/readings.js.
//  · pearson, alignedReturns, returnCorrelation, pairCorrelations:
//    app/lib/diversification.js (FIN-4: sobre retornos diarios alineados por día).
//  · dailyReturns, volatility y sharpe: Comparar (index.html ~8162).
// Ningún indicador inventa un dato: sin historia suficiente devuelve null.

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

// Media simple de n: null en los primeros n−1 puntos.
export function sma(p, n) {
  const out = new Array((p || []).length).fill(null)
  if (!(n > 0)) return out
  let sum = 0
  for (let i = 0; i < p.length; i++) {
    sum += p[i]
    if (i >= n) sum -= p[i - n]
    if (i >= n - 1) out[i] = sum / n
  }
  return out
}

// Media exponencial de n: k = 2/(n+1), semilla = primer precio (como Invest).
export function ema(p, n) {
  if (!p || !p.length) return []
  const k = 2 / (n + 1)
  const r = [p[0]]
  for (let i = 1; i < p.length; i++) r.push(p[i] * k + r[i - 1] * (1 - k))
  return r
}

// RSI (14) de Wilder: promedio simple de las primeras n variaciones y después
// suavizado (prev·(n−1) + actual)/n. Los primeros n valores son null (nunca 50).
export function rsiSeries(closes, n = 14) {
  const p = closes || []
  const out = p.map(() => null)
  if (p.length < n + 1) return out
  let ag = 0, al = 0
  for (let i = 1; i <= n; i++) {
    const d = p[i] - p[i - 1]
    if (d > 0) ag += d; else al -= d
  }
  ag /= n; al /= n
  out[n] = al === 0 ? 100 : 100 - 100 / (1 + ag / al)
  for (let j = n + 1; j < p.length; j++) {
    const d = p[j] - p[j - 1]
    ag = (ag * (n - 1) + (d > 0 ? d : 0)) / n
    al = (al * (n - 1) + (d < 0 ? -d : 0)) / n
    out[j] = al === 0 ? 100 : 100 - 100 / (1 + ag / al)
  }
  return out
}
export function lastRsi(closes, n = 14) {
  const a = rsiSeries(closes, n)
  for (let i = a.length - 1; i >= 0; i--) if (isNum(a[i])) return a[i]
  return null
}
// Zonas de lectura (readings.js: rsiZone): ≥70 alta, ≤30 baja, resto neutral.
export function rsiZone(rsi) {
  if (!isNum(rsi)) return 'na'
  if (rsi >= 70) return 'high'
  if (rsi <= 30) return 'low'
  return 'mid'
}

// MACD (12, 26, 9): línea = EMA12 − EMA26, señal = EMA9 de la línea.
export function macd(p, fast = 12, slow = 26, signal = 9) {
  const e1 = ema(p, fast), e2 = ema(p, slow)
  const line = e1.map((v, i) => v - e2[i])
  const sig = ema(line, signal)
  return { line, signal: sig, hist: line.map((v, i) => v - sig[i]) }
}

// Bandas de Bollinger (20, 2): media simple ± m desvíos poblacionales.
export function bollinger(p, n = 20, m = 2) {
  const mid = sma(p, n)
  return (p || []).map((_, i) => {
    if (mid[i] == null) return { mid: null, upper: null, lower: null }
    const sl = p.slice(i - n + 1, i + 1)
    const avg = mid[i]
    const sd = Math.sqrt(sl.reduce((s, v) => s + (v - avg) * (v - avg), 0) / sl.length)
    return { mid: avg, upper: avg + m * sd, lower: avg - m * sd }
  })
}

// ATR (14) con true range clásico, un valor por vela (null hasta n−2).
export function atr(highs, lows, closes, n = 14) {
  const tr = (highs || []).map((h, i) => (i === 0 ? h - lows[i] : Math.max(h - lows[i], Math.abs(h - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]))))
  if (tr.length < n) return tr.map(() => null)
  const out = new Array(n - 1).fill(null)
  let a = tr.slice(0, n).reduce((s, v) => s + v, 0) / n
  out.push(a)
  for (let i = n; i < tr.length; i++) { a = (a * (n - 1) + tr[i]) / n; out.push(a) }
  return out
}

// Tendencia (readings.js): UP sobre la media de 50 y la de 200 (o solo la de
// 50 si no hay 200 días), DOWN bajo ambas, MIX entre medias.
export function classifyTrend(last, s50, s200) {
  if (!isNum(last) || !isNum(s50)) return null
  const above50 = last > s50
  if (!isNum(s200)) return above50 ? 'UP' : 'DOWN'
  const above200 = last > s200
  if (above50 && above200) return 'UP'
  if (!above50 && !above200) return 'DOWN'
  return 'MIX'
}

// Retornos simples diarios (fracción): (c_i − c_{i−1}) / c_{i−1}.
export function dailyReturns(closes) {
  const out = []
  for (let i = 1; i < (closes || []).length; i++) {
    const a = closes[i - 1], b = closes[i]
    if (a > 0 && isNum(b)) out.push((b - a) / a)
  }
  return out
}
const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1)

// Volatilidad diaria: desvío POBLACIONAL (÷ n) de los retornos, en la misma
// unidad que entran (Comparar de Invest los pasa en %, aquí en fracción).
export function volatility(returns) {
  if (!returns || returns.length < 2) return null
  const m = mean(returns)
  return Math.sqrt(returns.reduce((s, r) => s + (r - m) * (r - m), 0) / returns.length)
}

// Índice de Sharpe anualizado sin tasa libre de riesgo: (media / desvío)·√252,
// 0 si la volatilidad es 0 (como Invest).
export function sharpe(returns, periods = 252) {
  const vol = volatility(returns)
  if (vol == null) return null
  return vol > 0 ? (mean(returns) / vol) * Math.sqrt(periods) : 0
}

// ── Correlación (FIN-4) ───────────────────────────────────────────
export const MIN_RETURNS = 20

export function pearson(a, b) {
  const n = Math.min(a.length, b.length)
  if (n < 2) return null
  let ma = 0, mb = 0
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i] }
  ma /= n; mb /= n
  let num = 0, da = 0, db = 0
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma, y = b[i] - mb
    num += x * y; da += x * x; db += y * y
  }
  const den = Math.sqrt(da) * Math.sqrt(db)
  return den > 0 ? num / den : null
}

// Velas { ts (segundos), close } → cierre por día UTC.
function closesByDay(h) {
  const m = new Map()
  for (const d of h || []) {
    if (!d || !(d.close > 0) || !Number.isFinite(d.close) || !Number.isFinite(d.ts)) continue
    m.set(Math.floor(d.ts / 86400), d.close)
  }
  return m
}

export function alignedReturns(ha, hb) {
  const ma = closesByDay(ha), mb = closesByDay(hb)
  const days = [...ma.keys()].filter(k => mb.has(k)).sort((x, y) => x - y)
  const ra = [], rb = []
  for (let i = 1; i < days.length; i++) {
    ra.push(ma.get(days[i]) / ma.get(days[i - 1]) - 1)
    rb.push(mb.get(days[i]) / mb.get(days[i - 1]) - 1)
  }
  return { ra, rb }
}

export function returnCorrelation(ha, hb, minReturns = MIN_RETURNS) {
  const r = alignedReturns(ha, hb)
  if (r.ra.length < minReturns) return null
  return pearson(r.ra, r.rb)
}

export function pairCorrelations(tickers, histByTicker, minReturns = MIN_RETURNS) {
  const out = []
  for (let i = 0; i < tickers.length; i++) {
    for (let j = i + 1; j < tickers.length; j++) {
      out.push({ a: tickers[i], b: tickers[j], r: returnCorrelation(histByTicker[tickers[i]], histByTicker[tickers[j]], minReturns) })
    }
  }
  return out
}
