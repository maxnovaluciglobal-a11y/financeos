// src/utils/recurringSources.js — Suscripciones y Deudas como reglas de fijos.
//
// Decisión de Walter (08-oct-2026): un solo sistema. Cada suscripción y cada
// deuda con cuota mensual tiene SU regla en el store 'recurring'
// (source 'subscription' | 'debt', sourceId = id original). Los registros
// originales NO se borran ni se modifican: las páginas Suscripciones y Deudas
// siguen escribiendo en sus stores y `reconcileRules` deja las reglas al día.
//
// reconcileRules es PURA e IDEMPOTENTE: con las mismas entradas, la segunda
// pasada no devuelve cambios. Ids deterministas (`rs-<id>`, `rd-<id>`): dos
// dispositivos que reconcilian por su cuenta llegan a la misma regla, sin
// duplicados al sincronizar. La usan la puesta al día de datos existentes
// (core/db: reconcileRecurringSources, una sola transacción), AppContext
// después de cada cambio de suscripción/deuda, y el demo.

import { addDays, amountAt, monthBounds, monthOf, parseYMD, withAmountFrom } from './recurring.js'

export const subRuleId = (subId) => `rs-${subId}`
export const debtRuleId = (debtId) => `rd-${debtId}`

// Categoría de gasto (CATS_EXPENSE) para cada categoría de suscripción: al
// confirmar el cobro se crea un gasto real y tiene que caer en un presupuesto.
const SUB_TO_EXPENSE_CAT = {
  'Streaming': 'Entretención', 'Música': 'Entretención',
  'Productividad': 'Tecnología', 'Software': 'Tecnología', 'Almacenamiento': 'Tecnología', 'Cloud': 'Tecnología',
  'Educación': 'Educación',
  'Salud / Gimnasio': 'Deporte', 'Gimnasio': 'Deporte',
  'Seguros': 'Servicios', 'Seguro': 'Servicios', 'Telefonía / Internet': 'Servicios', 'Suscripción': 'Servicios',
  'Delivery': 'Alimentación',
}
export const expenseCategoryForSub = (subCategory) => SUB_TO_EXPENSE_CAT[subCategory] || 'Otros'
const WANT_SUB_CATS = new Set(['Streaming', 'Música', 'Delivery'])

// Inicio de una regla nueva: el primer día del mes en curso (el pasado no se
// toca), salvo que la próxima fecha registrada sea de un mes posterior — ahí
// el cobro de este mes ya pasó y la regla arranca en esa fecha.
function startFor(nextDate, today) {
  const { first, last } = monthBounds(monthOf(today))
  return nextDate && parseYMD(nextDate) && nextDate > last ? nextDate : first
}

function scheduleForSub(sub, today) {
  const anchor = parseYMD(sub.nextPaymentDate) ? sub.nextPaymentDate : today
  const day = parseYMD(anchor).d
  switch (sub.frequency) {
    case 'weekly':    return { freq: 'weekly', anchorDate: anchor }
    case 'quarterly': return { freq: 'monthly', interval: 3, day, anchorDate: anchor }
    case 'annual':
    case 'anual':     return { freq: 'yearly', day, anchorDate: anchor }
    default:          return { freq: 'monthly', day, anchorDate: anchor }
  }
}

export function ruleFromSubscription(sub, { today, now }) {
  const startDate = startFor(sub.nextPaymentDate, today)
  return {
    id: subRuleId(sub.id),
    kind: 'expense',
    source: 'subscription',
    sourceId: sub.id,
    description: String(sub.name || '').trim(),
    category: expenseCategoryForSub(sub.category),
    subCategory: sub.category || '',
    method: '',
    type: WANT_SUB_CATS.has(sub.category) ? 'Deseo' : 'Necesidad',
    amountMode: 'fixed',
    amounts: [{ from: monthOf(startDate), amount: Number(sub.amount) || 0 }],
    schedule: scheduleForSub(sub, today),
    startDate,
    autoConfirm: false,
    paused: sub.status !== 'active',
    skipped: [],
    createdAt: now,
  }
}

// Cuota de una deuda: mensual, en su día de vencimiento (sin fecha, el último
// día del mes — así "Confirmar todos" no la da por pagada a comienzo de mes).
export function ruleFromDebt(debt, { today, now }) {
  const due = parseYMD(debt.dueDate) ? debt.dueDate : null
  const startDate = startFor(due, today)
  const project = String(debt.project || '').trim()
  return {
    id: debtRuleId(debt.id),
    kind: 'expense',
    source: 'debt',
    sourceId: debt.id,
    description: String(debt.creditor || '').trim(),
    category: 'Deudas',
    method: '',
    type: 'Necesidad',
    amountMode: 'fixed',
    amounts: [{ from: monthOf(startDate), amount: Number(debt.minPayment) || 0 }],
    schedule: { freq: 'monthly', day: due ? parseYMD(due).d : 'last', anchorDate: due || startDate },
    startDate,
    autoConfirm: false,
    paused: false,
    skipped: [],
    ...(project ? { inv: true, project } : {}),
    createdAt: now,
  }
}

const debtActive = (d) => (Number(d?.minPayment) || 0) > 0 && (Number(d?.balance) || 0) > 0

// Aplica a una regla existente lo que cambió en su origen. El monto nuevo entra
// "desde ahora" (mes en curso): los meses anteriores conservan el suyo.
function syncFromSub(rule, sub, { today }) {
  const ym = monthOf(today)
  let next = { ...rule,
    description: String(sub.name || '').trim() || rule.description,
    category: expenseCategoryForSub(sub.category),
    subCategory: sub.category || '',
    paused: sub.status !== 'active',
  }
  const amt = Number(sub.amount) || 0
  if (amountAt(next, ym) !== amt) next = withAmountFrom(next, ym, amt)
  const sched = scheduleForSub(sub, today)
  if (sched.freq !== rule.schedule?.freq || (sched.interval || 1) !== (rule.schedule?.interval || 1) ||
      (sub.nextPaymentDate && sub.nextPaymentDate !== rule.schedule?.anchorDate)) {
    next.schedule = sched
  }
  if (next.endDate && next.endedBySource) { delete next.endDate; delete next.endedBySource }
  return next
}

function syncFromDebt(rule, debt, { today }) {
  const ym = monthOf(today)
  const project = String(debt.project || '').trim()
  let next = { ...rule, description: String(debt.creditor || '').trim() || rule.description }
  if (project) { next.inv = true; next.project = project } else { delete next.inv; delete next.project }
  const amt = Number(debt.minPayment) || 0
  if (amt > 0 && amountAt(next, ym) !== amt) next = withAmountFrom(next, ym, amt)
  const due = parseYMD(debt.dueDate) ? debt.dueDate : null
  const day = due ? parseYMD(due).d : 'last'
  if (rule.schedule?.day !== day) next.schedule = { ...rule.schedule, freq: 'monthly', day, anchorDate: due || rule.schedule?.anchorDate || rule.startDate }
  if (debtActive(debt)) {
    if (next.endDate && next.endedBySource) { delete next.endDate; delete next.endedBySource }
  } else if (!next.endDate) {
    // Saldada (o sin cuota): la regla termina hoy; lo ya confirmado queda.
    next.endDate = today; next.endedBySource = true
  }
  return next
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// Devuelve las reglas a crear o actualizar (nunca borra). `today` 'YYYY-MM-DD'
// local; `now` ISO para createdAt.
export function reconcileRules(rules, subscriptions, debts, { today, now = new Date().toISOString() }) {
  const list = Array.isArray(rules) ? rules : []
  const byId = new Map(list.filter(r => r && r.id).map(r => [r.id, r]))
  const upserts = []
  const seen = new Set()

  for (const sub of Array.isArray(subscriptions) ? subscriptions : []) {
    if (!sub || !sub.id) continue
    const id = subRuleId(sub.id)
    seen.add(id)
    const cur = byId.get(id)
    const next = cur ? syncFromSub(cur, sub, { today }) : ruleFromSubscription(sub, { today, now })
    if (!cur || !same(cur, next)) upserts.push(next)
  }

  for (const debt of Array.isArray(debts) ? debts : []) {
    if (!debt || !debt.id) continue
    const id = debtRuleId(debt.id)
    const cur = byId.get(id)
    if (!cur && !debtActive(debt)) continue   // sin cuota o ya saldada: no hace falta regla
    seen.add(id)
    const next = cur ? syncFromDebt(cur, debt, { today }) : ruleFromDebt(debt, { today, now })
    if (!cur || !same(cur, next)) upserts.push(next)
  }

  // Origen borrado: la regla termina ayer (sin pendientes nuevos). Si el
  // borrado se deshace, la próxima pasada la reabre (endedBySource).
  for (const r of list) {
    if (!r || (r.source !== 'subscription' && r.source !== 'debt') || seen.has(r.id) || r.endDate) continue
    upserts.push({ ...r, endDate: addDays(today, -1), endedBySource: true })
  }
  return upserts
}
