// src/utils/debtDirection.js — "Debo" y "Me deben" (D2, patrón rial #45–#49).
//
// Un registro de la store `debts` lleva un `direction` opcional:
//   'owe'  (o sin campo) → una deuda mía, como siempre. Los registros viejos y
//                          los respaldos anteriores no traen el campo y siguen
//                          siendo deudas sin migración (la store no tiene esquema).
//   'owed'               → lo que otra persona me debe (por cobrar).
//
// Criterio aprobado por Walter (30-oct-2026): lo que me deben es un ACTIVO en
// el patrimonio, aparece como "Cobro" en Próximos pagos cuando tiene fecha y NO
// cuenta en la carga de deuda del IQ Score. AppContext/DemoContext exponen
// `debts` (solo 'owe') y `receivables` (solo 'owed'): así ningún consumidor
// viejo (Asesor, Coach, Reportes, flujo, fijos) suma un cobro como deuda.
//
// Un cobro por cobrar reutiliza los campos de la deuda para que el respaldo, el
// CSV y el sync sigan siendo genéricos: `creditor` = quién me debe, `initial` /
// `balance` = monto y saldo pendiente, `dueDate` = fecha esperada (opcional),
// `notes`, y `collections` = historial de cobros parciales [{ id, date, amount }].

export const OWE = 'owe'
export const OWED = 'owed'

export const debtDirection = (d) => (d?.direction === OWED ? OWED : OWE)
export const isOwed = (d) => debtDirection(d) === OWED
export const isOwe = (d) => !isOwed(d)

// Divide una lista mixta en { owe, owed }. Acepta null/undefined.
export function splitDebts(list) {
  const owe = []
  const owed = []
  for (const d of Array.isArray(list) ? list : []) {
    if (!d) continue
    ;(isOwed(d) ? owed : owe).push(d)
  }
  return { owe, owed }
}

const num = (n) => Number(n) || 0
const cents = (n) => Math.round(n * 100) / 100

// Registro nuevo de "Me deben" a partir del formulario (sin id: lo pone addDebt).
export function newReceivable({ who, amount, date, notes } = {}) {
  const amt = cents(Math.max(0, num(amount)))
  return {
    direction: OWED,
    creditor: String(who || '').trim(),
    debtType: 'Otro',
    initial: amt,
    balance: amt,
    minPayment: 0,
    rate: 0,
    dueDate: date || '',
    notes: String(notes || '').trim(),
    collections: [],
  }
}

// Monto ya cobrado de un "me deben": inicial − saldo (nunca negativo).
export const collectedOf = (d) => Math.max(0, num(d?.initial) - num(d?.balance))

// KPIs de la pestaña "Me deben".
export function owedTotals(list) {
  const owed = (Array.isArray(list) ? list : []).filter(isOwed)
  return {
    pending: cents(owed.reduce((s, d) => s + Math.max(0, num(d.balance)), 0)),
    collected: cents(owed.reduce((s, d) => s + collectedOf(d), 0)),
    open: owed.filter((d) => num(d.balance) > 0).length,
  }
}

// Aplica un cobro (parcial o total) a un "me deben". El monto se acota al
// saldo; sin monto (o con uno mayor) se cobra el total. Devuelve el registro
// nuevo y el monto aplicado (0 si no había saldo o el monto no es válido).
export function applyCollection(d, amount, { date, id } = {}) {
  const balance = Math.max(0, num(d?.balance))
  const asked = amount == null || amount === '' ? balance : num(amount)
  const applied = cents(Math.min(balance, Math.max(0, asked)))
  if (applied <= 0) return { debt: d, amount: 0 }
  const left = cents(balance - applied)
  const entry = { id: id || `col-${date || ''}-${(d?.collections || []).length + 1}`, date: date || '', amount: applied }
  const out = { ...d, balance: left, collections: [...(Array.isArray(d?.collections) ? d.collections : []), entry] }
  if (left === 0) out.collectedAt = date || ''
  else delete out.collectedAt
  return { debt: out, amount: applied }
}

// Agrupa la pestaña "Me deben": con fecha (más cercana primero), "Sin fecha"
// (#47, por nombre) y cobrados (saldo 0, al final).
export function groupReceivables(list) {
  const owed = (Array.isArray(list) ? list : []).filter(isOwed)
  const open = owed.filter((d) => num(d.balance) > 0)
  const byName = (a, b) => String(a.creditor || '').localeCompare(String(b.creditor || ''))
  return {
    dated: open.filter((d) => d.dueDate).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)) || byName(a, b)),
    undated: open.filter((d) => !d.dueDate).sort(byName),
    done: owed.filter((d) => num(d.balance) <= 0).sort((a, b) => String(b.collectedAt || '').localeCompare(String(a.collectedAt || '')) || byName(a, b)),
  }
}

// Estado de un "me deben" (ícono + palabra en la UI, StateTag).
export function receivableState(d, today) {
  if (num(d?.balance) <= 0) return 'collected'
  if (!d?.dueDate) return 'undated'
  return today && d.dueDate < today ? 'late' : 'pending'
}

function addDaysIso(iso, n) {
  const [y, m, day] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, day + n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

// Cobros esperados de los próximos `days` días para "Próximos pagos": solo los
// que tienen fecha y saldo. Mismo formato que upcomingFromRules (dashboardModel)
// con kind 'collect' e `incoming: true`.
export function upcomingCollections(list, { today, days = 30 } = {}) {
  if (!today) return []
  const end = addDaysIso(today, days)
  return (Array.isArray(list) ? list : [])
    .filter((d) => isOwed(d) && num(d.balance) > 0 && d.dueDate && d.dueDate >= today && d.dueDate <= end)
    .map((d) => ({ id: `rcv-${d.id}`, kind: 'collect', incoming: true, name: d.creditor || '', amount: cents(num(d.balance)), date: d.dueDate }))
}

// Une pagos y cobros en una sola lista por fecha (a igual fecha, el monto
// mayor primero) y corta en `limit`. `total` cuenta todo lo que cae en el plazo.
export function mergeUpcoming(payments, collections, { limit = 5 } = {}) {
  const all = [...(payments || []), ...(collections || [])]
  all.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount)
  return { items: all.slice(0, limit), total: all.length }
}
