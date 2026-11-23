// @ts-check
// src/utils/setAsideGoal.js — crear un apartado y sumarlo o restarlo en su meta
// (F-1 hilo del dinero; el modelo de datos está en setAside.js). Aparte de
// setAside.js para no pesar en la carga inicial (scripts/bundleBudget.js):
// AppContext lo pide con import() al apartar o deshacer; el alta rápida y el
// demo, que ya se cargan aparte, lo importan directo.
import { SET_ASIDE_CATEGORY, SET_ASIDE_DESTS, SET_ASIDE_KIND } from './setAside.js'

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const cents = (n) => { const v = Math.round(num(n) * 100) / 100; return v === 0 ? 0 : v }

/**
 * Meta que puede recibir un apartado: existe y no está completa.
 * @param {any} g
 */
export const goalAcceptsSetAside = (g) => !!g && g.id != null && !(num(g.target) > 0 && num(g.saved) >= num(g.target))

/**
 * Registro de un apartado, listo para `addExpense`. null si el monto o el
 * destino no sirven. `description` es el nombre que se ve en la lista.
 * @param {{ amount: unknown, date: string, dest: string, goalId?: any, description?: string, method?: string }} p
 */
export function buildSetAside({ amount, date, dest, goalId = null, description = '', method = '' }) {
  const amt = cents(amount)
  if (!(amt > 0) || !SET_ASIDE_DESTS.includes(/** @type {any} */ (dest))) return null
  if (dest === 'goal' && goalId == null) return null
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(date)) return null
  return {
    kind: SET_ASIDE_KIND, dest, ...(dest === 'goal' ? { goalId } : {}),
    amount: amt, date, description: String(description || '').trim(),
    category: SET_ASIDE_CATEGORY, method: method || '', subcategory: '', type: '', notes: '', project: '',
  }
}

/**
 * Lo que entra a la meta: no pasa del objetivo (como "Agregar ahorro").
 * @param {any} goal
 * @param {unknown} amount
 */
export function setAsideRoom(goal, amount) {
  const amt = cents(amount)
  if (!goalAcceptsSetAside(goal) || !(amt > 0)) return 0
  const target = num(goal.target), saved = num(goal.saved)
  return target > 0 ? cents(Math.min(amt, target - saved)) : amt
}

const MAX_CONTRIBUTIONS = 100 // igual que pages/Goals/goalFlow.js

/**
 * La meta después de un apartado. `ref` = id del registro (para deshacer).
 * @param {any} goal
 * @param {{ amount: number, date: string, method?: string, ref: any }} entry
 */
export function goalWithSetAside(goal, { amount, date, method = '', ref }) {
  const added = setAsideRoom(goal, amount)
  if (!(added > 0)) return null
  const e = { amount: added, date, ref, ...(method ? { method } : {}) }
  const contributions = [...(Array.isArray(goal.contributions) ? goal.contributions : []), e].slice(-MAX_CONTRIBUTIONS)
  return { ...goal, saved: cents(num(goal.saved) + added), contributions }
}

/**
 * La meta después de quitar un apartado: resta lo que sumó (sin bajar de 0) y
 * saca su entrada. null si la meta no tiene esa entrada.
 * @param {any} goal
 * @param {any} record
 */
export function goalWithoutSetAside(goal, record) {
  if (!goal || !record) return null
  const list = Array.isArray(goal.contributions) ? goal.contributions : []
  const i = list.findIndex(c => c && c.ref != null && c.ref === record.id)
  if (i < 0) return null
  const amount = num(list[i].amount)
  return { ...goal, saved: Math.max(0, cents(num(goal.saved) - amount)), contributions: list.filter((_, j) => j !== i) }
}
