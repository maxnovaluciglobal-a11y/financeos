// @ts-check
// src/utils/ahead.js — lo que viene (24-nov-2026: cuotas, próximos meses y tarjetas).
//
// Lógica PURA, sin React ni IndexedDB (tests en ahead.test.js). Solo la usan
// pantallas diferidas (Fijos, Suscripciones, Deudas y la escena del Inicio):
// nada de esto entra al JS inicial (scripts/bundleBudget.js).
//
//   - Cuotas "4 de 12": las deudas ya guardan `totalInstallments` y
//     `paidInstallments` (la cuota siguiente es paid + 1). Un fijo manual puede
//     llevar `installments: { total, before }` (opcional; sin él no hay
//     etiqueta): `before` son las cuotas pagadas antes de que existiera la
//     regla, y la cuota de una ocurrencia es before + su número desde el inicio.
//   - Proyección de los próximos meses (12 por defecto) de lo comprometido:
//     gastos fijos, suscripciones y cuotas de deudas. El mes en curso sale de
//     monthPlan (pagado / por pagar / vencido); los siguientes, del calendario
//     de cada regla. Una deuda deja de proyectarse al terminar sus cuotas o su
//     saldo (con la misma tasa mensual que "Registrar pago").
//   - ✓ "pagado este mes" de una regla.
//   - Tarjeta de crédito (deuda de tipo Tarjeta, datos manuales): facturado
//     del período, cupo usado y disponible, fecha de pago y si está vencida.

import { isActiveRule, monthOf, monthPlan } from './recurring.js'
import { monthlyRate } from './debtPayment.js'

// Fechas locales: copias chicas de las de recurring.js. Importarlas obligaba a
// la entrada a exportar símbolos nuevos (bytes en el JS inicial).
const pad = (n) => String(n).padStart(2, '0')
function parseYMD(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').slice(0, 10))
  if (!m) return null
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
  return mo < 1 || mo > 12 || d < 1 || d > 31 ? null : { y, m: mo, d }
}
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`
const daysInMonth = (y, m) => new Date(y, m, 0).getDate()
function addMonthsYM(ym, n) {
  const [y, m] = String(ym).split('-').map(Number)
  const idx = y * 12 + (m - 1) + n
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`
}
const firstOf = (ym) => `${ym}-01`
// Fechas del calendario de una regla en un mes (inicio/fin incluidos, sin
// mirar pausa). Sale de monthPlan, que la entrada ya exporta: importar
// occurrencesInMonth la obligaba a exportar un símbolo más. Las ocurrencias
// omitidas (rule.skipped) no son cuotas: no se cuentan.
const occDates = (rule, ym) => monthPlan([{ ...rule, paused: false }], ym).filter(o => o.status !== 'skipped').map(o => o.date)
function diffDays(a, b) {
  const pa = parseYMD(a), pb = parseYMD(b)
  if (!pa || !pb) return NaN
  return Math.round((new Date(pb.y, pb.m - 1, pb.d) - new Date(pa.y, pa.m - 1, pa.d)) / 86400000)
}

export const PROJECTION_MONTHS = 12
const MAX_MONTHS_SCAN = 600
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const posInt = (v) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? n : 0 }

// ── Cuotas ──────────────────────────────────────────────────────────────────
/** Datos de cuotas de un fijo manual, o null. @param {any} rule */
export function ruleInstallments(rule) {
  const total = posInt(rule?.installments?.total)
  if (!total) return null
  return { total, before: Math.min(total, posInt(rule?.installments?.before)) }
}

/** Número de la ocurrencia `date` contando desde el inicio de la regla (1 = la primera). @param {any} rule @param {string} date */
export function occurrenceOrdinal(rule, date) {
  if (!rule || !parseYMD(date)) return 0
  const start = parseYMD(rule.startDate) ? rule.startDate : date
  let ym = monthOf(start)
  const end = monthOf(date)
  let n = 0
  for (let i = 0; i < MAX_MONTHS_SCAN && ym <= end; i++, ym = addMonthsYM(ym, 1)) {
    for (const d of occDates(rule, ym)) if (d <= date) n++
  }
  return n
}

/** "4 de 12" de una ocurrencia de un fijo manual: { n, total } o null. @param {any} rule @param {string} date */
export function ruleInstallmentAt(rule, date) {
  const inst = ruleInstallments(rule)
  if (!inst) return null
  const ord = occurrenceOrdinal(rule, date)
  if (!ord) return null
  const n = inst.before + ord
  return n <= inst.total ? { n, total: inst.total } : null
}

/** Fecha de la última cuota de un fijo manual (para su fecha de término), o null. @param {any} rule */
export function lastInstallmentDate(rule) {
  const inst = ruleInstallments(rule)
  if (!inst || !parseYMD(rule?.startDate)) return null
  const left = inst.total - inst.before
  if (left <= 0) return null
  let ym = monthOf(rule.startDate)
  let n = 0
  const open = { ...rule }
  delete open.endDate
  for (let i = 0; i < MAX_MONTHS_SCAN; i++, ym = addMonthsYM(ym, 1)) {
    for (const d of occDates(open, ym)) { n++; if (n === left) return d }
  }
  return null
}

/**
 * Fecha de término al guardar un fijo con cuotas. La fecha automática (la de
 * la última cuota) se recalcula cuando cambian las cuotas, el inicio o el
 * calendario; una fecha escrita a mano se respeta. `endInput` es lo que quedó
 * en el campo "Termina"; si es la fecha automática anterior sin tocar, cuenta
 * como automática. Sin cuotas, la fecha automática anterior se borra.
 * @param {any} prev regla antes de editar (o null) @param {any} next regla nueva @param {string} endInput
 * @returns {{ endDate: string | null, autoEnd: boolean }}
 */
export function resolveInstallmentEnd(prev, next, endInput) {
  const typed = String(endInput || '')
  const prevAuto = !!(prev && ruleInstallments(prev) && prev.endDate
    && (prev.installments?.autoEnd || prev.endDate === lastInstallmentDate(prev)))
  if (typed && !(prevAuto && typed === prev.endDate)) return { endDate: typed, autoEnd: false }
  const d = ruleInstallments(next) ? lastInstallmentDate(next) : null
  return d ? { endDate: d, autoEnd: true } : { endDate: null, autoEnd: false }
}

/** Cuota k-ésima por pagar de una deuda (k = 0 la siguiente): { n, total } o null. @param {any} debt @param {number} k */
export function debtInstallmentAt(debt, k = 0) {
  const total = posInt(debt?.totalInstallments)
  if (!total) return null
  const n = Math.min(total, posInt(debt?.paidInstallments)) + 1 + Math.max(0, k)
  return n <= total ? { n, total } : null
}

/** Cuota recién pagada de una deuda (la última contada): { n, total } o null. @param {any} debt */
export function debtLastPaidInstallment(debt) {
  const total = posInt(debt?.totalInstallments)
  const paid = Math.min(total, posInt(debt?.paidInstallments))
  return total && paid ? { n: paid, total } : null
}

// ── Pagado este mes ─────────────────────────────────────────────────────────
// Estado del mes de una regla en un plan de monthPlan: 'paid' (todas sus
// ocurrencias del mes confirmadas u omitidas, y al menos una confirmada),
// 'overdue' (alguna prevista con fecha pasada), 'pending' o null (no ocurre).
/** @param {string} ruleId @param {any[]} plan @param {string} today */
export function monthStatusOf(ruleId, plan, today) {
  const occ = (plan || []).filter(o => o && o.ruleId === ruleId)
  if (!occ.length) return null
  const pending = occ.filter(o => o.status === 'pending')
  if (pending.some(o => today && o.date < today)) return 'overdue'
  if (pending.length) return 'pending'
  return occ.some(o => o.status === 'confirmed') ? 'paid' : null
}

// ── Proyección ──────────────────────────────────────────────────────────────
const SOURCES = ['manual', 'subscription', 'debt']
const sourceOf = (rule) => (SOURCES.includes(rule?.source) ? rule.source : 'manual')

/**
 * Lo comprometido de los próximos `months` meses (el mes en curso incluido).
 * @param {{ rules?: any[], debts?: any[], incomes?: any[], expenses?: any[], today: string, months?: number, personalOnly?: boolean }} opts
 */
export function projectCommitments({ rules = [], debts = [], incomes = [], expenses = [], today, months = PROJECTION_MONTHS, personalOnly = true }) {
  const ym0 = monthOf(today)
  const list = (Array.isArray(rules) ? rules : []).filter(r => r && r.id && r.kind === 'expense' && !(personalOnly && r.inv))
  const debtById = new Map((Array.isArray(debts) ? debts : []).filter(d => d && d.id).map(d => [d.id, d]))
  // Saldo y cuotas que quedan de cada deuda, consumidos en orden de fecha.
  const debtState = new Map()
  const stateOf = (rule) => {
    if (debtState.has(rule.id)) return debtState.get(rule.id)
    const debt = debtById.get(rule.sourceId)
    const total = posInt(debt?.totalInstallments)
    const st = debt ? {
      debt, balance: Math.max(0, Number(debt.balance) || 0), r: monthlyRate(debt),
      left: total ? Math.max(0, total - Math.min(total, posInt(debt.paidInstallments))) : Infinity, k: 0, lastYm: null,
    } : null
    debtState.set(rule.id, st)
    return st
  }
  // Devuelve el monto de la cuota (acotado al saldo) o null si ya no hay deuda.
  // El interés es mensual: se suma una vez por mes, no por ocurrencia (una
  // regla semanal o quincenal tiene varias en el mismo mes).
  const takeDebt = (rule, expected, ym) => {
    const st = stateOf(rule)
    if (!st) return { amount: expected, installment: null }
    if (st.left <= 0 || st.balance <= 0.005) return null
    if (st.lastYm !== ym) { st.balance *= 1 + st.r; st.lastYm = ym }
    const owed = st.balance
    const amount = round2(Math.min(expected, owed))
    st.balance = Math.max(0, owed - amount)
    st.left -= 1
    const installment = debtInstallmentAt(st.debt, st.k)
    st.k += 1
    return { amount, installment }
  }

  const out = []
  for (let i = 0; i < Math.max(1, months); i++) {
    const ym = addMonthsYM(ym0, i)
    const items = []
    const push = (rule, date, amount, status, installment) => items.push({
      key: `${rule.id}|${date}`, ruleId: rule.id, name: rule.description, source: sourceOf(rule),
      date, amount: round2(amount), status, installment: installment || null,
    })
    if (i === 0) {
      const plan = monthPlan(list, ym, { incomes, expenses, today })
      for (const o of plan) {
        if (o.status === 'skipped') continue
        if (o.status === 'confirmed') {
          const inst = o.rule.source === 'debt' ? null : ruleInstallmentAt(o.rule, o.date)
          push(o.rule, o.date, o.amount, 'paid', inst)
          continue
        }
        let amount = o.amount, inst = null
        if (o.rule.source === 'debt') {
          const d = takeDebt(o.rule, o.amount, ym)
          if (!d) continue
          amount = d.amount; inst = d.installment
        } else inst = ruleInstallmentAt(o.rule, o.date)
        if (ruleInstallments(o.rule) && !inst) continue
        push(o.rule, o.date, amount, o.date < today ? 'overdue' : 'pending', inst)
      }
      // Cuota ya pagada este mes: "n de N" es la última contada.
      for (const it of items) {
        if (it.status !== 'paid' || it.source !== 'debt') continue
        const rule = list.find(r => r.id === it.ruleId)
        const debt = rule && debtById.get(rule.sourceId)
        it.installment = debt ? debtLastPaidInstallment(debt) : null
      }
    } else {
      const first = firstOf(ym)
      const active = list.filter(rule => isActiveRule(rule, first))
      // monthPlan da fechas, monto esperado (según el modo de la regla) y si
      // algo ya se pagó por adelantado.
      for (const o of monthPlan(active, ym, { incomes, expenses, today })) {
        if (o.status === 'skipped') continue
        const rule = o.rule
        if (o.status === 'confirmed') { push(rule, o.date, o.amount, 'paid', rule.source === 'debt' ? null : ruleInstallmentAt(rule, o.date)); continue }
        if (rule.source === 'debt') {
          const d = takeDebt(rule, o.amount, ym)
          if (!d) continue
          push(rule, o.date, d.amount, 'pending', d.installment)
        } else {
          const inst = ruleInstallmentAt(rule, o.date)
          if (ruleInstallments(rule) && !inst) continue
          push(rule, o.date, o.amount, 'pending', inst)
        }
      }
    }
    items.sort((a, b) => a.date.localeCompare(b.date) || String(a.name).localeCompare(String(b.name)))
    const bySource = { manual: 0, subscription: 0, debt: 0 }
    let total = 0, paid = 0
    for (const it of items) {
      total += it.amount
      bySource[it.source] += it.amount
      if (it.status === 'paid') paid += it.amount
    }
    out.push({
      ym, items, total: round2(total), paid: round2(paid), pending: round2(total - paid),
      bySource: { manual: round2(bySource.manual), subscription: round2(bySource.subscription), debt: round2(bySource.debt) },
    })
  }
  return out
}

/** Totales de la proyección: suma, mes más alto y cuotas que terminan en el horizonte. @param {ReturnType<typeof projectCommitments>} months */
export function projectionSummary(months) {
  const list = Array.isArray(months) ? months : []
  const total = round2(list.reduce((s, m) => s + m.total, 0))
  const peak = list.reduce((best, m) => (!best || m.total > best.total ? m : best), null)
  const lastSeen = new Map()
  for (const m of list) for (const it of m.items) if (it.installment) lastSeen.set(it.ruleId, it)
  const ending = [...lastSeen.values()].filter(it => it.installment.n === it.installment.total)
    .map(it => ({ ruleId: it.ruleId, name: it.name, date: it.date }))
  return { total, average: list.length ? round2(total / list.length) : 0, peak, ending }
}

// ── Tarjetas de crédito ─────────────────────────────────────────────────────
export const isCreditCard = (debt) => !!debt && (debt.debtType || 'Tarjeta') === 'Tarjeta'

// Fecha de pago de la tarjeta en el mes `ym`: el día de `dueDate`.
function dueDateIn(debt, ym) {
  const p = parseYMD(debt?.dueDate)
  if (!p) return null
  const [y, m] = ym.split('-').map(Number)
  return ymd(y, m, Math.min(p.d, daysInMonth(y, m)))
}

/**
 * Resumen de una tarjeta. `plan` = monthPlan del mes en curso (para saber si la
 * cuota del mes está pagada o vencida); `ruleId` = id de su regla de fijos.
 * @param {any} debt @param {{ today: string, plan?: any[], ruleId?: string }} opts
 */
export function cardSummary(debt, { today, plan = [], ruleId }) {
  const limit = Math.max(0, Number(debt?.creditLimit) || 0)
  const used = Math.max(0, Number(debt?.balance) || 0)
  const hasLimit = limit > 0
  const available = hasLimit ? round2(Math.max(0, limit - used)) : null
  const usedPct = hasLimit ? Math.min(1, used / limit) : null
  const statementRaw = Number(debt?.statementAmount)
  const statement = Number.isFinite(statementRaw) && statementRaw > 0 ? round2(statementRaw) : null
  const occ = ruleId ? (plan || []).filter(o => o && o.ruleId === ruleId) : []
  const pendingOcc = occ.find(o => o.status === 'pending')
  const confirmed = occ.find(o => o.status === 'confirmed')
  let status = 'none'
  let dueDate = pendingOcc?.date || null
  if (pendingOcc) status = pendingOcc.date < today ? 'overdue' : 'due'
  else if (confirmed) { status = 'paid'; dueDate = confirmed.date }
  else if (used > 0) {
    // Sin cuota prevista (sin cuota mínima): la fecha de pago del mes, si hay.
    const d = dueDateIn(debt, monthOf(today))
    if (d) { dueDate = d; status = statement && d < today ? 'overdue' : 'due' }
  }
  if (used <= 0 && status !== 'paid') status = 'none'
  const daysToDue = dueDate && status === 'due' ? diffDays(today, dueDate) : null
  return {
    id: debt?.id, name: String(debt?.creditor || ''), limit: hasLimit ? limit : null, used: round2(used), available, usedPct,
    overLimit: hasLimit && used > limit, statement, dueDate, status, daysToDue,
    minPayment: Math.max(0, Number(debt?.minPayment) || 0),
  }
}

/** Totales de varias tarjetas. @param {ReturnType<typeof cardSummary>[]} cards */
export function cardsTotals(cards) {
  let statement = 0, used = 0, limit = 0, available = 0, overdue = 0
  for (const c of cards || []) {
    statement += c.statement || 0
    used += c.used
    if (c.limit) { limit += c.limit; available += c.available || 0 }
    if (c.status === 'overdue') overdue++
  }
  return { statement: round2(statement), used: round2(used), limit: round2(limit), available: round2(available), overdue }
}
