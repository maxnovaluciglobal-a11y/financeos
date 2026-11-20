// Indicadores de Inversiones: mismas fórmulas que Invest. Los "Legacy" son
// copias literales de `TI` de invest-web/app/index.html y sirven de oráculo.
import { describe, it, expect } from 'vitest'
import {
  sma, ema, rsiSeries, lastRsi, rsiZone, macd, bollinger, atr, classifyTrend,
  dailyReturns, volatility, sharpe, pearson, alignedReturns, returnCorrelation, pairCorrelations, MIN_RETURNS,
} from './investIndicators.js'

var TI = {
  sma: function (p, n) { return p.map(function (_, i) { return i < n - 1 ? null : p.slice(i - n + 1, i + 1).reduce(function (a, b) { return a + b }, 0) / n }) },
  ema: function (p, n) { var k = 2 / (n + 1), r = [p[0]]; for (var i = 1; i < p.length; i++) r.push(p[i] * k + r[i - 1] * (1 - k)); return r },
  macd: function (p) { var e12 = this.ema(p, 12), e26 = this.ema(p, 26); var line = e12.map(function (v, i) { return v - e26[i] }); var sig = this.ema(line, 9); return { line: line, signal: sig, hist: line.map(function (v, i) { return v - sig[i] }) } },
  bb: function (p, n, m) { n = n || 20; m = m || 2; var s = this.sma(p, n); return p.map(function (_, i) { if (!s[i]) return { mid: null, upper: null, lower: null }; var sl = p.slice(Math.max(0, i - n + 1), i + 1); var avg = s[i]; var std = Math.sqrt(sl.reduce(function (a, v) { return a + (v - avg) * (v - avg) }, 0) / sl.length); return { mid: avg, upper: avg + m * std, lower: avg - m * std } }) },
  atr: function (highs, lows, closes, n) { n = n || 14; var tr = highs.map(function (h, i) { if (i === 0) return h - lows[i]; return Math.max(h - lows[i], Math.abs(h - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])) }); var result = new Array(n - 1).fill(null); var a0 = tr.slice(0, n).reduce(function (a, b) { return a + b }, 0) / n; result.push(a0); for (var i = n; i < tr.length; i++) { a0 = (a0 * (n - 1) + tr[i]) / n; result.push(a0) } return result },
}

// Serie determinista de 260 cierres con tendencia y ruido.
const closes = Array.from({ length: 260 }, (_, i) => 100 + i * 0.3 + 6 * Math.sin(i / 5) + 2 * Math.cos(i * 1.7))
const highs = closes.map((c, i) => c + 1 + (i % 3) * 0.4)
const lows = closes.map((c, i) => c - 1 - (i % 4) * 0.3)
const close = (a, b) => { expect(a.length).toBe(b.length); a.forEach((v, i) => (b[i] == null ? expect(v).toBeNull() : expect(v).toBeCloseTo(b[i], 9))) }

describe('medias, MACD, Bollinger y ATR (igual que TI de Invest)', () => {
  it('SMA 20/50/200', () => { for (const n of [20, 50, 200]) close(sma(closes, n), TI.sma(closes, n)) })
  it('EMA con semilla en el primer precio', () => {
    close(ema(closes, 12), TI.ema(closes, 12))
    expect(ema([10, 11], 3)).toEqual([10, 10.5])
  })
  it('MACD 12/26/9', () => {
    const a = macd(closes), b = TI.macd(closes)
    close(a.line, b.line); close(a.signal, b.signal); close(a.hist, b.hist)
  })
  it('Bollinger 20,2 con desvío poblacional', () => {
    const a = bollinger(closes), b = TI.bb(closes)
    close(a.map(x => x.mid), b.map(x => x.mid))
    close(a.map(x => x.upper), b.map(x => x.upper))
    close(a.map(x => x.lower), b.map(x => x.lower))
    expect(bollinger([1, 1, 1], 3)[2]).toEqual({ mid: 1, upper: 1, lower: 1 })
  })
  it('ATR 14: un valor por vela', () => {
    const a = atr(highs, lows, closes)
    close(a, TI.atr(highs, lows, closes))
    expect(a).toHaveLength(closes.length)
    expect(atr([2, 3], [1, 1], [1.5, 2])).toEqual([null, null])
  })
})

describe('RSI de Wilder (readings.js)', () => {
  it('los primeros 14 son null, nunca 50', () => {
    const r = rsiSeries(closes)
    expect(r.slice(0, 14).every(v => v === null)).toBe(true)
    expect(r[14]).not.toBeNull()
  })
  it('caso a mano: suba constante = 100; baja constante = 0', () => {
    const up = Array.from({ length: 20 }, (_, i) => i + 1)
    expect(lastRsi(up)).toBe(100)
    const down = up.slice().reverse()
    expect(lastRsi(down)).toBe(0)
  })
  it('promedio simple al inicio y suavizado de Wilder después', () => {
    const p = [44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46]
    let ag = 0, al = 0
    for (let i = 1; i <= 14; i++) { const d = p[i] - p[i - 1]; if (d > 0) ag += d; else al -= d }
    ag /= 14; al /= 14
    const r14 = 100 - 100 / (1 + ag / al)
    const d15 = p[15] - p[14]
    const ag2 = (ag * 13 + Math.max(d15, 0)) / 14, al2 = (al * 13 + Math.max(-d15, 0)) / 14
    const r = rsiSeries(p)
    expect(r[14]).toBeCloseTo(r14, 12)
    expect(r[15]).toBeCloseTo(100 - 100 / (1 + ag2 / al2), 12)
  })
  it('sin historia suficiente, null; zonas 70/30', () => {
    expect(lastRsi([1, 2, 3])).toBeNull()
    expect([rsiZone(70), rsiZone(30), rsiZone(50), rsiZone(null)]).toEqual(['high', 'low', 'mid', 'na'])
  })
})

describe('tendencia (readings.js)', () => {
  it('UP, DOWN, MIX y sin media de 200', () => {
    expect(classifyTrend(110, 100, 90)).toBe('UP')
    expect(classifyTrend(80, 100, 90)).toBe('DOWN')
    expect(classifyTrend(95, 100, 90)).toBe('MIX')
    expect(classifyTrend(105, 100, null)).toBe('UP')
    expect(classifyTrend(95, 100, undefined)).toBe('DOWN')
    expect(classifyTrend(null, 100, 90)).toBeNull()
  })
})

describe('volatilidad y Sharpe (Comparar)', () => {
  // Copia de Comparar: retornos en %, desvío poblacional, (media/desvío)·√252.
  function compLegacy(cl) {
    const rets = cl.slice(1).map((c, i) => (c - cl[i]) / cl[i] * 100)
    const m = rets.reduce((a, b) => a + b, 0) / (rets.length || 1)
    const vol = Math.sqrt(rets.reduce((a, r) => a + (r - m) * (r - m), 0) / (rets.length || 1))
    return { vol, sharpe: vol > 0 ? (m / vol) * Math.sqrt(252) : 0 }
  }
  it('mismos números que Comparar (volatilidad en fracción = % / 100)', () => {
    const r = dailyReturns(closes), L = compLegacy(closes)
    expect(volatility(r) * 100).toBeCloseTo(L.vol, 9)
    expect(sharpe(r)).toBeCloseTo(L.sharpe, 9)
  })
  it('precio plano: volatilidad 0 y Sharpe 0; sin datos, null', () => {
    const flat = dailyReturns([5, 5, 5, 5])
    expect(volatility(flat)).toBe(0)
    expect(sharpe(flat)).toBe(0)
    expect(volatility([0.1])).toBeNull()
    expect(sharpe([])).toBeNull()
  })
})

describe('correlación sobre retornos alineados por día (diversification.js, FIN-4)', () => {
  const DAY = 86400
  const hist = (vals, skip = []) => vals.map((c, i) => ({ ts: (20000 + i) * DAY + 3600, close: c })).filter((_, i) => !skip.includes(i))
  it('pearson: perfecta, inversa y sin varianza', () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 12)
    expect(pearson([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1, 12)
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull()
    expect(pearson([1], [1])).toBeNull()
  })
  it('alinea por día UTC: un feriado en un solo mercado no corre la serie', () => {
    const a = hist([10, 11, 12, 13]), b = hist([20, 22, 24, 26], [2])
    const { ra, rb } = alignedReturns(a, b)
    expect(ra).toHaveLength(2)
    expect(ra[1]).toBeCloseTo(13 / 11 - 1, 12)
    expect(rb[1]).toBeCloseTo(26 / 22 - 1, 12)
  })
  it(`con menos de ${MIN_RETURNS} retornos en común no hay dato`, () => {
    const a = hist(closes.slice(0, 15)), b = hist(closes.slice(0, 15))
    expect(returnCorrelation(a, b)).toBeNull()
    const c = hist(closes.slice(0, 40)), d = hist(closes.slice(0, 40).map(v => v * 2))
    expect(returnCorrelation(c, d)).toBeCloseTo(1, 9)
  })
  it('pairCorrelations: cada par distinto una vez, en orden', () => {
    const h = { A: hist(closes.slice(0, 40)), B: hist(closes.slice(0, 40)), C: hist(closes.slice(0, 10)) }
    expect(pairCorrelations(['A', 'B', 'C'], h).map(p => [p.a, p.b, p.r == null])).toEqual([['A', 'B', false], ['A', 'C', true], ['B', 'C', true]])
  })
})
