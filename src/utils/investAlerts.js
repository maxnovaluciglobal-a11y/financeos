// src/utils/investAlerts.js — alertas de precio de Inversiones (F4), lógica pura.
//
// Las alertas viven en el servidor (public.invest_alerts, RLS por cuenta) y las
// revisa la función programada invest-alerts-check, que avisa por push con la
// app cerrada (decisión de Walter, 20-nov-2026). Aquí está lo que la app
// necesita para crearlas y mostrarlas, con las mismas reglas que la función
// (alertLogic.test.ts compara las dos): cuándo se cumple una condición, cuánto
// falta, sugerencias de nivel y el traspaso desde la versión anterior de
// Inversiones (Invest: alertas Max/Min en el navegador, app/index.html 2344-2431).
// Sin DOM, sin red y sin textos.

export const ALERT_CONDITIONS = ['above', 'below', 'pct_move']
export const ALERT_LIMIT = 50 // el trigger invest_alerts_cap lo hace cumplir en la base
export const COOLDOWN_MS = 24 * 3600 * 1000
export const SYMBOL_RE = /^[\^A-Z0-9.=-]{1,15}$/
export const PCT_SUGGESTIONS = [3, 5, 10]

const toNum = (v) => {
  if (v == null || v === '') return NaN
  return typeof v === 'number' ? v : parseFloat(String(v).trim().replace(/\s/g, '').replace(',', '.'))
}
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

export const normSymbol = (s) => String(s ?? '').toUpperCase().trim()

// { symbol, condition, threshold } → { ok, value } o { ok: false, error, fields }.
export function validateAlert(input = {}) {
  const fields = {}
  const symbol = normSymbol(input.symbol)
  if (!symbol) fields.symbol = 'symbol_required'
  else if (!SYMBOL_RE.test(symbol)) fields.symbol = 'symbol_invalid'
  const condition = ALERT_CONDITIONS.includes(input.condition) ? input.condition : null
  if (!condition) fields.condition = 'condition_invalid'
  const threshold = toNum(input.threshold)
  if (!(threshold > 0) || threshold >= 1e12) fields.threshold = 'threshold_invalid'
  else if (condition === 'pct_move' && threshold > 100) fields.threshold = 'pct_invalid'
  if (Object.keys(fields).length) return { ok: false, error: 'invalid', fields }
  return { ok: true, value: { symbol, condition, threshold } }
}

// Misma regla que invest-alerts-check: nunca con un precio que falta.
export function conditionMet(condition, threshold, quote) {
  const price = Number(quote?.price)
  const lvl = Number(threshold)
  if (!(price > 0) || !(lvl > 0)) return false
  if (condition === 'above') return price >= lvl
  if (condition === 'below') return price <= lvl
  if (condition === 'pct_move') {
    const pct = Number(quote?.changePct)
    return Number.isFinite(pct) && Math.abs(pct) * 100 >= lvl
  }
  return false
}

// Estado para la pantalla. reached: la condición se cumple con el precio de
// ahora. gap (fracción): cuánto le falta al precio (Invest "Falta"):
// sube a → (nivel − precio)/precio, baja a → (precio − nivel)/precio. Para un
// movimiento del día, cuánto se movió hoy (moved, fracción con signo).
export function alertStatus(alert, quote, now = Date.now()) {
  const price = Number(quote?.price) > 0 ? Number(quote.price) : null
  const reached = price != null && conditionMet(alert.condition, alert.threshold, quote)
  const last = alert.lastTriggeredAt ? Date.parse(alert.lastTriggeredAt) : NaN
  const notifiedRecently = Number.isFinite(last) && now - last < COOLDOWN_MS
  let gap = null, moved = null
  if (price != null && !reached) {
    if (alert.condition === 'above') gap = (alert.threshold - price) / price
    else if (alert.condition === 'below') gap = (price - alert.threshold) / price
  }
  if (alert.condition === 'pct_move' && isNum(Number(quote?.changePct)) && quote?.changePct != null) moved = Number(quote.changePct)
  return { price, reached, gap, moved, notifiedRecently, lastTriggeredAt: Number.isFinite(last) ? last : null }
}

// Duplicado = mismo activo + misma condición + mismo nivel (Invest :2361).
export function isDuplicate(alerts, cand, exceptId = null) {
  return (alerts || []).some(a => a.id !== exceptId && a.symbol === normSymbol(cand.symbol) && a.condition === cand.condition && Number(a.threshold) === Number(cand.threshold))
}

// Niveles sugeridos según tus datos (Invest alSugerencias, :6747-6779): precio
// promedio (si lo tienes), mínimo de 52 semanas, −10 % y +10 % desde hoy. Solo
// por encima del precio para "sube a" y por debajo para "baja a"; se descartan
// los que distan menos de 0,5 % de otro ya elegido.
export function suggestLevels({ condition, price, avgCost = null, low52 = null, high52 = null } = {}) {
  if (condition === 'pct_move') return PCT_SUGGESTIONS.map(v => ({ kind: 'pct', value: v }))
  const p = Number(price)
  if (!(p > 0)) return []
  const cands = [
    { kind: 'cost', value: Number(avgCost) },
    { kind: condition === 'above' ? 'high52' : 'low52', value: Number(condition === 'above' ? high52 : low52) },
    { kind: condition === 'above' ? 'up10' : 'down10', value: condition === 'above' ? p * 1.1 : p * 0.9 },
  ]
  const out = []
  for (const c of cands) {
    if (!(c.value > 0)) continue
    if (condition === 'above' ? c.value <= p : c.value >= p) continue
    if (out.some(o => Math.abs(o.value - c.value) / o.value < 0.005)) continue
    out.push({ kind: c.kind, value: roundLevel(c.value) })
  }
  return out
}
// Redondeo de un nivel sugerido: 2 decimales, 4 bajo 1 (cripto chicas, FX).
export function roundLevel(v) {
  const n = Number(v)
  if (!(n > 0)) return null
  const d = n < 1 ? 4 : 2
  return Math.round(n * 10 ** d) / 10 ** d
}

// Fila de la tabla ⇄ forma de la app.
export function fromRow(r) {
  if (!r) return null
  return {
    id: r.id,
    symbol: normSymbol(r.symbol),
    condition: r.condition,
    threshold: Number(r.threshold),
    active: r.active !== false,
    lastTriggeredAt: r.last_triggered_at || null,
    createdAt: r.created_at || null,
  }
}

// Resumen de Alertas (Invest: En seguimiento · Alcanzadas · Activos).
export function alertsSummary(alerts, quotes = {}, now = Date.now()) {
  const list = alerts || []
  const active = list.filter(a => a.active)
  const reached = active.filter(a => alertStatus(a, quotes[a.symbol], now).reached).length
  return { total: list.length, active: active.length, paused: list.length - active.length, reached, assets: new Set(list.map(a => a.symbol)).size }
}

// Por activo, para la campana de Siguiendo y la ficha.
export function alertsBySymbol(alerts) {
  const m = new Map()
  for (const a of alerts || []) m.set(a.symbol, [...(m.get(a.symbol) || []), a])
  return m
}

// ── Traspaso desde la versión anterior de Inversiones ─────────────
// Invest guardaba las alertas en el navegador de invest.moyiq.app
// (localStorage ia_<uid>: [{ id, asset, type: 'Max'|'Min', trigger, … }]),
// otro origen: desde aquí no se pueden leer. Su copia de seguridad .json
// (exportBackup) hoy NO las incluye; si una versión futura las suma (clave
// `alerts`), este lector las acepta. También acepta la lista sola o el formato
// nuevo ({ symbol, condition, threshold }).
export function parseLegacyAlerts(input) {
  let data = input
  if (typeof data === 'string') {
    try { data = JSON.parse(data) } catch { return { ok: false, error: 'bad_json', items: [], skipped: 0 } }
  }
  const list = Array.isArray(data) ? data : Array.isArray(data?.alerts) ? data.alerts : null
  if (!list) {
    const looksLikeBackup = data && typeof data === 'object' && ('portfolio' in data || 'watchlist' in data || '_v' in data)
    return { ok: false, error: looksLikeBackup ? 'no_alerts_in_backup' : 'not_alerts', items: [], skipped: 0 }
  }
  const items = []
  let skipped = 0
  for (const a of list) {
    if (!a || typeof a !== 'object') { skipped++; continue }
    const condition = a.condition || (a.type === 'Max' ? 'above' : a.type === 'Min' ? 'below' : null)
    const v = validateAlert({ symbol: a.symbol ?? a.asset, condition, threshold: a.threshold ?? a.trigger })
    if (!v.ok || isDuplicate(items, v.value)) { skipped++; continue }
    items.push(v.value)
  }
  return { ok: true, items, skipped }
}
