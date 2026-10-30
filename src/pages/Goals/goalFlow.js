// src/pages/Goals/goalFlow.js — R9 Metas (patrones rial #40–#44), 30-oct-2026.
// Lógica pura del alta corta en 3 pasos, las dos bolsas fijas (Fondo de
// emergencia y Ahorros generales) y el aporte desde una hoja. Sin React.
//
// Modelo: sin store nuevo. Una meta sigue siendo { name, target, saved,
// targetDate, priority, color }; se suman campos OPCIONALES que el resto de la
// app ignora: `kind` ('emergency' | 'general'), `icon` (id de plantilla),
// `createdAt` (para deshacer el alta) y `contributions` (historial de aportes
// con el medio de pago de origen).
import { isEmergencyGoalName } from '../../utils/emergencyGoal.js'
import { monthsLeft } from './goalStatus.js'
import { firstGoalPresets } from './firstGoal.js'

// 3 meses de gastos: la regla vive en firstGoalPresets (y en la tarjeta de ajuste).
export function emergencySuggested(emergencyBase) {
  return firstGoalPresets({ emergencyBase }).find(p => p.id === 'emergency')?.target ?? null
}

// Cuadrícula de plantillas (#40). `custom` deja el nombre vacío.
export const GOAL_TEMPLATE_IDS = ['trip', 'vehicle', 'home', 'phone', 'computer', 'education', 'business', 'custom']

export const FLOW_STEPS = 3 // monto → nombre y fecha → resumen (#42)

// "Ahorros generales" en los 4 idiomas: la meta se reconoce por `kind` o por
// nombre (una meta creada a mano con ese nombre no se duplica).
const GENERAL_NAMES = ['ahorros generales', 'ahorro general', 'general savings', 'poupanca geral', 'poupancas gerais', 'allgemeine ersparnisse', 'allgemeine rucklage']

export function normalizeName(s) {
  return String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ')
}

export function isEmergencyGoal(g) {
  return !!g && (g.kind === 'emergency' || isEmergencyGoalName(g.name))
}
export function isGeneralGoal(g) {
  return !!g && !isEmergencyGoal(g) && (g.kind === 'general' || GENERAL_NAMES.includes(normalizeName(g.name)))
}

// Las dos bolsas fijas (#41): siempre visibles, con la meta si ya existe.
// `emergencySuggested`: 3 meses de gastos (misma regla de firstGoalPresets y
// de la tarjeta de ajuste), null si todavía no hay datos.
export function fixedBuckets(goals, { emergencyBase = 0 } = {}) {
  const list = Array.isArray(goals) ? goals : []
  return [
    { id: 'emergency', goal: list.find(isEmergencyGoal) || null, suggested: emergencySuggested(emergencyBase) },
    { id: 'general', goal: list.find(isGeneralGoal) || null, suggested: null },
  ]
}

// Borrador del alta corta a partir de una plantilla o una bolsa.
export function draftFromTemplate(id, t = (k) => k, { emergencyBase = 0 } = {}) {
  if (id === 'emergency') {
    const sug = emergencySuggested(emergencyBase)
    return { name: t('gs.emergency.name'), target: sug ? String(sug) : '', targetDate: '', priority: 'Alta', icon: 'emergency', kind: 'emergency' }
  }
  if (id === 'general') return { name: t('goals.r9.generalName'), target: '', targetDate: '', priority: 'Media', icon: 'general', kind: 'general' }
  const known = GOAL_TEMPLATE_IDS.includes(id) && id !== 'custom'
  return { name: known ? t(`goals.r9.tpl.${id}`) : '', target: '', targetDate: '', priority: 'Media', icon: GOAL_TEMPLATE_IDS.includes(id) ? id : 'custom' }
}

export function parseAmount(v) {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : 0
  const s = String(v ?? '').trim()
  if (!s) return 0
  // "1234,5" o "1234.5" (el input numérico ya entrega punto).
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : 0
}

// ¿Se puede pasar al paso siguiente? Devuelve la clave del error o null.
export function stepError(step, draft) {
  if (step >= 1 && parseAmount(draft?.target) <= 0) return 'goals.r9.err.amount'
  if (step >= 2 && !String(draft?.name || '').trim()) return 'goals.r9.err.name'
  return null
}

// Aporte mensual para llegar a la fecha (resumen del paso 3). null sin fecha.
export function monthlyNeeded({ target, saved = 0, targetDate, activeMonth }) {
  if (!targetDate) return null
  const months = monthsLeft(activeMonth, targetDate)
  const left = parseAmount(target) - (Number(saved) || 0)
  if (months == null || months < 1 || left <= 0) return null
  return left / months
}

// Meta lista para addGoal (la fecha del alta corta es 'YYYY-MM').
export function buildGoal(draft, { now = Date.now() } = {}) {
  const goal = {
    name: String(draft.name || '').trim(),
    target: parseAmount(draft.target),
    saved: Math.min(parseAmount(draft.saved), parseAmount(draft.target)),
    targetDate: draft.targetDate || '',
    priority: draft.priority || 'Media',
    color: draft.color || '#14213D',
    createdAt: now,
  }
  if (draft.icon) goal.icon = draft.icon
  if (draft.kind) goal.kind = draft.kind
  return goal
}

// Aporte (#43): misma regla que antes (el ahorrado no pasa del objetivo) y se
// guarda el origen en `contributions` (últimos 100). `added` es lo que
// efectivamente sumó, para el aviso.
export const MAX_CONTRIBUTIONS = 100
export function applyContribution(goal, amount, { method = '', date = '' } = {}) {
  const n = parseAmount(amount)
  const saved = Number(goal?.saved) || 0
  const target = Number(goal?.target) || 0
  if (!goal || n <= 0) return null
  const nextSaved = target > 0 ? Math.min(saved + n, target) : saved + n
  const added = nextSaved - saved
  if (added <= 0) return null
  const entry = { amount: added, date }
  if (method) entry.method = method
  const contributions = [...(Array.isArray(goal.contributions) ? goal.contributions : []), entry].slice(-MAX_CONTRIBUTIONS)
  return { goal: { ...goal, saved: nextSaved, contributions }, added, remaining: Math.max(0, target - nextSaved), done: target > 0 && nextSaved >= target }
}

// Medio de pago por defecto: el último aporte de esta meta, si no el último
// usado en el alta rápida, si no el primero de la lista.
export function defaultMethod(goal, methods = [], lastPaymentMethod) {
  const last = Array.isArray(goal?.contributions) ? goal.contributions[goal.contributions.length - 1]?.method : null
  if (last && methods.includes(last)) return last
  if (lastPaymentMethod && methods.includes(lastPaymentMethod)) return lastPaymentMethod
  return methods[0] || ''
}

// 'YYYY-MM' del alta corta → 'YYYY-MM-DD' del formulario completo ("Más opciones").
export function toFullFormDate(targetDate) {
  const s = String(targetDate || '')
  return /^\d{4}-\d{2}$/.test(s) ? `${s}-01` : s
}
