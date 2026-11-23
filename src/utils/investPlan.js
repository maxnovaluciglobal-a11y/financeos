// src/utils/investPlan.js — Inversiones › Planificar (F5), puro.
//
// Tres piezas de Invest (inventario 04-planificar.md) más una nueva:
//  · Calculadora (Invest: app/lib/risk.js computeSizing / rMultiples /
//    concentrationAlternative y pbCalc en app/index.html:7713-7773): cuántas
//    unidades caben si arriesgas un % fijo del capital hasta el stop, con los
//    escenarios en múltiplos de R. Mismas fórmulas y redondeos (siempre hacia
//    abajo, cripto con 4 decimales). La conversión de moneda de pbCalc (C4)
//    vive en sizeInUsd: sin tipo de cambio no calcula (nunca 1:1).
//  · Aportes (Invest: renderCapital, CAP_LADDERS, repartoPorDesvio,
//    capImportFromPortfolio, cadencia). Se corrigen los errores del inventario
//    §C8/§7: no se reparte si los % no suman 100; el dinero de un tramo sin
//    media se reasigna a los otros tramos del mismo ticker (antes se perdía y
//    el total igual decía el monto completo); "pesos parejos" nunca da un
//    número negativo; los montos visibles suman exactamente el total.
//  · Planes guardados (Invest: inv_plans_<uid> en el navegador, 30 como
//    máximo, sin sincronizar). Aquí van en los metadatos de la cuenta
//    (invest_plans), con un tope de cantidad y de tamaño porque esos
//    metadatos viajan dentro del token de sesión.
//  · Proyección de aportes (nueva: Invest no tenía, inventario §"Proyecciones").
//    Interés compuesto mensual con un rendimiento anual que la persona elige.
//
// Todo en USD: el capital de referencia está en USD (profiles.capital).
import { sma, lastRsi } from './investIndicators.js'
import { roundTo100 } from './investRebalance.js'
import { num } from './investTrade.js'

// Un monto de dinero escrito a mano (capital, aporte mensual): "10.000" y
// "10,000" son diez mil (grupos de miles), no 10. Lo demás, como num().
export function amount(v) {
  const s = String(v ?? '').trim().replace(/\s/g, '')
  if (/^\d{1,3}(\.\d{3})+$/.test(s) || /^\d{1,3}(,\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ''))
  return num(v)
}

// ── Regla de riesgo ─────────────────────────────────────────────────────────
// Invest: 2 % por defecto (riskRulePct, index.html:2214). Decisión de Walter
// (20-nov-2026): un valor por defecto prudente, 1 %. La persona lo cambia.
export const DEFAULT_STOP_PCT = 0.08
export const DEFAULT_CONCENTRATION_LIMIT = 0.25
export const RISK_MIN = 0.1
export const RISK_MAX = 10
export const LIMIT_MIN = 5
export const LIMIT_MAX = 100

// ── Calculadora ─────────────────────────────────────────────────────────────
// Si la posición supera el límite de concentración sobre el capital: cuántas
// unidades enteras caben dentro del límite y el peso resultante. null si no.
export function concentrationAlternative(price, units, capital, limit = DEFAULT_CONCENTRATION_LIMIT) {
  if (!(price > 0) || !(capital > 0)) return null
  const weight = (price * units) / capital
  if (weight <= limit) return null
  const maxUnits = Math.floor((capital * limit) / price)
  return { weight, maxUnits, weightAtMax: (maxUnits * price) / capital, limit }
}

// Escenarios en múltiplos de R (R = entrada − stop): Stop, +1R, +2R, +3R.
export function rMultiples(entry, stop, units, multiples = [-1, 1, 2, 3]) {
  const r = entry - stop
  return multiples.map(m => ({ key: m === -1 ? 'stop' : `r${m}`, r: m, price: entry + m * r, pnl: m * r * units }))
}

// opts: { capital, riskPct (ej. 1), entry, stop?, limit?, fractional? }
export function computeSizing(opts = {}) {
  const capital = Number(opts.capital)
  const riskPct = opts.riskPct == null ? 1 : Number(opts.riskPct)
  const entry = Number(opts.entry)
  const limit = opts.limit == null ? DEFAULT_CONCENTRATION_LIMIT : opts.limit
  if (!(entry > 0)) return { error: 'no-entry' }
  if (!(capital > 0)) return { error: 'no-capital' }
  if (!(riskPct > 0)) return { error: 'no-risk' }
  let stop = Number(opts.stop)
  let stopIsEstimate = false
  if (!(stop > 0)) { stop = entry * (1 - DEFAULT_STOP_PCT); stopIsEstimate = true }
  if (stop >= entry) return { error: 'stop-not-below-price' }
  const perUnit = entry - stop
  const riskBudget = capital * (riskPct / 100)
  const raw = riskBudget / perUnit
  // Siempre hacia abajo: nunca arriesgar más que la regla.
  const units = opts.fractional ? Math.floor(raw * 1e4 + 1e-9) / 1e4 : Math.floor(raw + 1e-9)
  const exposure = units * entry
  const lossAtStop = units * perUnit
  return {
    entry, stop, stopIsEstimate, perUnitRisk: perUnit, riskBudget, units,
    exposure, exposurePct: exposure / capital, lossAtStop, lossPct: lossAtStop / capital,
    dropPct: perUnit / entry,
    concentration: concentrationAlternative(entry, units, capital, limit),
    rTable: rMultiples(entry, stop, units),
  }
}

// Ticker de cripto (Invest: termina en -USD): admite fracciones.
export const isFractional = (ticker) => /-USD$/.test(String(ticker || ''))

// "Si baja un X %": el stop en palabras de la vista esencial → precio de stop.
export function stopFromDrop(entry, dropPct) {
  const e = Number(entry), d = Number(dropPct)
  if (!(e > 0) || !(d > 0) || !(d < 100)) return null
  return e * (1 - d / 100)
}

// Calculadora con la moneda del activo (pbCalc, C4): entrada y stop en la
// moneda del activo; capital, exposición, pérdida y resultados en USD.
// fx = unidades de la moneda por 1 USD (1 para USD). Sin tasa → error no-fx.
export function sizeInUsd({ entry, stop, fx = 1, capital, riskPct, limit, ticker } = {}) {
  const e = Number(entry)
  const s = stop === '' || stop == null ? NaN : Number(stop)
  if (!(e > 0)) return { error: 'no-entry' }
  if (!(Number(fx) > 0)) return { error: 'no-fx' }
  const r = computeSizing({
    capital, riskPct, limit, fractional: isFractional(ticker),
    entry: e / fx, stop: s > 0 ? s / fx : undefined,
  })
  if (r.error) return r
  // Precios de vuelta en la moneda del activo; el stop estimado sale de la
  // entrada local (no de la conversión ida y vuelta).
  return {
    ...r,
    fx: Number(fx),
    entryLocal: e,
    stopLocal: r.stopIsEstimate ? e * (1 - DEFAULT_STOP_PCT) : s,
    rTable: r.rTable.map(x => ({ ...x, priceLocal: x.price * fx })),
  }
}

// ── Aportes ─────────────────────────────────────────────────────────────────
export const CADENCES = ['monthly', 'biweekly', 'weekly']
const CADENCE_DIV = { monthly: 1, biweekly: 26 / 12, weekly: 52 / 12 }
// Cuánto es cada aporte si el monto mensual se reparte en aportes más
// frecuentes. Solo informativo: el reparto se hace sobre el monto completo.
export function perContribution(monthly, cadence = 'monthly') {
  const m = Number(monthly)
  const d = CADENCE_DIV[cadence] || 1
  return m > 0 ? m / d : null
}

export const SUM_TOLERANCE = 0.5
export const pctSum = (alloc) => (alloc || []).reduce((s, a) => s + (Number(a.p) || 0), 0)
export const allocReady = (alloc) => (alloc || []).length > 0 && Math.abs(pctSum(alloc) - 100) <= SUM_TOLERANCE

const TICKER_RE = /^[A-Z0-9.\-^=]{1,15}$/
export const MAX_ALLOC = 20
// Agrega o reemplaza un ticker en el reparto. → { ok, alloc } o { ok:false, error }
export function addAlloc(alloc, ticker, pct) {
  const t = String(ticker || '').toUpperCase().trim()
  const p = Number(String(pct ?? '').replace(',', '.'))
  if (!t) return { ok: false, error: 'ticker_required' }
  if (!TICKER_RE.test(t)) return { ok: false, error: 'ticker_invalid' }
  if (!(p > 0 && p <= 100)) return { ok: false, error: 'pct_range' }
  const list = (alloc || []).filter(a => a.t !== t)
  if (list.length >= MAX_ALLOC) return { ok: false, error: 'too_many' }
  return { ok: true, alloc: [...list, { t, p: Math.round(p * 10) / 10 }] }
}

// Pesos parejos entre n tickers, enteros que suman 100 (Invest daba un
// número negativo con más de 100 posiciones: aquí nunca).
export function equalAlloc(tickers) {
  const list = [...new Set((tickers || []).filter(Boolean))].slice(0, MAX_ALLOC)
  const w = roundTo100(list.map(() => 1))
  return list.map((t, i) => ({ t, p: w[i] })).filter(a => a.p > 0)
}

// Reparto por desvío (repartoPorDesvio, C10): se aporta solo a lo que está más
// de 0,5 puntos bajo su objetivo, en proporción al desvío; si nada está
// debajo, en proporción al objetivo. Comprar para acercarse evita vender.
// base: rebalanceBase(rows) → [{ t, valueUsd }]. targets: { t: % } o null.
export function allocByDrift(base, targets) {
  const list = (base || []).filter(b => b.valueUsd > 0)
  const tot = list.reduce((a, b) => a + b.valueUsd, 0)
  if (!(tot > 0)) return []
  const rows = list.map(b => {
    const actual = (b.valueUsd / tot) * 100
    const tg = Number(targets?.[b.t])
    const objetivo = targets && targets[b.t] != null && Number.isFinite(tg) ? tg : actual
    return { t: b.t, actual, objetivo, desvio: objetivo - actual }
  })
  const under = rows.filter(r => r.desvio > SUM_TOLERANCE)
  const pick = under.length ? under : rows.filter(r => r.objetivo > 0)
  const sum = pick.reduce((a, r) => a + (under.length ? r.desvio : r.objetivo), 0)
  if (!(sum > 0)) return []
  const out = pick.map(r => ({ t: r.t, p: Math.round(((under.length ? r.desvio : r.objetivo) / sum) * 1000) / 10 }))
  // La diferencia del redondeo va al de mayor peso (suma exactamente 100).
  out.sort((a, b) => b.p - a.p)
  const diff = Math.round((100 - out.reduce((a, r) => a + r.p, 0)) * 10) / 10
  if (out.length && diff) out[0].p = Math.round((out[0].p + diff) * 10) / 10
  return out
}

// Reparte `total` en partes proporcionales a `weights` con centavos que suman
// exactamente el total (mayor resto).
export function splitCents(total, weights) {
  const cents = Math.round(Number(total) * 100)
  const w = (weights || []).map(x => (x > 0 ? x : 0))
  const sw = w.reduce((a, b) => a + b, 0)
  if (!(cents > 0) || !(sw > 0)) return w.map(() => 0)
  const exact = w.map(x => (x / sw) * cents)
  const fl = exact.map(Math.floor)
  let rest = cents - fl.reduce((a, b) => a + b, 0)
  const order = exact.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r || a.i - b.i)
  for (let k = 0; rest > 0; k++, rest--) fl[order[k % order.length].i]++
  return fl.map(c => c / 100)
}

// Reparto simple por ticker (vista esencial). → { ok, rows, total } o { ok:false, error }
export function splitAmount(amount, alloc) {
  const a = Number(amount)
  if (!(a > 0)) return { ok: false, error: 'amount_required' }
  if (!(alloc || []).length) return { ok: false, error: 'alloc_empty' }
  if (!allocReady(alloc)) return { ok: false, error: 'sum', sum: pctSum(alloc) }
  const parts = splitCents(a, alloc.map(x => Number(x.p)))
  return { ok: true, total: a, rows: alloc.map((x, i) => ({ t: x.t, p: Number(x.p), amount: parts[i] })) }
}

// Escaleras sobre las medias de 20, 50, 100 y 200 días (CAP_LADDERS).
export const LADDER_SMAS = [20, 50, 100, 200]
export const LADDERS = {
  even: [0.25, 0.25, 0.25, 0.25],
  long: [0.15, 0.20, 0.25, 0.40],
  half200: [0.10, 0.15, 0.25, 0.50],
}
// Nombres de Invest (cap_tk_<uid>_l) → los de aquí.
export const LEGACY_LADDERS = { short: 'even', mid: 'long', long: 'half200' }
export const MIN_CLOSES = 25

const lastOf = (arr) => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i]; return null }

// Lectura de una historia (cierres diarios de 1 año): precio de hoy (último
// cierre), cada media (null si faltan cierres) y RSI 14.
export function ladderReading(closes) {
  const c = (closes || []).map(Number).filter(v => v > 0)
  if (c.length < MIN_CLOSES) return null
  return {
    price: c[c.length - 1],
    smas: LADDER_SMAS.map(n => (c.length >= n ? lastOf(sma(c, n)) : null)),
    rsi: lastRsi(c),
  }
}

// Reparto por ticker y por tramo. readings: { t: ladderReading | null }.
// → { ok, total, rows: [{ t, p, amount, noHistory, rsi, price, reassigned,
//      tramos: [{ n, w, amount, sma, below }] }] }
// Un tramo sin media (pocos cierres) no recibe dinero y su parte se reasigna
// a los tramos con media del mismo ticker (reassigned: true). Sin historia
// suficiente, el monto del ticker queda entero, sin tramos.
export function ladderSplit(amount, alloc, readings = {}, ladder = 'even') {
  const base = splitAmount(amount, alloc)
  if (!base.ok) return base
  const w = LADDERS[ladder] || LADDERS.even
  const rows = base.rows.map(r => {
    const rd = readings[r.t]
    if (!rd) return { ...r, noHistory: true, rsi: null, price: null, reassigned: false, tramos: null }
    const avail = LADDER_SMAS.map((n, i) => (rd.smas[i] != null ? w[i] : 0))
    const parts = splitCents(r.amount, avail)
    return {
      ...r, noHistory: false, rsi: rd.rsi, price: rd.price,
      reassigned: avail.some(x => x === 0),
      tramos: LADDER_SMAS.map((n, i) => ({
        n, w: w[i], amount: rd.smas[i] != null ? parts[i] : null, sma: rd.smas[i],
        below: rd.smas[i] != null && rd.price <= rd.smas[i],
      })),
    }
  })
  return { ok: true, total: base.total, rows }
}

// ── Proyección de aportes ───────────────────────────────────────────────────
// Aporte al final de cada mes, rendimiento anual compuesto mensualmente:
// r_m = (1 + anual)^(1/12) − 1. Devuelve el valor al final de cada año.
export const PROJ_YEARS_MAX = 50
export const PROJ_RATE_MIN = -20
export const PROJ_RATE_MAX = 20
export const DEFAULT_PROJ = { years: 10, rate: 5 }

export function validateProjection({ monthly, years, rate, initial = 0 } = {}) {
  const fields = {}
  const m = Number(monthly), y = Number(years), r = Number(rate), i = Number(initial || 0)
  if (!(m > 0 && m <= 1e9)) fields.monthly = 'monthly_invalid'
  if (!(Number.isInteger(y) && y >= 1 && y <= PROJ_YEARS_MAX)) fields.years = 'years_range'
  if (!(Number.isFinite(r) && r >= PROJ_RATE_MIN && r <= PROJ_RATE_MAX)) fields.rate = 'rate_range'
  if (!(i >= 0 && i <= 1e12)) fields.initial = 'initial_invalid'
  return Object.keys(fields).length ? { ok: false, fields } : { ok: true, value: { monthly: m, years: y, rate: r, initial: i } }
}

export function projectContributions(input) {
  const v = validateProjection(input)
  if (!v.ok) return { ok: false, fields: v.fields }
  const { monthly, years, rate, initial } = v.value
  const rm = (1 + rate / 100) ** (1 / 12) - 1
  let value = initial
  const byYear = []
  for (let k = 1; k <= years * 12; k++) {
    value = value * (1 + rm) + monthly
    if (k % 12 === 0) byYear.push({ year: k / 12, value, put: initial + monthly * k })
  }
  const put = initial + monthly * years * 12
  return { ok: true, value, put, growth: value - put, byYear, ...v.value }
}

// ── Planes guardados ────────────────────────────────────────────────────────
// En los metadatos de la cuenta (auth.updateUser), que viajan en el token de
// sesión: pocos planes y compactos. MAX_PLANS_BYTES cubre los 20 con holgura
// (un plan de calculadora ronda los 130 bytes; uno de aportes con 10 tickers,
// unos 300).
export const PLANS_KEY = 'invest_plans'
export const PLANS_VERSION = 1
export const MAX_PLANS = 20
export const MAX_PLANS_BYTES = 6000
const NAME_MAX = 40
const ID_RE = /^p[a-z0-9]{4,20}$/

const fin = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : null }
const r6 = (n) => Math.round(n * 1e6) / 1e6

export function newPlanId(now = Date.now(), rnd = Math.random) {
  return `p${now.toString(36)}${Math.floor(rnd() * 36 ** 3).toString(36).padStart(3, '0')}`
}

// Un plan limpio o null si no sirve. Dos tipos:
//  · 'trade' (calculadora): t, ccy, entry, stop (null = estimado), units, cap, risk
//  · 'aporte' (aportes): m (mensual), cad, lad, alloc [{t,p}], yrs, rate
export function normalizePlan(p) {
  if (!p || typeof p !== 'object') return null
  const id = ID_RE.test(String(p.id || '')) ? String(p.id) : null
  const ts = fin(p.ts, 1e12, 1e14)
  if (!id || ts == null) return null
  const name = String(p.name ?? '').trim().slice(0, NAME_MAX)
  if (p.k === 'trade') {
    const t = String(p.t || '').toUpperCase()
    const entry = fin(p.entry, 1e-9, 1e12)
    const cap = fin(p.cap, 1e-9, 1e13)
    const risk = fin(p.risk, RISK_MIN, RISK_MAX)
    if (!TICKER_RE.test(t) || entry == null || cap == null || risk == null) return null
    const stop = p.stop == null ? null : fin(p.stop, 1e-9, entry - 1e-12)
    const ccy = /^[A-Z]{3}$/.test(String(p.ccy || '')) ? p.ccy : 'USD'
    const units = fin(p.units, 0, 1e12)
    return { id, k: 'trade', ts, name, t, ccy, entry: r6(entry), stop: stop == null ? null : r6(stop), units: units == null ? 0 : r6(units), cap: r6(cap), risk }
  }
  if (p.k === 'aporte') {
    const m = fin(p.m, 0.01, 1e9)
    if (m == null) return null
    const alloc = (Array.isArray(p.alloc) ? p.alloc : [])
      .map(a => ({ t: String(a?.t || '').toUpperCase(), p: fin(a?.p, 0.1, 100) }))
      .filter(a => TICKER_RE.test(a.t) && a.p != null).slice(0, MAX_ALLOC)
    const cad = CADENCES.includes(p.cad) ? p.cad : 'monthly'
    const lad = LADDERS[p.lad] ? p.lad : 'even'
    const yrs = fin(p.yrs, 1, PROJ_YEARS_MAX)
    const rate = fin(p.rate, PROJ_RATE_MIN, PROJ_RATE_MAX)
    return { id, k: 'aporte', ts, name, m: Math.round(m * 100) / 100, cad, lad, alloc, yrs: yrs == null ? DEFAULT_PROJ.years : Math.round(yrs), rate: rate == null ? DEFAULT_PROJ.rate : rate }
  }
  return null
}

export function readPlans(user) {
  const raw = user?.user_metadata?.[PLANS_KEY]
  const list = Array.isArray(raw?.list) ? raw.list : Array.isArray(raw) ? raw : []
  const seen = new Set()
  const out = []
  for (const p of list) {
    const n = normalizePlan(p)
    if (n && !seen.has(n.id)) { seen.add(n.id); out.push(n) }
  }
  return out.sort((a, b) => b.ts - a.ts).slice(0, MAX_PLANS)
}

export const plansPayload = (list) => ({ v: PLANS_VERSION, list })
export const plansBytes = (list) => new TextEncoder().encode(JSON.stringify(plansPayload(list))).length

// Lista lista para guardar: cada plan limpio, sin repetidos, el más nuevo
// primero, dentro de los topes. → { ok, list } o { ok:false, error }.
export function validatePlans(list) {
  const clean = []
  const seen = new Set()
  for (const p of list || []) {
    const n = normalizePlan(p)
    if (!n) return { ok: false, error: 'plan_invalid' }
    if (!seen.has(n.id)) { seen.add(n.id); clean.push(n) }
  }
  clean.sort((a, b) => b.ts - a.ts)
  if (clean.length > MAX_PLANS) return { ok: false, error: 'plans_full' }
  if (plansBytes(clean) > MAX_PLANS_BYTES) return { ok: false, error: 'plans_too_big' }
  return { ok: true, list: clean }
}

// Agrega o reemplaza (mismo id) un plan.
export function upsertPlan(list, plan) {
  const n = normalizePlan(plan)
  if (!n) return { ok: false, error: 'plan_invalid' }
  const rest = (list || []).filter(p => p.id !== n.id)
  return validatePlans([n, ...rest])
}

export function removePlan(list, id) {
  const i = (list || []).findIndex(p => p.id === id)
  if (i < 0) return { ok: false, error: 'not_found' }
  const next = [...list]
  const [gone] = next.splice(i, 1)
  return { ok: true, list: next, removed: gone, index: i }
}

// Deshacer un borrado: vuelve a su lugar (si todavía entra).
export function restorePlan(list, plan, index = 0) {
  if ((list || []).some(p => p.id === plan?.id)) return { ok: true, list }
  const next = [...(list || [])]
  next.splice(Math.min(index, next.length), 0, plan)
  return validatePlans(next)
}

// Plan de la calculadora a partir de un resultado de sizeInUsd.
export function tradePlanFrom({ ticker, ccy = 'USD', entry, stop, capital, risk, name = '' }, sized, { now = Date.now(), id = null } = {}) {
  return normalizePlan({
    id: id || newPlanId(now), k: 'trade', ts: now, name, t: ticker, ccy,
    entry: Number(entry), stop: sized?.stopIsEstimate ? null : Number(stop), units: sized?.units ?? 0,
    cap: Number(capital), risk: Number(risk),
  })
}

// Riesgo de un plan de calculadora en USD con la tasa de hoy (C5; Invest usa
// también la de hoy, no la del día del plan). fx: moneda por 1 USD.
export function planRisk(plan, fx = 1) {
  if (!plan || plan.k !== 'trade' || !(Number(fx) > 0)) return null
  const stop = plan.stop == null ? plan.entry * (1 - DEFAULT_STOP_PCT) : plan.stop
  const usd = (plan.units * (plan.entry - stop)) / fx
  return { usd, pct: plan.cap > 0 ? usd / plan.cap : null, stop, estimated: plan.stop == null }
}
