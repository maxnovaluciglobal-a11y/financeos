// src/pages/Dashboard/dashboardModel.js — lógica pura del Inicio (M5), sin React.
// Responde las tres preguntas del mockup M5: ¿cuánto me queda? (variación de
// los KPIs vs. el mes anterior), ¿en qué me estoy pasando? (presupuesto por
// categoría) y ¿qué viene? (próximos pagos). Testeado en dashboardModel.test.js.

import { localDateStr } from '../../utils/index.js'

// ── Variación vs. mes anterior ───────────────────────────────────────────────
// null = no hay base para comparar (el mes anterior no tiene datos o su valor es
// 0) → la línea no se muestra. |Δ| < 0.5 % cuenta como "igual".
// `invert`: en Gastos bajar es lo bueno.
export function monthDelta(cur, prev, { invert = false, hasPrev = true } = {}) {
  const c = Number(cur) || 0
  const p = Number(prev) || 0
  if (!hasPrev || p === 0) return null
  const pct = ((c - p) / Math.abs(p)) * 100
  if (Math.abs(pct) < 0.5) return { dir: 'flat', pct: 0, good: null }
  const dir = pct > 0 ? 'up' : 'down'
  const good = invert ? dir === 'down' : dir === 'up'
  return { dir, pct, good }
}

export function prevMonthOf(month) {
  const [y, m] = String(month).split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

// Nombre del mes ("septiembre", "September") en el idioma de la interfaz.
export function monthName(month, lang = 'es') {
  const [y, m] = String(month).split('-').map(Number)
  if (!y || !m) return ''
  try { return new Date(y, m - 1, 1).toLocaleDateString(lang, { month: 'long' }) }
  catch { return '' }
}

// "−6 %" / "+12 %" con el formato de porcentaje del idioma y signo menos real.
export function fmtSignedPct(pct, lang = 'es') {
  const n = Math.round(Math.abs(Number(pct) || 0))
  let s
  try { s = new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 0 }).format(n / 100) }
  catch { s = `${n}%` }
  return `${pct < 0 ? '−' : '+'}${s}`
}

// ── Presupuesto por categoría ────────────────────────────────────────────────
// ok < 85 % · near 85–100 % · over > 100 %.
export const BUDGET_NEAR = 0.85

export function budgetState(spent, limit) {
  const l = Number(limit) || 0
  const s = Number(spent) || 0
  if (l <= 0) return s > 0 ? 'over' : 'ok'
  const r = s / l
  return r > 1 ? 'over' : r >= BUDGET_NEAR ? 'near' : 'ok'
}

// Filas ordenadas por riesgo (proporción gastada, de mayor a menor). `limits`
// = límites efectivos por categoría (utils/budgets.js, honra el rollover).
export function budgetRows({ budgets, monthExpenses, limits = {} }) {
  const spentByCat = {}
  for (const e of monthExpenses || []) {
    if (!e || e.inv) continue
    spentByCat[e.category] = (spentByCat[e.category] || 0) + (Number(e.amount) || 0)
  }
  return (Array.isArray(budgets) ? budgets : [])
    .filter(b => b && b.category)
    .map(b => {
      const limit = Number(limits[b.category] ?? b.limit) || 0
      const spent = spentByCat[b.category] || 0
      const ratio = limit > 0 ? spent / limit : (spent > 0 ? Infinity : 0)
      return { id: b.id ?? b.category, category: b.category, spent, limit, ratio, state: budgetState(spent, limit) }
    })
    .sort((a, b) => b.ratio - a.ratio || b.spent - a.spent)
}

// ── Próximos pagos ───────────────────────────────────────────────────────────
// Fechas en hora LOCAL (B1): nunca toISOString(). Una fecha 'YYYY-MM-DD' se
// arma con new Date(y, m-1, d) para que no se corra un día en LatAm.
function parseLocalDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''))
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function addMonthsClamped(date, n, anchorDay) {
  const y = date.getFullYear(), mo = date.getMonth() + n
  const last = new Date(y, mo + 1, 0).getDate()
  return new Date(y, mo, Math.min(anchorDay, last))
}

// Siguiente ocurrencia >= hoy de una fecha que se repite cada `months` meses
// (o cada 7 días si `weekly`). Si la fecha guardada ya es futura, es esa.
export function nextOccurrence(dateStr, todayDate, { months = 1, weekly = false } = {}) {
  const base = parseLocalDate(dateStr)
  if (!base) return null
  const t0 = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate())
  if (base >= t0) return base
  if (weekly) {
    const diff = Math.ceil((t0 - base) / (7 * 86400000))
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + diff * 7)
    return d < t0 ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7) : d
  }
  const anchor = base.getDate()
  let d = base
  for (let i = 1; i <= 600 && d < t0; i++) d = addMonthsClamped(base, i * months, anchor)
  return d
}

const SUB_MONTHS = { monthly: 1, quarterly: 3, annual: 12, anual: 12 }

// Mezcla cuotas de deudas (dueDate, se repite cada mes) y cobros de
// suscripciones activas (nextPaymentDate, según su frecuencia) dentro de los
// próximos `days` días, ordenados por fecha. Devuelve { items, total }.
export function upcomingPayments({ debts, subscriptions, today = new Date(), days = 30, limit = 5 }) {
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const end = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + days)
  const out = []

  for (const d of Array.isArray(debts) ? debts : []) {
    const balance = Number(d?.balance) || 0
    const min = Number(d?.minPayment) || 0
    if (!d?.dueDate || balance <= 0 || min <= 0) continue
    const when = nextOccurrence(d.dueDate, t0)
    if (!when || when > end) continue
    out.push({ id: `debt-${d.id}`, kind: 'debt', name: d.creditor || '', amount: Math.min(min, balance), date: localDateStr(when) })
  }

  for (const s of Array.isArray(subscriptions) ? subscriptions : []) {
    if (!s || s.status !== 'active' || !s.nextPaymentDate) continue
    const freq = s.frequency || 'monthly'
    const when = nextOccurrence(s.nextPaymentDate, t0, freq === 'weekly' ? { weekly: true } : { months: SUB_MONTHS[freq] || 1 })
    if (!when || when > end) continue
    out.push({ id: `sub-${s.id}`, kind: 'sub', name: s.name || '', amount: Number(s.amount) || 0, date: localDateStr(when) })
  }

  out.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount)
  return { items: out.slice(0, limit), total: out.length }
}

// ── Historiales mensuales (IQ Score y patrimonio) ────────────────────────────
// fos_score_history guarda semanas ({ w: '2026-W40', s }); las entradas nuevas
// llevan también la fecha local (d). Para las viejas sin `d`, el mes se estima
// desde el número de semana (mismo cálculo con el que se generó).
export function weekToMonth(w) {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(String(w || ''))
  if (!m) return null
  const y = Number(m[1]), n = Number(m[2])
  // Inverso de Dashboard: n = ceil((díaDelAño + díaSemana(1-ene) + 1) / 7) →
  // primer día de esa semana. Una semana partida entre dos meses cae en el primero.
  const dow = new Date(y, 0, 1).getDay()
  const d = new Date(y, 0, 1 + Math.max(0, (n - 1) * 7 - dow))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Último valor registrado en un mes ANTERIOR a `month`, o null.
export function lastValueBefore(history, month, { monthOf, valueOf }) {
  let best = null
  for (const e of Array.isArray(history) ? history : []) {
    const m = monthOf(e)
    if (!m || m >= month) continue
    if (!best || m >= best.m) best = { m, v: valueOf(e) }
  }
  return best
}

export function prevMonthScore(history, month) {
  return lastValueBefore(history, month, {
    monthOf: e => (e?.d ? String(e.d).slice(0, 7) : weekToMonth(e?.w)),
    valueOf: e => Number(e?.s),
  })
}

// Patrimonio: una entrada por mes ({ m: '2026-10', v }), se pisa la del mes en
// curso y se conservan las últimas 13.
export function upsertMonthly(history, month, value, keep = 13) {
  const arr = (Array.isArray(history) ? history : []).filter(e => e && e.m !== month)
  arr.push({ m: month, v: value })
  return arr.sort((a, b) => a.m.localeCompare(b.m)).slice(-keep)
}

// ── Siguiente paso del IQ Score ──────────────────────────────────────────────
// Página donde se trabaja cada factor del score (weakestFactor de financialScore.js).
export const FACTOR_PAGE = {
  cashFlow: 'budgets',
  emergencyCushion: 'goals',
  debtLoad: 'debts',
  goalsProgress: 'goals',
  dataConsistency: 'movements',
}
