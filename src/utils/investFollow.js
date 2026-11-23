// src/utils/investFollow.js — pestaña Siguiendo de Inversiones (F4), lógica pura.
//
// Rehace la sección Lista de Invest (inventario 03-lista.md; app/index.html
// renderWatch 4379, renderScreenerSection 4514, renderCompSection 8103) con las
// mismas fórmulas (utils/investIndicators.js, utils/investAsset.js scoreAsset)
// para que Siguiendo, la ficha y Resumen digan el mismo RSI. Sin DOM, sin red y
// sin textos: cada lectura es una clave y sus números.
// Arreglos al portar (PLAN, "Errores de Invest que se corrigen"):
//  · Comparar "3A" pedía 5 años: aquí se piden 5 y se recortan a 3 años de calendario.
//  · Descubrir exportaba sin filtrar: el CSV lleva lo que se ve.
//  · Un RSI desconocido ya no pasa un filtro de RSI puesto a mano.
//  · Tope de 30 activos por análisis (el plan de Invest lo tenía y nunca lo usó).
import { cleanCandles, scoreAsset } from './investAsset.js'
import { dailyReturns, rsiZone, returnCorrelation, sharpe, volatility } from './investIndicators.js'
import { toCsv } from './csvSafe.js'

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const clamp01 = (v) => Math.max(0, Math.min(1, v))
export const TICKER_RE = /^[\^A-Z0-9.=-]{1,15}$/

// ── Mi lista ──────────────────────────────────────────────────────
export const TREND_FILTERS = ['all', 'UP', 'MIX', 'DOWN']

// Una fila: precio y día (de la cotización) y, con un año de velas, las lecturas.
export function followRow(ticker, quote = null, rows = null) {
  const t = String(ticker || '').toUpperCase()
  const sc = rows ? scoreAsset(rows) : null
  const price = Number(quote?.price) > 0 ? Number(quote.price) : sc?.last ?? null
  const hi = Number(quote?.high52) > 0 ? Number(quote.high52) : sc?.high52 ?? null
  const lo = Number(quote?.low52) > 0 ? Number(quote.low52) : sc?.low52 ?? null
  const range = price != null && hi != null && lo != null && hi > lo ? { pos: clamp01((price - lo) / (hi - lo)), lo, hi } : null
  const closes = rows ? cleanCandles(rows).map(c => c.close) : []
  const yearPct = closes.length >= 30 ? closes[closes.length - 1] / closes[Math.max(0, closes.length - 252)] - 1 : null
  return {
    t,
    name: quote?.name || null,
    ccy: quote?.currency || null,
    price,
    changePct: isNum(quote?.changePct) ? quote.changePct : null,
    scored: !!sc,
    trend: sc?.trend ?? null,
    rsi: sc?.rsi ?? null,
    rsiZone: rsiZone(sc?.rsi),
    macd: sc && isNum(sc.macdHist) ? { sign: sc.macdHist >= 0 ? 'pos' : 'neg', fading: isNum(sc.macdPrev) && Math.abs(sc.macdHist) < Math.abs(sc.macdPrev) } : null,
    // Volumen de hoy frente al promedio de 20 días, en fracción (+0,25 = 25 % más).
    vol: isNum(sc?.volRatio) ? sc.volRatio - 1 : null,
    range,
    vs200: sc && isNum(sc.s200) && sc.s200 > 0 ? (sc.last - sc.s200) / sc.s200 : null,
    s50: sc?.s50 ?? null,
    s200: sc?.s200 ?? null,
    atr: sc?.atr ?? null,
    yearPct,
  }
}

export function trendCounts(rows) {
  const out = { all: rows.length, UP: 0, MIX: 0, DOWN: 0 }
  for (const r of rows) if (r.trend && out[r.trend] != null) out[r.trend]++
  return out
}
export const byTrend = (rows, f) => (f && f !== 'all' ? rows.filter(r => r.trend === f) : rows)

// ── Descubrir ─────────────────────────────────────────────────────
// Listas curadas, iguales para todos (no son recomendaciones ni dependen del
// perfil). Las seis de Invest (SCR_PRESETS, :4490) más dividendos y bonos.
export const DISCOVER_LISTS = [
  { id: 'etfBroad', tickers: ['SPY', 'VOO', 'VTI', 'IVV', 'QQQ', 'VXUS', 'VEA', 'VWO'] },
  { id: 'dividends', tickers: ['SCHD', 'VYM', 'VIG', 'DGRO', 'HDV', 'DVY'] },
  { id: 'bonds', tickers: ['BND', 'AGG', 'TLT', 'IEF', 'SHY', 'BNDX'] },
  { id: 'usLarge', tickers: ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AMZN', 'AMD', 'TSLA', 'AVGO', 'CRM'] },
  { id: 'latamAdr', tickers: ['MELI', 'PBR', 'VALE', 'ITUB', 'BBD', 'SQM', 'CX', 'ERJ', 'BSAC', 'AMX'] },
  { id: 'brasil', tickers: ['ITUB4.SA', 'BBDC4.SA', 'VALE3.SA', 'PETR4.SA', 'ABEV3.SA', 'B3SA3.SA', 'WEGE3.SA'] },
  { id: 'mexico', tickers: ['AMXB.MX', 'WALMEX.MX', 'FEMSAUBD.MX', 'GFNORTEO.MX', 'CEMEXCPO.MX', 'BIMBOA.MX'] },
  { id: 'chile', tickers: ['SQM-B.SN', 'BCI.SN', 'FALABELLA.SN', 'COPEC.SN', 'ENELCHILE.SN', 'CCU.SN', 'CMPC.SN'] },
]
export const DISCOVER_MAX = 30
export const discoverList = (id) => DISCOVER_LISTS.find(l => l.id === id) || null

// Texto libre → tickers válidos, en mayúsculas, sin repetir, hasta `max`.
export function parseTickers(text, max = DISCOVER_MAX) {
  const out = []
  const bad = []
  for (const raw of String(text || '').split(/[\s,;]+/)) {
    const t = raw.toUpperCase().trim()
    if (!t) continue
    if (!TICKER_RE.test(t)) { if (!bad.includes(t)) bad.push(t); continue }
    if (!out.includes(t)) out.push(t)
  }
  return { tickers: out.slice(0, max), cut: Math.max(0, out.length - max), bad }
}

export const DEFAULT_FILTERS = { rsiMin: 0, rsiMax: 100, trend: 'all' }
export function normFilters(f = {}) {
  const n = (v, d) => (v === '' || v == null || !Number.isFinite(Number(v)) ? d : Number(v))
  const rsiMin = Math.max(0, Math.min(100, n(f.rsiMin, 0)))
  const rsiMax = Math.max(0, Math.min(100, n(f.rsiMax, 100)))
  return { rsiMin: Math.min(rsiMin, rsiMax), rsiMax: Math.max(rsiMin, rsiMax), trend: TREND_FILTERS.includes(f.trend) ? f.trend : 'all' }
}
export function applyFilters(rows, filters) {
  const f = normFilters(filters)
  const rsiSet = f.rsiMin > 0 || f.rsiMax < 100
  return rows.filter(r => {
    if (rsiSet && (r.rsi == null || r.rsi < f.rsiMin || r.rsi > f.rsiMax)) return false
    if (f.trend !== 'all' && r.trend !== f.trend) return false
    return true
  }).sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0))
}

// CSV de Descubrir (Invest exportScreenerCSV): lo que se ve, a prueba de fórmulas.
export function discoverCsv(rows, labels) {
  const r2 = (v) => (isNum(v) ? Math.round(v * 100) / 100 : '')
  return toCsv([
    [labels.ticker, labels.price, labels.trend, 'RSI 14', labels.sma50, labels.sma200, 'ATR 14', labels.year],
    ...rows.map(r => [r.t, r2(r.price), r.trend ? labels.trends[r.trend] : '', r.rsi ?? '', r2(r.s50), r2(r.s200), r2(r.atr), isNum(r.yearPct) ? r2(r.yearPct * 100) : '']),
  ])
}

// ── Comparar ──────────────────────────────────────────────────────
export const COMPARE_MAX = 4
export const COMPARE_MIN = 2
// months: período de calendario que se mira. range: lo que se pide a la API.
export const COMPARE_PERIODS = [
  { key: '1M', months: 1, range: '1mo' },
  { key: '3M', months: 3, range: '3mo' },
  { key: '6M', months: 6, range: '6mo' },
  { key: '1A', months: 12, range: '1y' },
  { key: '3A', months: 36, range: '5y' },
]
export const DEFAULT_COMPARE = { tickers: ['AAPL', 'MSFT'], period: '3M' }
export const periodOf = (k) => COMPARE_PERIODS.find(p => p.key === k) || COMPARE_PERIODS[1]
// Pares rápidos (Invest SUGS, :8122).
export const COMPARE_SUGGESTIONS = [
  { id: 'bigTech', tickers: ['AAPL', 'MSFT'] },
  { id: 'indexEtf', tickers: ['SPY', 'QQQ', 'IVV'] },
  { id: 'chips', tickers: ['NVDA', 'AMD'] },
  { id: 'ads', tickers: ['GOOGL', 'META'] },
  { id: 'holdingBank', tickers: ['BRK-B', 'JPM'] },
  { id: 'usWorld', tickers: ['VTI', 'VXUS'] },
]

// Agregar a la comparación: { ok, list } o { ok: false, error }.
export function addToCompare(list, ticker) {
  const t = String(ticker || '').toUpperCase().trim()
  if (!t) return { ok: false, error: 'empty' }
  if (!TICKER_RE.test(t)) return { ok: false, error: 'invalid' }
  if (list.includes(t)) return { ok: false, error: 'dup' }
  if (list.length >= COMPARE_MAX) return { ok: false, error: 'max' }
  return { ok: true, list: [...list, t] }
}
export function removeFromCompare(list, ticker) {
  if (list.length <= COMPARE_MIN) return { ok: false, error: 'min' }
  return { ok: true, list: list.filter(x => x !== ticker) }
}

const DAY = 86400
const withTs = (rows) => cleanCandles(rows).map(c => ({ ...c, ts: Math.floor(Date.parse(`${c.date}T00:00:00Z`) / 1000) }))

// Velas del período: desde la última fecha hacia atrás `months` meses de calendario.
export function slicePeriod(rows, months) {
  const c = withTs(rows)
  if (!c.length) return []
  const end = new Date(c[c.length - 1].ts * 1000)
  // El día se limita al último del mes destino: 31-mar − 1 mes = 28/29-feb, no 3-mar.
  const y = end.getUTCFullYear(), mo = end.getUTCMonth() - months
  const last = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate()
  const from = Date.UTC(y, mo, Math.min(end.getUTCDate(), last)) / 1000
  return c.filter(x => x.ts >= from - DAY / 2)
}

// "Cuánto se mueve", en palabras: volatilidad anual (desvío diario × √252).
export function moveBand(volYear) {
  if (!isNum(volYear)) return null
  return volYear < 0.15 ? 'low' : volYear < 0.3 ? 'mid' : 'high'
}
// Lectura de la correlación (Invest :8180): 1 igual, 0 independiente, −1 opuesto.
export function corrReading(r) {
  if (!isNum(r)) return 'na'
  return r > 0.7 ? 'same' : r > 0.4 ? 'similar' : r > -0.1 ? 'independent' : 'opposite'
}

// Medidas por activo y por par en el período. Una serie con 5 velas o menos no
// se dibuja ni entra en las medidas (Invest compMissing, :8211): nunca se inventa.
export function compareSet(tickers, histByTicker, periodKey) {
  const p = periodOf(periodKey)
  const series = {}, stats = {}, missing = []
  const sliced = {}
  for (const t of tickers) {
    const rows = slicePeriod(histByTicker[t], p.months)
    if (rows.length <= 5) { missing.push(t); continue }
    sliced[t] = rows
    const closes = rows.map(r => r.close)
    const base = closes[0]
    const pts = rows.map(r => ({ date: r.date, ts: r.ts, pct: r.close / base - 1 }))
    series[t] = pts
    const rets = dailyReturns(closes)
    const vol = volatility(rets)
    stats[t] = {
      ret: closes[closes.length - 1] / base - 1,
      vol,
      volYear: isNum(vol) ? vol * Math.sqrt(252) : null,
      move: moveBand(isNum(vol) ? vol * Math.sqrt(252) : null),
      sharpe: sharpe(rets),
      max: Math.max(...pts.map(x => x.pct)),
      min: Math.min(...pts.map(x => x.pct)),
      days: rows.length,
      from: rows[0].date,
      to: rows[rows.length - 1].date,
    }
  }
  const ok = tickers.filter(t => series[t])
  const pairs = []
  for (let i = 0; i < ok.length; i++) {
    for (let j = i + 1; j < ok.length; j++) {
      const r = returnCorrelation(sliced[ok[i]], sliced[ok[j]])
      pairs.push({ a: ok[i], b: ok[j], r, reading: corrReading(r) })
    }
  }
  // El que más rindió y el que menos se movió, para la frase de la vista esencial.
  const best = ok.length ? ok.reduce((m, t) => (stats[t].ret > stats[m].ret ? t : m), ok[0]) : null
  const calm = ok.filter(t => isNum(stats[t].volYear))
  const calmest = calm.length ? calm.reduce((m, t) => (stats[t].volYear < stats[m].volYear ? t : m), calm[0]) : null
  return { period: p.key, series, stats, pairs, missing, best, calmest }
}
