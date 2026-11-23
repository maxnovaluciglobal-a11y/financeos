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
// Leer y repartir vive acá (lo usa la carga inicial); crear un apartado y
// moverlo en la meta, en setAsideGoal.js (se carga al apartar).

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
