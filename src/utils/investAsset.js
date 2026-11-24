// src/utils/investAsset.js — ficha del activo de Inversiones (F3), lógica pura.
//
// Copia de lo que hace la ficha (drawer) de Invest (invest-web/app/index.html
// 7176-7553 y app/lib/readings.js, app/lib/market.js) para que las dos apps
// den el mismo número. Sin DOM, sin red y sin textos: cada lectura devuelve
// una clave y sus variables, y la pantalla las traduce (es/en/pt/de).
// Ningún cálculo inventa un dato: sin historia suficiente devuelve null.
import { sma, macd, bollinger, atr, lastRsi, rsiSeries, rsiZone, classifyTrend, dailyReturns, volatility, sharpe, returnCorrelation } from './investIndicators.js'

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const numOrNull = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))

// ── Rangos del gráfico (Invest: DRW_RANGES) ───────────────────────
// n = velas diarias visibles. Hasta 1 año sale de la serie de 1 año (la misma
// de los indicadores); 3 años pide la de 5 años.
export const ASSET_RANGES = [
  { key: '1M', n: 21 },
  { key: '3M', n: 63 },
  { key: '6M', n: 126 },
  { key: '1A', n: 252 },
  { key: '3A', n: 756 },
]
export const DEFAULT_RANGE = '6M'
export const ASSET_TABS = ['ind', 'fund', 'mine', 'news']
export const rangeOf = (key) => ASSET_RANGES.find(r => r.key === key) || ASSET_RANGES.find(r => r.key === DEFAULT_RANGE)
export const historyRangeFor = (key) => (rangeOf(key).n > 252 ? '5y' : '1y')

// Pestañas visibles: "Mi posición" solo con unidades (Invest: own.length).
export function visibleTabs(hasPosition) {
  return ASSET_TABS.filter(t => t !== 'mine' || hasPosition)
}
export function pickTab(want, hasPosition) {
  const tabs = visibleTabs(hasPosition)
  return tabs.includes(want) ? want : 'ind'
}

// Velas limpias y en orden: fecha AAAA-MM-DD única, OHLC > 0.
export function cleanCandles(rows) {
  const seen = new Set()
  return (rows || [])
    .filter(c => c && /^\d{4}-\d{2}-\d{2}$/.test(String(c.date)) && [c.open, c.high, c.low, c.close].every(v => Number(v) > 0))
    .map(c => ({ date: c.date, open: +c.open, high: +c.high, low: +c.low, close: +c.close, volume: numOrNull(c.volume) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .filter(c => (seen.has(c.date) ? false : seen.add(c.date)))
}

// Datos del gráfico: los indicadores se calculan sobre la serie COMPLETA y
// después se recorta el rango visible (como Invest), así la media de 200 del
// primer día visible no arranca vacía. La de 200 solo con 200 cierres o más.
export function chartData(rows, n) {
  const full = cleanCandles(rows)
  const closes = full.map(c => c.close)
  const from = Math.max(0, full.length - Math.max(1, n | 0))
  const s20 = sma(closes, 20), s50 = sma(closes, 50)
  const s200 = closes.length >= 200 ? sma(closes, 200) : null
  const bb = bollinger(closes, 20, 2)
  const rsi = rsiSeries(closes, 14)
  const md = macd(closes)
  const line = (arr) => (arr ? full.slice(from).map((c, i) => ({ time: c.date, value: arr[from + i] })).filter(p => isNum(p.value)) : [])
  return {
    candles: full.slice(from),
    sma20: line(s20),
    sma50: line(s50),
    sma200: line(s200),
    bbUpper: line(bb.map(b => b.upper)),
    bbLower: line(bb.map(b => b.lower)),
    volume: full.slice(from).filter(c => isNum(c.volume) && c.volume > 0).map(c => ({ time: c.date, value: c.volume, up: c.close >= c.open })),
    rsi: rsi.slice(from),
    macdHist: md.hist.slice(from),
    rsiNow: closes.length ? rsi[rsi.length - 1] : null,
    macdNow: closes.length ? md.hist[md.hist.length - 1] : null,
    has200: !!s200,
    total: full.length,
  }
}

// Resumen en texto del rango visible (lector de pantalla y vista sin canvas).
export function rangeSummary(candles) {
  const c = candles || []
  if (c.length < 2) return null
  const first = c[0], last = c[c.length - 1]
  let low = Infinity, high = -Infinity
  for (const k of c) { if (k.low < low) low = k.low; if (k.high > high) high = k.high }
  return { from: first.close, to: last.close, pct: last.close / first.close - 1, low, high, days: c.length, start: first.date, end: last.date }
}

// ── Lecturas por indicador (readings.js: buildReadings + deScoreTicker) ──
// Cada lectura: { key, value: {kind, v}, reading: '<clave>', vars, tone }.
// tone describe el dato, nunca premia nada: 'pos' | 'neg' | 'warn' | 'neu'.
export function buildReadings(i = {}) {
  const out = []
  const last = i.last
  if (isNum(last) && isNum(i.s200) && i.s200 > 0) {
    const d = (last - i.s200) / i.s200
    out.push({ key: 'sma200', value: { kind: 'pct', v: d }, reading: d >= 0 ? 'up' : 'down', vars: {}, tone: d >= 0 ? 'pos' : 'neg' })
  }
  if (isNum(last) && isNum(i.s50) && i.s50 > 0) {
    const d = (last - i.s50) / i.s50
    out.push({ key: 'sma50', value: { kind: 'pct', v: d }, reading: d >= 0 ? 'up' : 'down', vars: {}, tone: d >= 0 ? 'pos' : 'neg' })
  }
  if (isNum(i.rsi)) {
    const z = rsiZone(i.rsi)
    out.push({ key: 'rsi', value: { kind: 'int', v: i.rsi }, reading: z, vars: {}, tone: z === 'mid' ? 'neu' : 'warn' })
  }
  if (isNum(i.macdHist)) {
    const up = isNum(i.macdPrev) ? i.macdHist > i.macdPrev : null
    const reading = i.macdHist >= 0 ? (up === false ? 'posFading' : 'pos') : (up === true ? 'negRecovering' : 'neg')
    out.push({ key: 'macd', value: { kind: 'sign', v: i.macdHist >= 0 ? 'above' : 'below' }, reading, vars: {}, tone: i.macdHist >= 0 ? 'pos' : 'neg' })
  }
  if (isNum(i.volRatio)) {
    const dv = i.volRatio - 1
    out.push({ key: 'vol', value: { kind: 'pct0', v: dv }, reading: dv >= 0.2 ? 'high' : dv <= -0.2 ? 'low' : 'usual', vars: {}, tone: 'neu' })
  }
  if (isNum(last) && isNum(i.high52) && i.high52 > 0) {
    const dh = (last - i.high52) / i.high52
    out.push({ key: 'high52', value: { kind: 'pct', v: dh }, reading: dh > -0.03 ? 'near' : 'below', vars: { pct: -dh }, tone: 'neu' })
  }
  if (isNum(last) && isNum(i.atr) && last > 0) {
    const ap = i.atr / last
    out.push({ key: 'atr', value: { kind: 'pct', v: ap, unsigned: true }, reading: 'typical', vars: { pct: ap, amt: i.atr }, tone: 'neu' })
  }
  return out
}

// deScoreTicker de Invest: un año de cierres diarios → tendencia y lecturas.
// Con menos de 30 velas no hay lectura (null).
export function scoreAsset(rows) {
  const hist = cleanCandles(rows)
  if (hist.length < 30) return null
  const closes = hist.map(d => d.close)
  const highs = hist.map(d => d.high)
  const lows = hist.map(d => d.low)
  const vols = hist.map(d => d.volume)
  const last = closes[closes.length - 1]
  const s50a = sma(closes, Math.min(50, closes.length))
  const s50 = s50a[s50a.length - 1]
  const s200 = closes.length >= 200 ? sma(closes, 200)[closes.length - 1] : null
  const rsi = lastRsi(closes, 14)
  const mh = macd(closes).hist
  const mLast = mh[mh.length - 1], mPrev = mh[mh.length - 2]
  // Volumen: solo si las últimas 20 velas lo traen (el demo y algunos índices no).
  const v20 = vols.slice(-20)
  const volOk = v20.length === 20 && v20.every(v => isNum(v) && v >= 0)
  const avgVol = volOk ? v20.reduce((a, b) => a + b, 0) / 20 : 0
  const volRatio = volOk && avgVol > 0 ? vols[vols.length - 1] / avgVol : null
  const atrArr = atr(highs, lows, closes, 14)
  const atrNow = atrArr[atrArr.length - 1] || null
  const w = Math.min(252, hist.length)
  const high52 = Math.max(...highs.slice(-w))
  const low52 = Math.min(...lows.slice(-w).filter(v => v > 0))
  const trend = classifyTrend(last, s50, s200)
  return {
    last, trend, rsi: isNum(rsi) ? Math.round(rsi) : null, s50, s200, high52, low52, atr: atrNow,
    macdHist: mLast, macdPrev: mPrev, volRatio,
    readings: buildReadings({ last, rsi, s50, s200, macdHist: mLast, macdPrev: mPrev, volRatio, high52, atr: atrNow }),
  }
}

// ── Fundamentales (market.js: normalizeFundamentals, fundTags) ─────
export const PCT_FIELDS = ['roe', 'grossMargin', 'netMargin', 'operatingMargin', 'revenueGrowth']
// Finnhub da %, FMP fracción. Fuente desconocida: |v| > 2 se toma como %.
export function normalizeFundamentals(f) {
  if (!f) return f
  const out = { ...f }
  for (const k of PCT_FIELDS) {
    const v = f[k]
    if (v == null || !Number.isFinite(Number(v))) { out[k] = null; continue }
    if (f.source === 'finnhub') out[k] = v / 100
    else if (f.source === 'fmp') out[k] = +v
    else out[k] = Math.abs(v) > 2 ? v / 100 : +v
  }
  return out
}
export function fundTags(f) {
  const seen = new Set(), out = []
  for (const x of [f?.sector, f?.industry, f?.country]) {
    const s = x == null ? '' : String(x).trim()
    if (!s || seen.has(s.toLowerCase())) continue
    seen.add(s.toLowerCase())
    out.push(s)
  }
  return out
}

// ¿La respuesta trae algún dato? (un objeto vacío o solo con la fuente no cuenta).
export function hasFundamentals(f) {
  if (!f || typeof f !== 'object') return false
  return ['peRatio', 'forwardPE', 'eps', 'priceToBook', 'roe', 'grossMargin', 'netMargin', 'revenueGrowth', 'beta', 'debtToEquity', 'dividendYield', 'marketCap', 'sector', 'description']
    .some(k => f[k] != null && f[k] !== '')
}

// Las 12 métricas de Invest, en su orden. kind dice cómo se formatea:
// times (N veces), pct (fracción), eps (en la moneda del reporte, sin
// símbolo fuera de US$), num2 (2 decimales), div (o "No paga"), cap (abreviado).
export const FUND_METRICS = [
  ['pe', 'peRatio', 'times1'],
  ['fpe', 'forwardPE', 'times1'],
  ['eps', 'eps', 'eps'],
  ['pb', 'priceToBook', 'times2'],
  ['roe', 'roe', 'pct'],
  ['gross', 'grossMargin', 'pct'],
  ['net', 'netMargin', 'pct'],
  ['revg', 'revenueGrowth', 'pct'],
  ['beta', 'beta', 'num2'],
  ['de', 'debtToEquity', 'times2'],
  ['div', 'dividendYield', 'div'],
  ['cap', 'marketCap', 'cap'],
]
export function fundMetrics(raw, quote = null) {
  const f = normalizeFundamentals(raw) || {}
  return FUND_METRICS.map(([key, field, kind]) => {
    let v = numOrNull(f[field])
    if (key === 'cap' && !(v > 0)) v = numOrNull(quote?.marketCap) > 0 ? Number(quote.marketCap) : null
    // M10 (QA): sin dato (null, típico de un ETF en la fuente) no es "no paga";
    // solo un 0 explícito lo es.
    if (key === 'div') return { key, kind, v: v > 0 ? v : null, none: v === 0 }
    return { key, kind, v }
  })
}

// Capitalización abreviada sin moneda: 2,85 billones → { n: 2.85, unit: 'T' }.
export function capParts(v) {
  const n = Number(v)
  if (!(n > 0)) return null
  if (n >= 1e12) return { n: n / 1e12, unit: 'T' }
  if (n >= 1e9) return { n: n / 1e9, unit: 'B' }
  if (n >= 1e6) return { n: n / 1e6, unit: 'M' }
  return { n, unit: '' }
}

// ── Rango de 52 semanas ────────────────────────────────────────────
// La cotización trae high52/low52; sin ellos se usan las velas del último año
// (y se dice). p = posición del precio en el rango, 0–1.
export function range52(price, quote, score) {
  let low = numOrNull(quote?.low52), high = numOrNull(quote?.high52), from = 'quote'
  if (!(high > low && low > 0)) { low = numOrNull(score?.low52); high = numOrNull(score?.high52); from = 'candles' }
  if (!(high > low && low > 0) || !(price > 0)) return null
  return { low, high, p: Math.max(0, Math.min(1, (price - low) / (high - low))), from }
}

// ── Resultados trimestrales (/api/earnings) ────────────────────────
export function earningsSummary(e) {
  if (!e || !Array.isArray(e.quarters) || !e.quarters.length) {
    return e?.nextDate ? { quarters: [], beat: 0, total: 0, nextDate: e.nextDate, source: e.source || null } : null
  }
  const quarters = e.quarters.filter(q => q && q.date).map(q => ({
    date: String(q.date), eps: numOrNull(q.eps), epsEst: numOrNull(q.epsEst),
    beat: q.beat === true ? true : q.beat === false ? false : null,
  }))
  return {
    quarters,
    beat: quarters.filter(q => q.beat === true).length,
    total: quarters.filter(q => q.beat != null).length,
    nextDate: e.nextDate || null,
    source: e.source || null,
  }
}

// ── Mi posición (drawerMinePane) ───────────────────────────────────
export const DEFAULT_STOP_PCT = 0.08 // Invest: RISK_DEFAULT_STOP_PCT

// lots: los lotes del ticker ({ sh, cost, stop }). price: precio actual (o null).
// weight: parte del portafolio en USD (0–1, o null si no se sabe todavía).
// limit: límite de concentración en %. stopColumn: la tabla tiene columna stop.
export function minePosition(lots, price, { weight = null, limit = 25, stopColumn = true } = {}) {
  const own = (lots || []).filter(h => h && Number(h.sh) > 0)
  if (!own.length) return null
  let sh = 0, cost = 0, stop = null
  for (const h of own) { sh += Number(h.sh); cost += Number(h.sh) * (Number(h.cost) || 0); if (Number(h.stop) > 0) stop = Number(h.stop) }
  const avgCost = sh > 0 ? cost / sh : 0
  const px = Number(price) > 0 ? Number(price) : null
  const value = sh * (px ?? avgCost)
  const pl = px ? value - cost : null
  let risk = null, riskKind = 'none'
  if (px && stop) { risk = -Math.max(0, (px - stop) * sh); riskKind = 'stop' }
  else if (px && !stopColumn) { risk = -px * DEFAULT_STOP_PCT * sh; riskKind = 'estimate' }
  else if (px && !stop) { riskKind = 'noStop' }
  return {
    sh, avgCost, value, cost, pl, plPct: pl != null && cost > 0 ? pl / cost : null,
    priced: !!px, stop, risk, riskKind,
    weight: isNum(weight) ? weight : null,
    overLimit: isNum(weight) && weight * 100 > limit,
    lots: own.length,
    editableStop: stopColumn && own.length === 1,
  }
}

// ── Noticias (drawerNewsPane): del ticker o con el ticker en el título ──
export function filterNews(items, ticker, max = 8) {
  const t = String(ticker || '').toUpperCase()
  const word = t.replace(/[^A-Z0-9]/g, '')
  const re = word ? new RegExp(`\\b${word}\\b`) : null
  return (items || []).filter(n => n && n.title && (
    (Array.isArray(n.tickers) && n.tickers.map(x => String(x).toUpperCase()).includes(t)) || (re && re.test(n.title))
  )).slice(0, max)
}
// Solo enlaces http(s); cualquier otro esquema se descarta (javascript:, data:).
export function safeLink(url) {
  try {
    const u = new URL(String(url))
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch { return null }
}

// ── Comparar (Comparar de Invest: rendimiento, volatilidad, Sharpe, correlación) ──
// Sobre el mismo rango visible. Las velas llevan date; la correlación alinea
// por día (FIN-4).
export function compareStats(rowsA, rowsB, n) {
  const toTs = (rows) => cleanCandles(rows).slice(-Math.max(2, n | 0)).map(c => ({ ...c, ts: Math.floor(Date.parse(`${c.date}T00:00:00Z`) / 1000) }))
  const a = toTs(rowsA), b = toTs(rowsB)
  const side = (c) => {
    if (c.length < 2) return null
    const closes = c.map(k => k.close)
    const r = dailyReturns(closes)
    return { ret: closes[closes.length - 1] / closes[0] - 1, vol: volatility(r), sharpe: sharpe(r), days: c.length }
  }
  return { a: side(a), b: side(b), corr: a.length > 2 && b.length > 2 ? returnCorrelation(a, b) : null }
}
export function corrBand(r) {
  if (!isNum(r)) return null
  return r > 0.7 ? 'high' : r >= 0.4 ? 'mid' : 'low'
}
// Contra qué se compara: SPY, salvo que el activo sea SPY.
export const compareWith = (ticker) => (String(ticker).toUpperCase() === 'SPY' ? 'QQQ' : 'SPY')

// ── Compartir: ticker, nombre, precio y cambio del día. Nunca datos de la
// posición (unidades, costo, valor): eso es del portafolio de la persona.
export function shareParts(ticker, { name = null, priceText = null, pctText = null } = {}) {
  return { t: String(ticker || '').toUpperCase(), name: name ? String(name).trim() : '', price: priceText || '', pct: pctText || '' }
}

