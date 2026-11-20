// @ts-check
// src/utils/setAside.js — "Apartar" (F-1 hilo del dinero, 20-nov-2026).
//
// Apartar es mover plata de lo que te queda este mes a una meta o a "Para
// invertir". No es un gasto: no entra en categorías, presupuestos, reportes ni
// en el IQ Score, pero sí sale de "Te queda" (utils/monthLeft.js).
//
// Modelo de datos (compatible con respaldos, sync y versiones anteriores):
//  · Se guarda en la store `expenses`, como un registro con
//      { kind: 'setAside', dest: 'goal' | 'invest', goalId?, amount, date,
//        description, category: 'Otros', method }
//    Así viaja en el respaldo y en el sync sin una store nueva ni migración.
//    Una versión anterior de la app lo ve como un gasto de "Otros": su
//    "Te queda" da la misma cifra (también lo resta) y nada se rompe.
//  · La app lo separa al leer (AppContext/DemoContext, `splitSetAsides`):
//    `expenses` queda sin apartados y `setAsides` los tiene aparte, igual que
//    `debts`/`receivables`. Ningún consumidor viejo de `expenses` los cuenta.
//  · A una meta, además, suma al "Ahorrado" con una entrada en
//    `goal.contributions` que lleva `ref` = id del registro, para poder
//    deshacerlo. Un aporte viejo (sin `ref`) no tiene registro y no resta de
//    "Te queda" (así era antes; no se reescribe el pasado).
//  · "Para invertir" (dest 'invest') es lo que Inversiones muestra como
//    aporte del mes listo para registrar (utils/investNetWorth.js,
//    monthContributions).

export const SET_ASIDE_KIND = 'setAside'
export const SET_ASIDE_DESTS = /** @type {const} */ (['goal', 'invest'])
// Categoría que ve una versión anterior de la app (no se usa en esta).
export const SET_ASIDE_CATEGORY = 'Otros'

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const cents = (n) => { const v = Math.round(num(n) * 100) / 100; return v === 0 ? 0 : v }

/** @param {any} r */
export const isSetAside = (r) => !!r && r.kind === SET_ASIDE_KIND

/**
 * Une listas de apartados sin repetir: el mismo registro (mismo id, o el mismo
 * objeto si no tiene id) cuenta una sola vez aunque llegue en varias listas.
 * @param {...(any[] | null | undefined)} lists
 * @returns {any[]}
 */
export function uniqueSetAsides(...lists) {
  const seen = new Map()
  for (const list of lists) {
    for (const r of Array.isArray(list) ? list : []) {
      if (!isSetAside(r)) continue
      const key = r.id != null ? `id:${r.id}` : r
      if (!seen.has(key)) seen.set(key, r)
    }
  }
  return [...seen.values()]
}

/**
 * Reparte la store `expenses` en gastos y apartados.
 * @param {any[]} records
 * @returns {{ expenses: any[], setAsides: any[] }}
 */
export function splitSetAsides(records) {
  const expenses = [], setAsides = []
  for (const r of Array.isArray(records) ? records : []) (isSetAside(r) ? setAsides : expenses).push(r)
  return { expenses, setAsides }
}

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

/**
 * Apartado del mes, por destino.
 * @param {any[]} setAsides
 * @param {string} month 'YYYY-MM'
 * @param {{ untilDay?: number | null }} [opts]
 */
export function monthSetAsides(setAsides, month, { untilDay = null } = {}) {
  let goals = 0, invest = 0, count = 0
  const items = []
  for (const r of Array.isArray(setAsides) ? setAsides : []) {
    if (!isSetAside(r) || typeof r.date !== 'string' || !r.date.startsWith(month)) continue
    if (untilDay != null && Number(r.date.slice(8, 10)) > untilDay) continue
    const a = num(r.amount)
    if (r.dest === 'invest') invest += a; else goals += a
    count++
    items.push(r)
  }
  goals = cents(goals); invest = cents(invest)
  return { total: cents(goals + invest), goals, invest, count, items }
}
