// src/utils/investMarket.js — pestaña Mercado de Inversiones (F6), lógica pura.
//
// Port de Invest (invest-web/app/index.html, inventario 05-mercado.md) con las
// correcciones que el plan pide al pasarlo:
//  · Tendencia (régimen) de SPY con SMA50/SMA200 y umbral de 1 % (deGetRegime).
//    Invest calculaba la "SMA200" con min(200, n) cierres: con historia corta
//    el rótulo mentía (riesgo 9). Aquí, sin 200 cierres no hay tendencia.
//  · Una sola escala del VIX: 15 / 25 / 35 (la de la app; estado-mercado.html
//    usaba 15/20/30, riesgo 8).
//  · changePct SIEMPRE en fracción (investApi ya divide el de marketbar).
//  · Horario de la Bolsa de Nueva York CON feriados y jornadas cortas (Invest
//    decía "abierta" en feriados, riesgo 10).
//  · Próximos resultados sin cripto y con tope de empresas (riesgo 11).
//  · Noticias del mercado general: los tickers de la persona no viajan en la
//    URL (riesgo 12). El filtro por categoría es local.
// Nada de esto se guarda en el dispositivo.
import { fmtDecimal, fmtNum, MINUS, NNBSP } from './index.js'
import { INVEST_API_ORIGIN } from '../core/investApi.js'

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const DAY = 86400000

// ── Instrumentos ──────────────────────────────────────────────────
// Los 10 de la tabla y la cinta (api/marketbar, sin el VIX, que tiene su
// celda en el contexto). `name`: nombre propio que no se traduce; `key`:
// clave i18n de los que sí.
export const MKT_SYMS = [
  { sym: '^GSPC', name: 'S&P 500' },
  { sym: '^DJI', name: 'Dow 30' },
  { sym: '^IXIC', name: 'Nasdaq' },
  { sym: '^RUT', name: 'Russell 2000' },
  { sym: 'CL=F', key: 'invest.mkt.sym.oil' },
  { sym: 'GC=F', key: 'invest.mkt.sym.gold' },
  { sym: 'SI=F', key: 'invest.mkt.sym.silver' },
  { sym: 'EURUSD=X', key: 'invest.mkt.sym.eurusd' },
  { sym: '^TNX', key: 'invest.mkt.sym.tnx' },
  { sym: 'BTC-USD', name: 'Bitcoin' },
]
export const VIX_SYM = '^VIX'
export const symName = (s, t) => (s.key ? t(s.key) : s.name)

// Valor de un instrumento en el formato de Invest (mktFmtValue): EUR/USD con 4
// decimales, el bono como tasa, materias primas y bitcoin en US$, los índices
// sin decimales desde 1.000.
export function fmtMarketValue(sym, price, locale) {
  if (!isNum(price)) return ''
  if (sym === 'EURUSD=X') return fmtDecimal(price, 4, locale)
  if (sym === '^TNX') return `${fmtDecimal(price, 2, locale)}${NNBSP}%`
  if (sym === 'BTC-USD') return `US$${NNBSP}${fmtNum0(price, locale)}`
  if (sym === 'CL=F' || sym === 'GC=F' || sym === 'SI=F') return `US$${NNBSP}${fmtDecimal(price, 2, locale)}`
  return price >= 1000 ? fmtNum0(price, locale) : fmtDecimal(price, 2, locale)
}
function fmtNum0(n, locale) {
  if (!locale) return fmtNum(n, 0)
  try { return Math.round(n).toLocaleString(locale, { maximumFractionDigits: 0 }) } catch { return String(Math.round(n)) }
}

// Cambio del día (fracción) → "+1,23 %" / "−0,40 %" y su dirección.
export function fmtChange(frac, locale) {
  if (!isNum(frac)) return null
  const body = fmtDecimal(Math.abs(frac) * 100, 2, locale)
  const zero = !/[1-9]/.test(body)
  const dir = zero ? 'flat' : frac > 0 ? 'up' : 'down'
  return { text: `${zero ? '' : frac < 0 ? MINUS : '+'}${body}${NNBSP}%`, dir }
}

// Fila de la tabla/cinta a partir de la respuesta de investApi.marketbar().
export function marketRows(bar) {
  const items = bar?.items || []
  return MKT_SYMS.map(s => {
    const it = items.find(x => x && x.sym === s.sym)
    const ok = !!it && isNum(it.price) && it.price > 0
    return { ...s, price: ok ? it.price : null, changePct: ok && isNum(it.changePct) ? it.changePct : null }
  })
}
export function vixFromBar(bar) {
  const it = (bar?.items || []).find(x => x && x.sym === VIX_SYM)
  return it && isNum(it.price) && it.price > 0 ? it.price : null
}

// Cierres para una sparkline mensual: los últimos 22 > 0 (stripLoadSparks).
export function monthCloses(rows, n = 22) {
  const c = (rows || []).map(r => (r && typeof r === 'object' ? r.close : r)).filter(v => isNum(v) && v > 0)
  return c.length >= 2 ? c.slice(-n) : null
}
export const periodChange = (closes) => (closes && closes.length > 1 && closes[0] > 0 ? closes[closes.length - 1] / closes[0] - 1 : null)

// ── Tendencia de SPY (régimen) ────────────────────────────────────
export const REGIME_MIN = 200
export const REGIME_THRESHOLD = 0.01
function meanLast(p, n) {
  if (p.length < n) return null
  let s = 0
  for (let i = p.length - n; i < p.length; i++) s += p[i]
  return s / n
}
// closes: cierres diarios en orden. Devuelve
// { regime: 'up'|'down'|'mixed'|null, reason: 'short'|'none'|null, last, sma50, sma200, pct200 }.
export function regimeFrom(closes) {
  const p = (closes || []).filter(v => isNum(v) && v > 0)
  if (!p.length) return { regime: null, reason: 'none', last: null, sma50: null, sma200: null, pct200: null }
  const last = p[p.length - 1]
  if (p.length < REGIME_MIN) return { regime: null, reason: 'short', last, sma50: null, sma200: null, pct200: null }
  const sma200 = meanLast(p, 200)
  const sma50 = meanLast(p, 50)
  const pct200 = (last - sma200) / sma200
  let regime = 'mixed'
  if (last > sma200 && sma50 > sma200 && pct200 > REGIME_THRESHOLD) regime = 'up'
  else if (last < sma200 && sma50 < sma200) regime = 'down'
  return { regime, reason: null, last, sma50, sma200, pct200 }
}

// Serie del minigráfico: el último año (≤ 252 sesiones) de SPY con su SMA200
// REAL en cada punto. Necesita ≥ 200 + 1 cierres; con 2 años de historia la
// media cubre el año entero. Ordena por fecha (no por la fecha formateada).
export function spyChartSeries(rows, days = 252) {
  const list = (rows || []).filter(r => r && isNum(r.close) && r.close > 0 && (isNum(r.ts) || r.date))
    .map(r => ({ ts: isNum(r.ts) ? r.ts : Math.floor(Date.parse(`${r.date}T00:00:00Z`) / 1000), close: r.close }))
    .filter(r => isNum(r.ts))
    .sort((a, b) => a.ts - b.ts)
  if (list.length < REGIME_MIN + 1) return null
  const out = []
  let sum = 0
  for (let i = 0; i < list.length; i++) {
    sum += list[i].close
    if (i >= REGIME_MIN) sum -= list[i - REGIME_MIN].close
    if (i >= REGIME_MIN - 1) out.push({ ts: list[i].ts, close: list[i].close, ma: sum / REGIME_MIN })
  }
  return out.slice(-days)
}

// Trazos SVG de precio y media sobre la misma escala.
export function chartPaths(series, width, height, pad = 4) {
  if (!series || series.length < 2) return null
  let min = Infinity, max = -Infinity
  for (const p of series) { min = Math.min(min, p.close, p.ma); max = Math.max(max, p.close, p.ma) }
  const span = max - min || 1
  const step = (width - pad * 2) / (series.length - 1)
  const x = (i) => (pad + i * step).toFixed(2)
  const y = (v) => (pad + (height - pad * 2) * (1 - (v - min) / span)).toFixed(2)
  const line = (k) => series.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p[k])}`).join(' ')
  const last = series[series.length - 1]
  return { price: line('close'), ma: line('ma'), dot: { x: Number(x(series.length - 1)), y: Number(y(last.close)) }, min, max }
}

// ── VIX ───────────────────────────────────────────────────────────
export const VIX_ZONES = [15, 25, 35]
export function vixZone(v) {
  if (!isNum(v) || v <= 0) return null
  return v < 15 ? 'low' : v < 25 ? 'normal' : v < 35 ? 'elevated' : 'extreme'
}
// Posición del marcador en una barra de 0 a 50 (0–100 %), acotada.
export const vixGaugePct = (v, top = 50) => (isNum(v) ? Math.max(0, Math.min(100, (v / top) * 100)) : null)

// ── Próximos resultados ───────────────────────────────────────────
export const EARN_DEFAULTS = ['AAPL', 'NVDA', 'MSFT', 'AMZN', 'GOOGL', 'META']
export const EARN_MAX_TICKERS = 15
export const EARN_FROM = -2
export const EARN_TO = 45
export const EARN_SHOW = 10
const TICKER_OK = /^[A-Z0-9.\-^=]{1,15}$/
export const isCryptoTicker = (t, type) => type === 'Crypto' || /-(USD|USDT|USDC|EUR)$/.test(String(t || ''))

// holdings: [{ t, type }]; watch: ['AAPL', …] o [{ ticker }]. Sin cripto (no
// publican resultados), sin índices ni futuros, sin repetir y con tope.
export function earningsUniverse({ holdings = [], watch = [], max = EARN_MAX_TICKERS } = {}) {
  const port = new Set(), list = new Set(), out = []
  const add = (raw, type, bucket) => {
    const t = String((raw && typeof raw === 'object' ? raw.t || raw.ticker : raw) || '').toUpperCase().trim()
    if (!TICKER_OK.test(t) || /[\^=]/.test(t) || isCryptoTicker(t, type)) return
    bucket.add(t)
    if (!out.includes(t)) out.push(t)
  }
  for (const h of holdings || []) add(h, h?.type, port)
  for (const w of watch || []) add(w, w?.type, list)
  if (!out.length) return { tickers: EARN_DEFAULTS.slice(), defaults: true, capped: false, portfolio: port, watch: list }
  return { tickers: out.slice(0, max), defaults: false, capped: out.length > max, portfolio: port, watch: list }
}

// Días hasta la fecha (a mediodía UTC, como Invest), redondeado.
export function daysAway(nextDate, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(nextDate || ''))) return null
  const ts = Date.parse(`${String(nextDate).slice(0, 10)}T12:00:00Z`)
  return Number.isFinite(ts) ? Math.round((ts - now) / DAY) : null
}

// replies: [{ ticker, data }] con data = respuesta de /api/earnings o null.
// Sin `source` cuenta como "la fuente no respondió" (no como "no publica").
export function earningsWindow(replies, now = Date.now()) {
  let failed = 0
  const sources = new Set()
  const items = []
  for (const r of replies || []) {
    const d = r?.data
    if (!d || !d.source) { failed++; continue }
    sources.add(d.source)
    const days = daysAway(d.nextDate, now)
    if (days == null || days < EARN_FROM || days > EARN_TO) continue
    items.push({ ticker: r.ticker, date: String(d.nextDate).slice(0, 10), days })
  }
  items.sort((a, b) => a.days - b.days || (a.ticker < b.ticker ? -1 : 1))
  return { items: items.slice(0, EARN_SHOW), failed, total: (replies || []).length, sources: [...sources] }
}
// "hace 2 días" · "hoy" · "mañana" · "en 5 días" → clave y n.
export function whenKey(days) {
  if (days < -1) return { key: 'invest.mkt.earn.when.agoMany', n: -days }
  if (days === -1) return { key: 'invest.mkt.earn.when.agoOne', n: 1 }
  if (days === 0) return { key: 'invest.mkt.earn.when.today', n: 0 }
  if (days === 1) return { key: 'invest.mkt.earn.when.tomorrow', n: 1 }
  return { key: 'invest.mkt.earn.when.inMany', n: days }
}
export const EARN_SOURCE_NAME = { finnhub: 'Finnhub', fmp: 'Financial Modeling Prep' }

// ── Noticias ──────────────────────────────────────────────────────
// Categorías que asigna api/news (cat) → clave i18n. 'all' es el filtro "Todo".
export const NEWS_CATS = [
  { id: 'all', key: 'invest.mkt.news.cat.all' },
  { id: 'Fed', key: 'invest.mkt.news.cat.fed' },
  { id: 'Earnings', key: 'invest.mkt.news.cat.earnings' },
  { id: 'Geopolítica', key: 'invest.mkt.news.cat.geo' },
  { id: 'Macro', key: 'invest.mkt.news.cat.macro' },
  { id: 'IA & Tech', key: 'invest.mkt.news.cat.tech' },
]
export const NEWS_MAX = 30
export const newsCatKey = (id) => NEWS_CATS.find(c => c.id === id)?.key || null

// Enlace externo solo http(s); cualquier otra cosa no se enlaza.
export function safeLink(u) {
  try {
    const url = new URL(String(u || '').trim())
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch { return null }
}

// Miniatura de la noticia (como Invest v1): api/news la toma del thumbnail de
// Yahoo (bestImage). Solo https y solo de los CDN de imágenes que la API
// devuelve de verdad (observados el 25-nov-2026). La app NUNCA la pide directo
// al CDN: pasa por el proxy propio invest.moyiq.app/api/img (misma lista de
// hosts del lado del servidor), así la CSP solo abre img-src a
// invest.moyiq.app y el CDN no recibe la IP ni las cabeceras del usuario.
export const NEWS_IMG_HOSTS = ['media.zenfs.com', 's.yimg.com', 'd29szjachogqwa.cloudfront.net']
export function safeNewsImage(u) {
  if (typeof u !== 'string' || !u) return null
  try {
    const url = new URL(u.trim())
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
    // Igual que el proxy /api/img: sin query ni fragmento.
    if (url.search || url.hash) return null
    return NEWS_IMG_HOSTS.includes(url.hostname) ? url.href : null
  } catch { return null }
}
// src del <img>: la URL validada, servida por el proxy de Invest.
export function newsImageSrc(u) {
  const safe = safeNewsImage(u)
  return safe ? `${INVEST_API_ORIGIN}/api/img?u=${encodeURIComponent(safe)}` : null
}

// items de investApi.news(): sin título fuera, sin repetir el mismo enlace o
// titular, cat desconocida → Macro (lo que hace api/news por defecto).
const hoursOf = (v) => { const h = v == null || v === '' ? NaN : Number(v); return Number.isFinite(h) ? Math.max(0, h) : null }
export function cleanNews(items) {
  const seen = new Set()
  const out = []
  for (const n of items || []) {
    const title = String(n?.title || '').trim()
    if (!title) continue
    const link = safeLink(n.link)
    const k = (link || title).toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push({
      id: String(n.id ?? out.length),
      title,
      link,
      source: String(n.source || '').trim() || null,
      hoursAgo: hoursOf(n.hoursAgo),
      cat: newsCatKey(n.cat) && n.cat !== 'all' ? n.cat : 'Macro',
      image: safeNewsImage(n.image),
      sample: !!n.sample,
      // Demo: el texto se traduce al pintar (cambia con el idioma).
      titleKey: n.sample && n.titleKey ? String(n.titleKey) : null,
      sourceKey: n.sample && n.sourceKey ? String(n.sourceKey) : null,
    })
  }
  return out
}
export function newsCounts(items) {
  const c = { all: (items || []).length }
  for (const n of items || []) c[n.cat] = (c[n.cat] || 0) + 1
  return c
}
export function filterNews(items, cat, max = NEWS_MAX) {
  const list = !cat || cat === 'all' ? items || [] : (items || []).filter(n => n.cat === cat)
  return list.slice(0, max)
}
export function newsAgo(h) {
  if (!isNum(h)) return null
  if (h < 1) return { key: 'invest.mkt.news.ago.lt1', n: 0 }
  if (h < 24) { const n = Math.round(h); return { key: n === 1 ? 'invest.mkt.news.ago.hourOne' : 'invest.mkt.news.ago.hourMany', n } }
  const d = Math.round(h / 24)
  return { key: d === 1 ? 'invest.mkt.news.ago.dayOne' : 'invest.mkt.news.ago.dayMany', n: d }
}

// ── Tipos de cambio LatAm ─────────────────────────────────────────
// latam: /api/fx-latam { rates, sources }; ars: /api/fx-ars { mep, oficial }.
// Una tasa de respaldo (sources[c] === 'fallback') NO se muestra como dato
// (FIN-17: nunca una cifra fija sin fecha): la fila dice "sin conexión".
export const FX_ROWS = ['CLP', 'MXN', 'COP', 'PEN']
export function fxRows(latam, ars, { sample = false } = {}) {
  const rate = (c) => {
    const r = Number(latam?.rates?.[c])
    return Number.isFinite(r) && r > 0 && latam?.sources?.[c] !== 'fallback' ? r : null
  }
  const src = (c) => (latam?.sources?.[c] === 'mindicador' ? 'mindicador' : 'yahoo')
  const rows = FX_ROWS.map(c => {
    const r = rate(c)
    return { id: c, ccy: c, rate: r, source: r == null ? null : src(c), date: null }
  })
  // Peso argentino: oficial (Yahoo, el que usan las conversiones; si falta,
  // el oficial de DolarApi) y MEP (DolarApi, con su fecha).
  const yo = rate('ARS')
  const dOf = Number(ars?.oficial?.rate)
  const oficial = yo != null ? { rate: yo, source: 'yahoo', date: null }
    : Number.isFinite(dOf) && dOf > 0 ? { rate: dOf, source: 'dolarapi', date: ars.oficial.date || null } : { rate: null, source: null, date: null }
  const dMep = Number(ars?.mep?.rate)
  const mep = Number.isFinite(dMep) && dMep > 0 ? { rate: dMep, source: 'dolarapi', date: ars.mep.date || null } : { rate: null, source: null, date: null }
  rows.splice(3, 0, { id: 'ARS-Oficial', ccy: 'ARS', kind: 'Oficial', ...oficial }, { id: 'ARS-MEP', ccy: 'ARS', kind: 'MEP', ...mep })
  if (sample) for (const r of rows) if (r.rate != null) { r.source = 'sample'; r.date = null }
  return rows
}
// Decimales de una tasa: los pesos grandes sin decimales, el resto con 2.
export const fxDecimals = (ccy, rate) => (rate >= 100 || ccy === 'CLP' || ccy === 'COP' ? 0 : 2)

// ── Horario de la Bolsa de Nueva York ─────────────────────────────
const NY = 'America/New_York'
const pad2 = (n) => String(n).padStart(2, '0')
const ymd = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`
function nthWeekday(y, m, wd, n) { // m 1..12, wd 0=dom, n 1.. (o −1 = último)
  if (n > 0) {
    const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
    return 1 + ((wd - first + 7) % 7) + (n - 1) * 7
  }
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const lastWd = new Date(Date.UTC(y, m - 1, lastDay)).getUTCDay()
  return lastDay - ((lastWd - wd + 7) % 7)
}
function easter(y) { // algoritmo anónimo gregoriano → [mes, día]
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1
  return [month, day]
}
function observed(y, m, d) { // sábado → viernes, domingo → lunes
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const t = Date.UTC(y, m - 1, d) + (wd === 6 ? -DAY : wd === 0 ? DAY : 0)
  return new Date(t).toISOString().slice(0, 10)
}
// Feriados de la NYSE (reglas vigentes). Año nuevo en sábado no se corre al
// viernes anterior (regla de la NYSE).
export function nyseHolidays(y) {
  const out = new Set()
  const ny = new Date(Date.UTC(y, 0, 1)).getUTCDay()
  if (ny !== 6) out.add(observed(y, 1, 1))
  out.add(ymd(y, 1, nthWeekday(y, 1, 1, 3))) // Martin Luther King Jr.
  out.add(ymd(y, 2, nthWeekday(y, 2, 1, 3))) // Washington
  const [em, ed] = easter(y)
  out.add(new Date(Date.UTC(y, em - 1, ed) - 2 * DAY).toISOString().slice(0, 10)) // Viernes Santo
  out.add(ymd(y, 5, nthWeekday(y, 5, 1, -1))) // Memorial Day
  if (y >= 2022) out.add(observed(y, 6, 19)) // Juneteenth
  out.add(observed(y, 7, 4))
  out.add(ymd(y, 9, nthWeekday(y, 9, 1, 1))) // Labor Day
  out.add(ymd(y, 11, nthWeekday(y, 11, 4, 4))) // Acción de Gracias
  out.add(observed(y, 12, 25))
  return out
}
// Jornadas cortas (cierre 13:00): 3 de julio, viernes después de Acción de
// Gracias y 24 de diciembre, si ese día se opera.
export function nyseEarlyCloses(y) {
  const out = new Set([ymd(y, 7, 3), ymd(y, 11, nthWeekday(y, 11, 4, 4) + 1), ymd(y, 12, 24)])
  const hol = nyseHolidays(y)
  for (const d of [...out]) {
    const wd = new Date(`${d}T00:00:00Z`).getUTCDay()
    if (wd === 0 || wd === 6 || hol.has(d)) out.delete(d)
  }
  return out
}
// Partes de fecha y hora en Nueva York.
export function nyParts(ms) {
  const parts = {}
  for (const p of new Intl.DateTimeFormat('en-US', { timeZone: NY, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms))) parts[p.type] = p.value
  return { y: +parts.year, m: +parts.month, d: +parts.day, h: +parts.hour % 24, mi: +parts.minute }
}
// Hora de pared de Nueva York → instante UTC (ms). Ajusta el desfase dos veces
// para atravesar bien el cambio de horario.
export function nyWallToMs(y, m, d, h, mi) {
  let guess = Date.UTC(y, m - 1, d, h, mi)
  for (let i = 0; i < 2; i++) {
    const p = nyParts(guess)
    const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi)
    guess += Date.UTC(y, m - 1, d, h, mi) - asUtc
  }
  return guess
}
function dayKind(y, m, d) {
  const key = ymd(y, m, d)
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  if (wd === 0 || wd === 6) return { trading: false, reason: 'weekend', key }
  if (nyseHolidays(y).has(key)) return { trading: false, reason: 'holiday', key }
  return { trading: true, early: nyseEarlyCloses(y).has(key), key }
}
// { open, reason: 'open'|'before'|'after'|'weekend'|'holiday', early,
//   closesAt (si abierta), opensAt (próxima apertura) } — instantes en ms.
export function nyseSession(now = Date.now()) {
  const p = nyParts(now)
  const today = dayKind(p.y, p.m, p.d)
  const mins = p.h * 60 + p.mi
  if (today.trading) {
    const close = today.early ? 13 * 60 : 16 * 60
    if (mins >= 9 * 60 + 30 && mins < close) {
      return { open: true, reason: 'open', early: !!today.early, closesAt: nyWallToMs(p.y, p.m, p.d, Math.floor(close / 60), close % 60), opensAt: null }
    }
    if (mins < 9 * 60 + 30) return { open: false, reason: 'before', early: false, closesAt: null, opensAt: nyWallToMs(p.y, p.m, p.d, 9, 30) }
  }
  // Próximo día hábil (máx. 10 días: el fin de semana largo más largo son 4).
  const base = Date.UTC(p.y, p.m - 1, p.d)
  for (let i = 1; i <= 10; i++) {
    const dt = new Date(base + i * DAY)
    const k = dayKind(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
    if (k.trading) {
      return { open: false, reason: today.trading ? 'after' : today.reason, early: false, closesAt: null, opensAt: nyWallToMs(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate(), 9, 30) }
    }
  }
  return { open: false, reason: today.trading ? 'after' : today.reason, early: false, closesAt: null, opensAt: null }
}

// ── Frescura ──────────────────────────────────────────────────────
// Del bloque de datos de la pestaña (marketbar no informa la hora de cada
// símbolo: se dice la de consulta). state: 'loading'|'ok'|'failed'|'offline'|'sample'.
export function feedFreshness({ at = null, loading = false, failed = false, offline = false, sample = false } = {}) {
  if (sample) return { state: 'sample', at }
  if (offline) return { state: 'offline', at }
  if (at && !failed) return { state: 'ok', at }
  if (loading) return { state: 'loading', at: null }
  return { state: failed && at ? 'offline' : 'failed', at }
}

// Frescura de una cotización (readings.js: quoteFreshness), sin textos: la
// pantalla arma la etiqueta. q: { marketTime, fetchedAt, tradingStart, tradingEnd } en ms.
export function quoteFreshness(q, now = Date.now(), failed = false) {
  const mt = q && isNum(q.marketTime) ? q.marketTime : null
  if (failed) return { state: 'offline', minutes: null, time: mt || (q && isNum(q.fetchedAt) ? q.fetchedAt : null) }
  if (!mt) return { state: 'unknown', minutes: null, time: q && isNum(q.fetchedAt) ? q.fetchedAt : null }
  const end = q && isNum(q.tradingEnd) ? q.tradingEnd : null
  const start = q && isNum(q.tradingStart) ? q.tradingStart : null
  if ((end && now > end) || (start && now < start)) return { state: 'closed', minutes: null, time: mt }
  const minutes = Math.max(0, Math.round((now - mt) / 60000))
  return { state: minutes <= 2 ? 'live' : 'delayed', minutes, time: mt }
}
// Peor caso entre los precios cargados (readings.js: summarizeFreshness).
export function summarizeFreshness(quotes, now = Date.now(), failed = false) {
  const list = (quotes || []).filter(Boolean)
  if (failed) {
    let t = 0
    for (const q of list) t = Math.max(t, q.marketTime || q.fetchedAt || 0)
    return { state: 'offline', minutes: null, time: t || null }
  }
  let worst = null, closed = null, unknown = null
  for (const q of list) {
    const f = quoteFreshness(q, now)
    if (f.state === 'live' || f.state === 'delayed') { if (!worst || f.minutes > worst.minutes) worst = f }
    else if (f.state === 'closed') { if (!closed || f.time > closed.time) closed = f }
    else if (!unknown) unknown = f
  }
  return worst || closed || unknown || { state: 'loading', minutes: null, time: null }
}

// Corre tareas con un máximo de `limit` a la vez (sparks, resultados).
export async function runLimited(items, limit, fn) {
  const out = new Array(items.length)
  let i = 0
  const worker = async () => {
    while (i < items.length) {
      const k = i++
      try { out[k] = await fn(items[k], k) } catch { out[k] = null }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}
