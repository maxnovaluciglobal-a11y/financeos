// src/pages/Movements/movementsList.js — lógica pura de Movimientos (UI-M3, B3a)
// Lista unificada de ingresos y gastos (decisión D-B), búsqueda, filtros (tipo,
// origen fijo/único, categoría), agrupación por día con lo que entró y salió,
// totales del mes, lente en US$ y el prellenado del gasto detallado.
// Sin React; testeado en movementsList.test.js.

import { toRef } from '../../utils/refRate.js'

// Fijo = vino de una regla de movimientos fijos (suscripción, cuota o fijo
// manual confirmado): lleva recurringId. Único = todo lo demás. Un ingreso con
// la etiqueta vieja de recurrencia ("Mensual", "Quincenal"…) también es fijo,
// igual que en la página de Ingresos.
export const isFixed = (e) => {
  if (!e) return false
  if (e.recurringId) return true
  return e.kind === 'income' && !!e.recurrence && e.recurrence !== 'Único'
}

// Ingresos y gastos del mes en una sola lista. Cada ítem conserva el registro
// original en `rec` (es lo que se edita o se borra: nunca se guarda el ítem) y
// una clave única por tipo (los ids de dos stores pueden coincidir).
// Orden: día más reciente primero; dentro del día, el último creado primero.
export function mergeMovements(expenses, incomes) {
  const items = []
  const push = (rec, kind) => {
    if (!rec) return
    items.push({
      kind, rec, key: `${kind}:${rec.id}`, id: rec.id,
      date: String(rec.date || '').slice(0, 10),
      amount: Math.abs(Number(rec.amount) || 0),
      name: (kind === 'income' ? rec.source : rec.description) || '',
      category: rec.category || '', subcategory: rec.subcategory || '', notes: rec.notes || '',
      recurringId: rec.recurringId, recurrence: rec.recurrence, inv: !!rec.inv,
      createdAt: rec.createdAt || '',
    })
  }
  for (const e of Array.isArray(expenses) ? expenses : []) push(e, 'expense')
  for (const r of Array.isArray(incomes) ? incomes : []) push(r, 'income')
  return items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
}

// Monto con signo: ingreso +, gasto −. Un registro sin `kind` es un gasto.
export const signedAmount = (e) => (e?.kind === 'income' ? 1 : -1) * Math.abs(Number(e?.amount) || 0)

// Tipos del control "Todos · Gastos · Ingresos".
export const MOVEMENT_TYPES = ['all', 'expense', 'income']
export const normType = (v) => (MOVEMENT_TYPES.includes(v) ? v : 'all')

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// query busca en nombre (descripción o fuente), categoría (canónica y
// traducida), subcategoría y notas. catNameOf: (categoría) => nombre traducido.
// type: 'all' | 'expense' | 'income'. kind (origen): 'all' | 'oneoff' | 'fixed'.
export function filterMovements(list, { query = '', category = null, kind = 'all', type = 'all', catNameOf = (c) => c } = {}) {
  const q = norm(query.trim())
  return (Array.isArray(list) ? list : []).filter((e) => {
    if (!e) return false
    if (type !== 'all' && (e.kind || 'expense') !== type) return false
    if (category && (e.category || '') !== category) return false
    if (kind === 'fixed' && !isFixed(e)) return false
    if (kind === 'oneoff' && isFixed(e)) return false
    if (!q) return true
    return [e.name ?? e.description, e.category, catNameOf(e.category), e.subcategory, e.notes].some((f) => norm(f).includes(q))
  })
}

// [{ date: 'YYYY-MM-DD', income, expense, net, items }] del día más reciente al
// más viejo; dentro del día, el orden que trae la lista (más reciente primero).
// income y expense son positivos; net = income − expense.
export function groupByDay(list) {
  const map = new Map()
  for (const e of Array.isArray(list) ? list : []) {
    if (!e) continue
    const d = String(e.date || '').slice(0, 10)
    if (!map.has(d)) map.set(d, { date: d, income: 0, expense: 0, net: 0, items: [] })
    const g = map.get(d)
    const a = Math.abs(Number(e.amount) || 0)
    if (e.kind === 'income') g.income += a
    else g.expense += a
    g.net = g.income - g.expense
    g.items.push(e)
  }
  return [...map.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

// Totales del mes para el encabezado: ingresos, gastos y cuánto de cada uno
// está marcado como inversión (la nota "incluye $X de inversión", H17).
export function monthTotals(list) {
  const t = { income: 0, expense: 0, invIncome: 0, invExpense: 0, incomeCount: 0, expenseCount: 0 }
  for (const e of Array.isArray(list) ? list : []) {
    if (!e) continue
    const a = Math.abs(Number(e.amount) || 0)
    if (e.kind === 'income') { t.income += a; t.incomeCount++; if (e.inv) t.invIncome += a }
    else { t.expense += a; t.expenseCount++; if (e.inv) t.invExpense += a }
  }
  return t
}

// ── Lente de moneda (B3a, R12) ─────────────────────────────────────────────
// Si el usuario puso el Inicio en US$ (fos_home_refcur === 'ref'), califica
// (refEligible) y hay una tasa con fecha (resolveRefRate), los montos de esta
// pantalla se muestran en US$. Recibe lo ya resuelto para seguir siendo pura.
export function lensState({ eligible = false, rate = null, mode = 'local' } = {}) {
  const usable = !!eligible && !!rate && Number(rate.rate) > 0
  return { available: usable, on: usable && mode === 'ref', rate: usable ? rate : null }
}

// Monto en la lente activa (sin lente, el mismo monto).
export function inLens(amount, lens) {
  if (!lens?.on) return Number(amount) || 0
  return toRef(amount, lens.rate.rate) ?? 0
}

// ── Prellenado del gasto detallado (contrato con el alta rápida, B4a) ───────
// sessionStorage['fos_detailed_expense_prefill'] = JSON {description, amount,
// date, category, method}. Devuelve los campos del formulario ya validados, o
// null si no hay nada usable. Lo que no es válido cae al valor por defecto.
export const PREFILL_KEY = 'fos_detailed_expense_prefill'
export function parseExpensePrefill(raw, { categories = [], methods = [], today = '' } = {}) {
  if (!raw) return null
  let o
  try { o = typeof raw === 'string' ? JSON.parse(raw) : raw } catch { return null }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null
  const out = {}
  const desc = typeof o.description === 'string' ? o.description.trim().slice(0, 200) : ''
  if (desc) out.description = desc
  const amt = Number(String(o.amount ?? '').replace(',', '.'))
  if (Number.isFinite(amt) && amt > 0) out.amount = String(amt)
  if (!out.description && !out.amount) return null
  out.date = typeof o.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.date) ? o.date : today
  if (categories.includes(o.category)) out.category = o.category
  if (methods.includes(o.method)) out.method = o.method
  return out
}

// Categorías presentes en la lista, de mayor a menor gasto (para los chips).
export function categoriesByAmount(list) {
  const map = new Map()
  for (const e of Array.isArray(list) ? list : []) {
    const c = e?.category || ''
    map.set(c, (map.get(c) || 0) + (Number(e.amount) || 0))
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)
}

// Encabezado de día: "Hoy", "Ayer" o "mié, 15 oct" en el idioma de la interfaz.
export function dayLabel(iso, { today, locale = 'es-CL', t = (k) => k } = {}) {
  const [y, m, d] = String(iso).split('-').map(Number)
  if (!y || !m || !d) return String(iso || '')
  const date = new Date(y, m - 1, d)
  if (today) {
    const [ty, tm, td] = String(today).split('-').map(Number)
    const diff = Math.round((new Date(ty, tm - 1, td) - date) / 86_400_000)
    if (diff === 0) return t('movl.day.today')
    if (diff === 1) return t('movl.day.yesterday')
  }
  try {
    return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(date)
  } catch {
    return `${d}/${m}`
  }
}
