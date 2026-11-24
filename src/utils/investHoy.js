// src/utils/investHoy.js — lógica pura de la pestaña Hoy de Inversiones (F2).
//
// Copias en ES modules de invest-web para que las dos apps den la misma cifra:
//  · quoteFreshness / summarizeFreshness: app/lib/readings.js (sin el texto:
//    la pantalla arma la frase en el idioma de la persona).
//  · computeRiskAtStop: app/lib/risk.js (−8 % estimado sin stop, límite 25 %).
//  · buildSeries, sliceRange, rebase, change, dayKey: app/lib/portfolio-history.js.
//  · niceStep: pvhNice de app/index.html.
//  · regimeOf, vixLevel: deGetRegime / deGetVIX de app/index.html.
// Y lo nuevo de moyiq:
//  · scoreCloses / reviewToday: "Para revisar hoy" con dos errores de Invest
//    corregidos (inventario 01, casos borde): sin tickers no cripto quedaba
//    "Calculando…" para siempre, y la cripto no entraba a las lecturas. Aquí
//    entra todo lo que tiene historia (la cripto con su par -USD) y, si no hay
//    nada que leer o todo falla, el estado lo dice.
//  · historyPlan / runLimited: los pedidos de historia de una visita a Hoy,
//    agrupados y sin repetir (Invest hacía ~50 con 20 posiciones; ver el test).
// Nada de esto toca la red, el DOM ni el almacenamiento.
import { sma, lastRsi, classifyTrend } from './investIndicators.js'

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const DAY = 86400

// ── Frescura de precios ───────────────────────────────────────────
// q: { marketTime, tradingStart, tradingEnd, fetchedAt } en ms.
// state: offline · closed · live (≤ 2 min) · delayed · unknown · loading.
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

// El peor caso entre los mercados abiertos; si no hay abiertos, el cierre más
// reciente; si no, lo que no informa retraso. Sin cotizaciones: loading.
export function summarizeFreshness(quotes, now = Date.now(), failed = false) {
  const list = (quotes || []).filter(Boolean)
  if (failed) {
    let last = 0
    for (const q of list) { const t = q.marketTime || q.fetchedAt || 0; if (t > last) last = t }
    return { state: 'offline', minutes: null, time: last || null }
  }
  let worst = null, closed = null, unknown = null
  for (const q of list) {
    const f = quoteFreshness(q, now, false)
    if (f.state === 'live' || f.state === 'delayed') { if (!worst || f.minutes > worst.minutes) worst = f }
    else if (f.state === 'closed') { if (!closed || f.time > closed.time) closed = f }
    else if (!unknown) unknown = f
  }
  return worst || closed || unknown || { state: 'loading', minutes: null, time: null }
}

// ── Riesgo al stop (risk.js) ──────────────────────────────────────
export const DEFAULT_STOP_PCT = 0.08
export const DEFAULT_CONCENTRATION_LIMIT = 0.25

// portfolio: [{ t, sh, cur, stop? }] en USD. capital: base del % (si > 0).
// estimateMissing (true por defecto): sin stop propio se estima con −8 % y la
// fila va marcada stopIsDefault; un stop sobre el precio se ignora. Con
// estimateMissing=false (la columna stop existe), sin stop la fila queda
// noStop, no suma al total y cuenta en noStopCount; un stop sobre el precio se
// respeta y da pérdida 0.
export function computeRiskAtStop(portfolio, capital, limit = DEFAULT_CONCENTRATION_LIMIT, { estimateMissing = true } = {}) {
  const list = portfolio || []
  const totalValue = list.reduce((s, h) => s + (h.sh || 0) * (h.cur || 0), 0)
  const base = capital > 0 ? capital : totalValue
  let totalRisk = 0, noStopCount = 0
  const rows = list.map((h) => {
    const value = (h.sh || 0) * (h.cur || 0)
    const weight = totalValue > 0 ? value / totalValue : 0
    const ownStop = h.stop != null && h.stop > 0 && (!estimateMissing || h.stop < h.cur)
    if (!ownStop && !estimateMissing) {
      noStopCount++
      return { id: h.id ?? null, t: h.t, value, weight, stop: null, stopIsDefault: false, noStop: true, riskAtStop: null, riskPctCapital: null, overLimit: weight > limit }
    }
    const stop = ownStop ? h.stop : h.cur * (1 - DEFAULT_STOP_PCT)
    const risk = Math.max(0, (h.cur - stop) * (h.sh || 0))
    totalRisk += risk
    return { id: h.id ?? null, t: h.t, value, weight, stop, stopIsDefault: !ownStop, noStop: false, riskAtStop: risk, riskPctCapital: base > 0 ? risk / base : 0, overLimit: weight > limit }
  })
  return { rows, totalValue, totalRisk, totalRiskPct: base > 0 ? totalRisk / base : 0, noStopCount, limit, base: capital > 0 ? 'capital' : 'portfolio' }
}

// La fila de mayor peso (para "Mayor peso: X con Y %").
export function heaviest(rs) {
  let top = null
  for (const r of rs?.rows || []) if (!top || r.weight > top.weight) top = r
  return top
}

// ── Para revisar hoy ──────────────────────────────────────────────
export const RSI_HIGH = 70
export const RSI_LOW = 30
export const REVIEW_MAX_CHIPS = 6

// Lectura de una serie de cierres (de más vieja a más nueva): tendencia contra
// la media de 50 (o menos si no hay 50 días) y la de 200 (solo con ≥ 200 días),
// y RSI (14) de Wilder redondeado. null sin al menos 2 cierres.
export function scoreCloses(closes) {
  const c = (closes || []).filter(isNum)
  if (c.length < 2) return null
  const last = c[c.length - 1]
  const s50 = sma(c, Math.min(50, c.length))[c.length - 1]
  const has200 = c.length >= 200
  const s200 = has200 ? sma(c, 200)[c.length - 1] : null
  const rsi = lastRsi(c, 14)
  return { last, s50, s200, has200, sig: classifyTrend(last, s50, s200), rsi: rsi == null ? null : Math.round(rsi) }
}

// holdings: [{ t }]; watch: ['T']; scores: { T: scoreCloses(...) | null } con
// los que ya terminaron (null = falló). pending: cuántos faltan.
// Devuelve { state, below, belowShort, rsiOut, failed }:
//  · state 'empty'  — no hay nada que leer (sin tickers): no se queda cargando.
//  · state 'loading'— todavía no llegó ninguno.
//  · state 'failed' — terminaron todos y ninguno tiene historia.
//  · state 'ready'  — al menos uno leído (los grupos pueden estar vacíos).
// below: posiciones bajo sus dos medias (con 200 días). belowShort: posiciones
// bajo su media de 50 sin 200 días de historia (Invest las mezclaba con el
// texto de "sus dos medias"). rsiOut: lo que tienes o sigues con RSI ≥ 70 o ≤ 30.
export function reviewToday({ holdings = [], watch = [], scores = {}, pending = 0 } = {}) {
  const inPort = new Set(holdings.map(h => h.t))
  const universe = [...new Set([...inPort, ...watch])]
  if (!universe.length) return { state: 'empty', below: [], belowShort: [], rsiOut: [], failed: [] }
  const done = universe.filter(t => t in scores)
  const ok = done.filter(t => scores[t])
  const failed = done.filter(t => !scores[t])
  if (!ok.length) {
    return { state: pending > 0 || done.length < universe.length ? 'loading' : 'failed', below: [], belowShort: [], rsiOut: [], failed }
  }
  const below = [], belowShort = [], rsiOut = []
  for (const t of universe) {
    const s = scores[t]
    if (!s) continue
    if (inPort.has(t) && s.sig === 'DOWN') (s.has200 ? below : belowShort).push({ t, ...s })
    if (s.rsi != null && (s.rsi >= RSI_HIGH || s.rsi <= RSI_LOW)) rsiOut.push({ t, ...s })
  }
  return { state: 'ready', below, belowShort, rsiOut, failed }
}

// ── Valor en el tiempo (portfolio-history.js) ─────────────────────
const pad = (n) => (n < 10 ? `0${n}` : `${n}`)
export function dayKey(ts) {
  const d = new Date(ts * 1000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}
const keyTs = (k) => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)) / 1000
const isWeekend = (k) => { const w = new Date(keyTs(k) * 1000).getUTCDay(); return w === 0 || w === 6 }

function byDay(rows) {
  const out = {}
  for (const r of rows || []) {
    const c = Number(r && r.close)
    if (r && Number.isFinite(r.ts) && Number.isFinite(c) && c > 0) out[dayKey(r.ts)] = c
  }
  return out
}
function filler(map) {
  const keys = Object.keys(map).sort()
  let i = 0, last = null
  return (k) => {
    while (i < keys.length && keys[i] <= k) { last = map[keys[i]]; i++ }
    return last
  }
}

// positions: [{ t, sh, ccy }]; histories: { t: [{ ts, close }] }; fxHist:
// { CCY: [{ ts, close }] } (CCY por 1 USD). fxNow: respaldo sin histórico.
// Serie = Σ unidades de HOY × cierre del día / tasa del día, desde el día en
// que todas tienen dato. Sin compras, ventas ni dividendos del período.
export function buildSeries(positions, histories, fxHist, { fxNow = {}, weekdaysOnly = false } = {}) {
  const included = [], missing = [], fxApprox = []
  const maps = []
  for (const p of positions || []) {
    const m = byDay(histories && histories[p.t])
    const keys = Object.keys(m)
    if (keys.length < 2 || !(p.sh > 0)) { missing.push(p.t); continue }
    const ccy = p.ccy || 'USD'
    let fxMap = null, rateNow = null
    if (ccy !== 'USD') {
      fxMap = byDay(fxHist && fxHist[ccy])
      if (!Object.keys(fxMap).length) {
        rateNow = Number(fxNow[ccy])
        if (!(Number.isFinite(rateNow) && rateNow > 0)) { missing.push(p.t); continue }
        if (!fxApprox.includes(ccy)) fxApprox.push(ccy)
        fxMap = null
      }
    }
    included.push(p.t)
    maps.push({ p, m, first: keys.sort()[0], fx: fxMap, fxFirst: fxMap ? Object.keys(fxMap).sort()[0] : null, rateNow })
  }
  if (!maps.length) return { points: [], included, missing, fxApprox }
  const start = maps.reduce((a, x) => (x.first > a ? x.first : a), '')
  const all = new Set()
  for (const x of maps) for (const k of Object.keys(x.m)) if (k >= start) all.add(k)
  let days = [...all].sort()
  if (weekdaysOnly) days = days.filter(k => !isWeekend(k))
  for (const x of maps) {
    x.px = filler(x.m)
    if (x.fx) { x.fxf = filler(x.fx); x.fxStart = x.fx[x.fxFirst] }
  }
  const points = []
  for (const k of days) {
    let v = 0, ok = true
    for (const x of maps) {
      const px = x.px(k)
      if (px == null) { ok = false; break }
      let r = 1
      if (x.fx) r = x.fxf(k) || x.fxStart
      else if (x.rateNow) r = x.rateNow
      v += (x.p.sh * px) / r
    }
    if (ok) points.push({ ts: keyTs(k), v })
  }
  return { points, included, missing, fxApprox }
}

// El último punto con los precios en vivo de la cifra de arriba (si TODAS las
// posiciones incluidas tienen precio): mismo día → se reemplaza; si no, se agrega.
// M7 (QA): las velas son días en UTC (medianoche UTC) y la pantalla las
// formatea en UTC. El punto "hoy" se ancla al día CALENDARIO LOCAL expresado
// igual (medianoche UTC de esa fecha): a las 23:00 en América ya no aparecía
// como "mañana" ("Nov 24" visto el 23-nov).
export function localDaySec(nowSec) {
  const d = new Date(nowSec * 1000)
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 1000
}
export function withLivePoint(points, liveUsd, nowSec = Math.floor(Date.now() / 1000)) {
  if (!points?.length || !(liveUsd > 0)) return points || []
  const out = points.slice()
  const last = out[out.length - 1]
  const today = localDaySec(nowSec)
  if (dayKey(today) === dayKey(last.ts)) out[out.length - 1] = { ...last, v: liveUsd }
  else if (today > last.ts) out.push({ ts: today, v: liveUsd })
  return out
}

export const PVH_RANGES = ['1M', '3M', 'YTD', '1A', 'MAX']
export const PVH_CMP = ['', 'SPY', 'ECH']
// M12 (QA): el índice de Chile (ECH) solo se ofrece a quien vive en Chile.
export const pvhCmpFor = (country) => PVH_CMP.filter(c => c !== 'ECH' || String(country || '').toUpperCase() === 'CL')
export const fetchRangeOf = (range) => (range === 'MAX' ? '5y' : '1y')

export function sliceRange(points, range, now) {
  if (!points || !points.length) return []
  const last = now || points[points.length - 1].ts
  let from
  if (range === '1M') from = last - 31 * DAY
  else if (range === '3M') from = last - 92 * DAY
  else if (range === 'YTD') from = Date.UTC(new Date(last * 1000).getUTCFullYear(), 0, 1) / 1000
  else if (range === '1A') from = last - 366 * DAY
  else from = -Infinity
  const out = points.filter(p => p.ts >= from)
  return out.length >= 2 ? out : points.slice(-2)
}

export function rebase(indexRows, points) {
  if (!points || !points.length) return []
  const f = filler(byDay(indexRows))
  let base = null
  return points.map((p) => {
    const c = f(dayKey(p.ts))
    if (c == null) return { ts: p.ts, v: null }
    if (base == null) base = c
    return { ts: p.ts, v: points[0].v * (c / base) }
  })
}

export function change(points) {
  const list = points || []
  const a = list.find(p => p.v != null)
  const b = [...list].reverse().find(p => p.v != null)
  if (!a || !b) return null
  return { from: a.v, to: b.v, abs: b.v - a.v, pct: a.v > 0 ? (b.v - a.v) / a.v : 0 }
}

// Paso "lindo" para 3-4 marcas del eje (1, 2, 2,5, 5 o 10 × 10^n).
export function niceStep(span) {
  const raw = span / 3
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)))
  const n = raw / mag
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag
}
export function axisTicks(values) {
  const vals = (values || []).filter(isNum)
  if (!vals.length) return { lo: 0, hi: 1, ticks: [] }
  let lo = Math.min(...vals), hi = Math.max(...vals)
  if (hi === lo) { hi = hi * 1.01 + 1; lo = lo * 0.99 }
  const step = niceStep(hi - lo)
  const y0 = Math.floor(lo / step) * step, y1 = Math.ceil(hi / step) * step
  const ticks = []
  for (let v = y0; v <= y1 + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6)
  return { lo: y0, hi: y1, ticks }
}

// Cursor del gráfico por teclado (←/→ un día, RePág/AvPág 10, Inicio/Fin,
// Escape lo saca). Devuelve el índice nuevo, null (sin cursor) o undefined (la
// tecla no es del gráfico).
export function cursorKey(key, cur, n) {
  if (!(n > 0)) return undefined
  const i = cur == null ? n - 1 : cur
  if (key === 'ArrowLeft') return Math.max(0, i - 1)
  if (key === 'ArrowRight') return Math.min(n - 1, i + 1)
  if (key === 'PageUp') return Math.max(0, i - 10)
  if (key === 'PageDown') return Math.min(n - 1, i + 10)
  if (key === 'Home') return 0
  if (key === 'End') return n - 1
  if (key === 'Escape') return null
  return undefined
}

// ── Contexto del mercado (régimen y VIX) ──────────────────────────
// SPY 1 año. Invest usaba una media "de 200" más corta si había menos de 200
// cierres; aquí, sin 200 cierres no hay régimen (no se dice algo que no es).
// risk_on: último y media 50 sobre la 200 y > 1 % sobre ella. risk_off: los
// dos bajo la 200. neutral: el resto.
export function regimeOf(closes) {
  const c = (closes || []).filter(isNum)
  if (c.length < 200) return null
  const last = c[c.length - 1]
  const s50 = sma(c, 50)[c.length - 1]
  const s200 = sma(c, 200)[c.length - 1]
  const pct200 = (last - s200) / s200
  let regime = 'neutral'
  if (last > s200 && s50 > s200 && pct200 > 0.01) regime = 'risk_on'
  else if (last < s200 && s50 < s200) regime = 'risk_off'
  return { regime, last, s50, s200, pct200 }
}
// < 15 baja · < 25 normal · < 35 elevada · ≥ 35 extrema.
export function vixLevel(v) {
  if (!isNum(v) || v <= 0) return null
  return v < 15 ? 'low' : v < 25 ? 'normal' : v < 35 ? 'high' : 'extreme'
}

// ── Pedidos de historia de una visita a Hoy ───────────────────────
// La cripto se pide a la fuente con su par en dólares (BTC → BTC-USD).
export function historySymbol(h) {
  const t = String(h?.t || '').toUpperCase()
  if (h?.type === 'Crypto' && !/-/.test(t)) return `${t}-USD`
  return t
}
// Moneda → par de Yahoo. Las submonedas (GBp, ZAc, ILA) usan la mayor × 100.
const MINOR = { GBp: 'GBP', ZAc: 'ZAR', ILA: 'ILS' }
export function fxSymbol(ccy) {
  if (!ccy || ccy === 'USD') return null
  const major = MINOR[ccy]
  return major ? { sym: `${major}=X`, mult: 100 } : { sym: `${String(ccy).toUpperCase()}=X`, mult: 1 }
}

// Qué pedir para pintar Hoy, sin repetir: { requests: [{ sym, range }], ... }.
//  · Una serie por activo (posiciones y lista): la de 1 año sirve al gráfico
//    (1M, 3M, YTD y 1A salen de ella) Y a "Para revisar hoy"; Máx pide 5 años
//    solo para las posiciones.
//  · Una serie por moneda distinta de USD (tipo de cambio de cada día).
//  · SPY 1 año: régimen y comparación a la vez. ECH solo si se compara.
//  · El VIX sale de la cinta (/api/marketbar), sin pedir su historia.
// Invest pedía además el ETF sectorial y SPY de 3 meses por cada ticker (que
// Hoy no muestra) y repetía la serie de cada posición.
export function historyPlan({ holdings = [], watch = [], ccys = [], range = '1A', cmp = '' } = {}) {
  const reqs = new Map()
  const add = (sym, r) => { if (sym) reqs.set(`${sym}|${r}`, { sym, range: r }) }
  for (const h of holdings) add(historySymbol(h), '1y')
  for (const t of watch) add(String(t).toUpperCase(), '1y')
  if (range === 'MAX') for (const h of holdings) add(historySymbol(h), '5y')
  for (const c of ccys) { const f = fxSymbol(c); if (f) add(f.sym, fetchRangeOf(range)) }
  add('SPY', '1y')
  if (cmp) add(cmp, fetchRangeOf(range))
  return [...reqs.values()]
}

// Corre tareas con un tope de concurrencia; cada resultado en su lugar.
// keepGoing() se revisa antes de cada tarea: si la corrida se canceló (cambió
// el plan o se desmontó la pantalla), los workers dejan de tomar tareas.
export async function runLimited(tasks, limit = 4, keepGoing = () => true) {
  const out = new Array(tasks.length)
  let next = 0
  async function worker() {
    while (next < tasks.length && keepGoing()) {
      const i = next++
      try { out[i] = await tasks[i]() } catch { out[i] = null }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
  return out
}

// ── Las 5 posiciones de mayor peso ────────────────────────────────
// rows: holdingRows (valuation); risk: computeRiskAtStop sobre las mismas
// posiciones (por id). Sin tipo de cambio (valueUsd null) no entran.
export function topPositions(rows, risk, n = 5) {
  const byId = new Map((risk?.rows || []).map((r, i) => [r.id ?? `#${i}`, r]))
  return (rows || [])
    .filter(r => r.valueUsd != null)
    .slice()
    .sort((a, b) => b.valueUsd - a.valueUsd)
    .slice(0, n)
    .map(r => ({ ...r, risk: byId.get(r.id) || null }))
}

// ── Aporte del mes ────────────────────────────────────────────────
// Mismo criterio que aporteGo de Invest: vacío → 'empty'; ≤ 0 o no número →
// 'invalid'; si no, redondeado a centavos. Tope 1e13 (handoff.js).
export function validateAporte(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return { ok: false, error: 'empty' }
  const v = parseFloat(s.replace(/\s/g, '').replace(',', '.'))
  if (!(Number.isFinite(v) && v > 0 && v <= 1e13)) return { ok: false, error: 'invalid' }
  return { ok: true, value: Math.round(v * 100) / 100 }
}
// USD del aporte: el que trae la tasa con fecha de moyiq o el monto si ya es
// USD. Sin tasa, null (nunca 1:1). handoff.js: aporteUsd.
export function aporteUsd(a, toUsd = null) {
  if (!a) return null
  if (a.usd > 0) return a.usd
  if (a.ccy === 'USD') return a.amount
  const v = a.ccy && toUsd ? toUsd(a.amount, a.ccy) : null
  return v > 0 ? v : null
}
// Cuánto de lo marcado este mes falta registrar como depósito (ledger.js:
// aportePending): sin esto, entrar dos veces contaría el mismo dinero dos veces.
export function aportePending(a, ops, month) {
  if (!a) return null
  const ccy = a.ccy || (a.usd > 0 ? 'USD' : null)
  if (!ccy) return null
  const amount = a.ccy ? Number(a.amount) || 0 : Number(a.usd) || 0
  const done = (ops || []).reduce((s, t) => {
    const same = t.type === 'deposit' && t.source === 'moyiq' && (t.currency || 'USD') === ccy && String(t.date || '').startsWith(month)
    return same ? s + (Number(t.amount) || 0) : s
  }, 0)
  return { amount: Math.max(0, amount - done), ccy }
}

// ── Cinta de mercado ──────────────────────────────────────────────
// Los 10 instrumentos de la cinta de Invest (MKT_SYMS); el VIX va aparte.
export const STRIP_SYMS = ['^GSPC', '^DJI', '^IXIC', '^RUT', 'CL=F', 'GC=F', 'SI=F', 'EURUSD=X', '^TNX', 'BTC-USD']
export const VIX_SYM = '^VIX'
// Degradados laterales de la cinta (Invest: stripFade): a la izquierda si ya
// se desplazó, a la derecha si queda contenido por ver. 2 px de tolerancia.
export function stripFadeOf(el) {
  if (!el) return { l: false, r: false }
  const max = (Number(el.scrollWidth) || 0) - (Number(el.clientWidth) || 0)
  const x = Number(el.scrollLeft) || 0
  return { l: x > 2, r: max > 2 && x < max - 2 }
}
// Cómo se escribe cada valor (mktFmtValue): 'fx4' EUR/USD con 4 decimales,
// 'yield' el bono en %, 'usd0' Bitcoin sin decimales, 'usd2' materias primas,
// 'index' índices (≥ 1000 sin decimales).
export function stripFormat(sym, price) {
  if (sym === 'EURUSD=X') return { kind: 'fx4', decimals: 4 }
  if (sym === '^TNX') return { kind: 'yield', decimals: 2 }
  if (sym === 'BTC-USD') return { kind: 'usd', decimals: 0 }
  if (sym === 'CL=F' || sym === 'GC=F' || sym === 'SI=F') return { kind: 'usd', decimals: 2 }
  return { kind: 'index', decimals: Math.abs(price) >= 1000 ? 0 : 2 }
}
