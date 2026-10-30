// src/pages/Budgets/budgetWizard.js — R8b (ola C, patrón de rial "asistente de
// presupuesto", en 3 pasos), 30-oct-2026. Lógica PURA del asistente: ingreso
// sugerido, lista de categorías sugerida, reparto en vivo, validación y qué se
// escribe al final. Sin React ni IndexedDB (tests en budgetWizard.test.js).
//
// Junta lo que ya existe, no inventa reglas nuevas:
//   - Ingreso: lo real del mes + lo previsto por fijos; si no hay, el mes
//     anterior; si no, los fijos de ingreso; si no, el ingreso estimado del
//     onboarding.
//   - Ahorro: `settings.savingsTargetPct` (R8a) o 10 %, con clampSavingsPct.
//   - Categorías: "Copiar del mes anterior" (budgetCopy.js); si no hay gastos
//     del mes anterior, la plantilla de perfil (data/templates.js, % del
//     ingreso, como TemplateSelector); si no, 50/30/20 sobre las categorías con
//     más gasto de los últimos 3 meses (o el modelo por defecto de la página).
//   - Reparto: budgetSplit (utils/budgets.js), el mismo de la barra R8a.
import { TEMPLATES } from '../../data/templates.js'
import { budgetSplit, clampSavingsPct } from '../../utils/budgets.js'
import { budgetsFromPreviousMonth, prevMonthKey } from './budgetCopy.js'

export const WIZARD_DEFAULT_SAVINGS_PCT = 10
export const WIZARD_MAX_ROWS = 12
// 50/30/20: el 20 ya es el ahorro del paso 2; lo que queda para gastar se
// reparte 50:30 entre necesidades y gustos (62,5 % y 37,5 % del resto).
export const NEEDS_SHARE = 50 / 80
export const NEEDS = new Set(['Vivienda', 'Alimentación', 'Transporte', 'Salud', 'Servicios', 'Educación', 'Educación hijos', 'Provisión impuestos', 'Mascotas'])
// Modelo por defecto (el mismo reparto de "Un punto de partida" de la página,
// sin la fila de ahorro): pesos dentro de cada grupo.
export const DEFAULT_MODEL = [
  { category: 'Vivienda', w: 25, need: true },
  { category: 'Alimentación', w: 17, need: true },
  { category: 'Transporte', w: 8, need: true },
  { category: 'Salud', w: 5, need: true },
  { category: 'Entretención', w: 8, need: false },
  { category: 'Educación', w: 7, need: false },
  { category: 'Ropa', w: 5, need: false },
  { category: 'Otros', w: 5, need: false },
]

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const round = (v) => Math.max(0, Math.round(num(v)))

// "1.500", "1.500,50", "1,500.50", "1500.5", "1 500" → número. Un solo punto
// seguido de exactamente 3 dígitos es separador de miles (CLP, VES, COP).
export function parseAmountInput(raw) {
  let s = String(raw ?? '').replace(/[\s\u00a0\u202f]/g, '').replace(/[^\d.,]/g, '')
  if (!s) return NaN
  const lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(',')
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? '.' : ','
    const thou = dec === '.' ? ',' : '.'
    s = s.split(thou).join('').replace(dec, '.')
  } else if (lastComma >= 0) {
    const parts = s.split(',')
    s = parts.length > 2 || (parts.length === 2 && parts[1].length === 3) ? parts.join('') : parts.join('.')
  } else if (lastDot >= 0) {
    const parts = s.split('.')
    if (parts.length > 2 || parts[1].length === 3) s = parts.join('')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

// ── Paso 1: ingreso ─────────────────────────────────────────────────────────
// Devuelve { amount, source } con source ∈ 'month' | 'prev' | 'recurring' |
// 'estimated' | 'none'.
export function suggestWizardIncome({ monthReal = 0, monthPending = 0, prevReal = 0, recurringMonthly = 0, estimated = 0 } = {}) {
  const month = num(monthReal) + num(monthPending)
  if (month > 0) return { amount: round(month), source: 'month' }
  if (num(prevReal) > 0) return { amount: round(prevReal), source: 'prev' }
  if (num(recurringMonthly) > 0) return { amount: round(recurringMonthly), source: 'recurring' }
  if (num(estimated) > 0) return { amount: round(estimated), source: 'estimated' }
  return { amount: 0, source: 'none' }
}

// ── Paso 2: ahorro ──────────────────────────────────────────────────────────
export function initialSavingsPct(settings) {
  const v = settings?.savingsTargetPct
  return v === undefined || v === null || v === '' ? WIZARD_DEFAULT_SAVINGS_PCT : clampSavingsPct(v)
}

// ── Paso 3: categorías sugeridas ────────────────────────────────────────────
function monthsBack(activeMonth, n) {
  const out = []
  let m = activeMonth
  for (let i = 0; i < n; i++) { m = prevMonthKey(m); out.push(m) }
  return out
}

// Gasto por categoría (sin inversión) en los meses dados, de mayor a menor.
export function topExpenseCategories(expenses = [], months = [], limit = 8) {
  const set = new Set(months)
  const by = new Map()
  for (const e of expenses || []) {
    if (!e || e.inv || !e.category || !set.has(String(e.date || '').slice(0, 7))) continue
    const a = num(e.amount)
    if (a > 0) by.set(e.category, (by.get(e.category) || 0) + a)
  }
  return [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([category, total]) => ({ category, total }))
}

function templateBudgets(settings) {
  if (Array.isArray(settings?.templateSuggestedBudgets) && settings.templateSuggestedBudgets.length) return settings.templateSuggestedBudgets
  const tpl = settings?.activeTemplateId && TEMPLATES.find(t => t.id === settings.activeTemplateId)
  return tpl?.suggestedBudgets?.length ? tpl.suggestedBudgets : null
}

// Reparte `pool` entre `items` ({category, w}) en proporción a w.
function spread(items, pool) {
  const tot = items.reduce((s, x) => s + num(x.w), 0)
  return tot > 0 ? items.map(x => ({ category: x.category, limit: round(pool * num(x.w) / tot) })) : []
}

// 50/30/20 sobre lo que queda para gastar (ingreso − ahorro).
export function split503020({ income = 0, savingsPct = 0, weighted = [] } = {}) {
  const pool = Math.max(0, num(income) - budgetSplit({ income, savingsPct }).savings)
  const needs = weighted.filter(x => x.need), wants = weighted.filter(x => !x.need)
  return [...spread(needs, pool * NEEDS_SHARE), ...spread(wants, pool * (1 - NEEDS_SHARE))]
}

// Devuelve { source, rows: [{ category, limit }] } con source ∈ 'copy' |
// 'template' | 'history' | 'model'. Los límites son enteros.
export function suggestWizardRows({ expenses = [], activeMonth, settings = {}, income = 0, savingsPct = 0 } = {}) {
  const copy = budgetsFromPreviousMonth(expenses, activeMonth, [])
  if (copy.length) return { source: 'copy', rows: copy.slice(0, WIZARD_MAX_ROWS) }
  const tpl = templateBudgets(settings)
  if (tpl && num(income) > 0) {
    const rows = tpl.map(b => ({ category: b.category, limit: round(num(income) * num(b.pct) / 100) })).filter(r => r.category)
    return { source: 'template', rows: dedupe(rows).slice(0, WIZARD_MAX_ROWS) }
  }
  const top = topExpenseCategories(expenses, monthsBack(activeMonth, 3))
  if (top.length) {
    const weighted = top.map(x => ({ category: x.category, w: x.total, need: NEEDS.has(x.category) }))
    return { source: 'history', rows: split503020({ income, savingsPct, weighted }) }
  }
  return { source: 'model', rows: split503020({ income, savingsPct, weighted: DEFAULT_MODEL }) }
}

function dedupe(rows) {
  const seen = new Set()
  return rows.filter(r => (seen.has(r.category) ? false : (seen.add(r.category), true)))
}

// ── Reparto en vivo ─────────────────────────────────────────────────────────
// rows: [{ category, amount }] (amount puede ser texto del input). Una fila de
// una categoría que ya tiene presupuesto cuenta con su límite actual salvo que
// el usuario elija actualizarla; los presupuestos que no están en la lista
// siguen contando (es lo que va a quedar guardado).
export function wizardTotals({ income = 0, savingsPct = 0, rows = [], budgets = [], updateExisting = false } = {}) {
  const existing = new Map((budgets || []).map(b => [b?.category, num(b?.limit)]))
  const inRows = new Set()
  let planned = 0
  for (const r of rows || []) {
    inRows.add(r.category)
    const v = parseAmountInput(r.amount)
    const amount = Number.isFinite(v) && v > 0 ? v : 0
    planned += existing.has(r.category) && !updateExisting ? existing.get(r.category) : amount
  }
  let others = 0
  for (const [cat, lim] of existing) if (!inRows.has(cat)) others += lim
  return { planned, others, ...budgetSplit({ income, budgeted: planned + others, savingsPct }) }
}

// ── Validación ──────────────────────────────────────────────────────────────
export function validateIncome(raw) {
  const v = parseAmountInput(raw)
  return Number.isFinite(v) && v > 0 ? null : 'income'
}

// { ok, empty, errors: { [category]: 'limit' | 'dup' } }. Una fila que no se va
// a escribir (ya tiene presupuesto y no se actualiza) no se valida.
export function validateRows(rows = [], { budgets = [], updateExisting = false } = {}) {
  const existing = new Set((budgets || []).map(b => b?.category))
  const errors = {}
  const seen = new Set()
  for (const r of rows || []) {
    if (!r?.category) continue
    if (seen.has(r.category)) { errors[r.category] = 'dup'; continue }
    seen.add(r.category)
    if (existing.has(r.category) && !updateExisting) continue
    const v = parseAmountInput(r.amount)
    if (!(Number.isFinite(v) && v > 0)) errors[r.category] = 'limit'
  }
  const empty = seen.size === 0
  return { ok: !empty && Object.keys(errors).length === 0, empty, errors }
}

// ── Escrituras ──────────────────────────────────────────────────────────────
// { create: [{category, limit}], update: [budget con limit nuevo], keep: [cat] }.
// Nunca borra: un presupuesto que no está en la lista queda igual.
export function planWizardWrites({ rows = [], budgets = [], updateExisting = false } = {}) {
  const byCat = new Map((budgets || []).map(b => [b?.category, b]))
  const create = [], update = [], keep = []
  const seen = new Set()
  for (const r of rows || []) {
    if (!r?.category || seen.has(r.category)) continue
    seen.add(r.category)
    const v = parseAmountInput(r.amount)
    if (!(Number.isFinite(v) && v > 0)) continue
    const limit = Math.round(v * 100) / 100
    const b = byCat.get(r.category)
    if (!b) create.push({ category: r.category, limit })
    else if (updateExisting && num(b.limit) !== limit) update.push({ ...b, limit })
    else keep.push(r.category)
  }
  return { create, update, keep }
}
