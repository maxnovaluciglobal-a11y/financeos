// @ts-check
// src/utils/monthPace.js — EL veredicto del mes ("¿voy bien este mes?"), una
// sola cuenta para toda la app (I-22 de benchmark/05-coherencia-360; UX-N1,
// decisión de Walter del 23-nov-2026).
//
// Antes había tres: el Anillo Vivo del Inicio (`pulse`), la píldora de la Lupa
// (paceToday) y la frase del mes (monthReading, Inicio y Panorama) medían el
// gasto contra el ingreso con su propia copia de la fórmula, y el gráfico de
// ritmo de Panorama (paceConclusion) tenía otra tolerancia. Ahora las tres
// llaman a `paceVerdict`. Presupuestos tiene su propio ritmo (gasto contra TUS
// PRESUPUESTOS, utils/budgets.js budgetPace): es otra pregunta y su texto lo
// dice ("Tus presupuestos van…"); no compite con este veredicto.
//
// UNA referencia: el ingreso registrado del mes, con la misma cuenta que
// "Te queda" (utils/monthLeft.js), que descuenta lo apartado y los fijos por
// pagar (UX-N2):
//   fijos      = fijos de gasto ya pagados en el mes + fijos por pagar
//   disponible = ingreso − apartado − fijos         (lo que se puede gastar parejo)
//   variable   = gastado − fijos ya pagados          (lo que se gastó fuera de los fijos)
//   te queda   = disponible − variable               (= monthLeft().left, al centavo)
//   ritmo      = variable / disponible − día / días
//   nivel: 'risk' si "te queda" < 0 (te pasaste) · 'ok' si el ritmo ≤ 2 puntos
//          · 'attention' hasta 10 puntos · 'risk' por encima.
// Así el veredicto nunca dice "vas bien" con "Te queda" en negativo, y el
// arriendo pagado el día 1 no cuenta como gasto rápido (ENG-N4, decisión 13:
// "contra el ingreso sin fijos"): el fijo se reserva entero desde el día 1.

export const PACE_OK = 0.02   // tolerancia de "parejo" (antes, la del Anillo Vivo)
export const PACE_HIGH = 0.10 // por encima, "muy rápido"

const r2 = (/** @type {number} */ v) => Math.round(v * 100) / 100
const num = (/** @type {any} */ v) => (Number.isFinite(Number(v)) ? Number(v) : 0)

// Dónde está `activeMonth` respecto de `now` (mismo criterio que monthPosition).
/** @param {string} activeMonth @param {Date} now */
export function paceDays(activeMonth, now = new Date()) {
  const [y, mo] = String(activeMonth).split('-').map(Number)
  const days = new Date(y, mo, 0).getDate()
  const cy = now.getFullYear(), cm = now.getMonth() + 1
  if (y < cy || (y === cy && mo < cm)) return { mode: 'past', today: days, days }
  if (y > cy || (y === cy && mo > cm)) return { mode: 'future', today: 0, days }
  return { mode: 'current', today: now.getDate(), days }
}

/**
 * El veredicto. null en un mes futuro, sin días o sin ningún movimiento.
 * @param {{ income?: number, spent?: number, setAside?: number, pendingFixed?: number, fixedPaid?: number,
 *   today: number, days: number, mode?: string }} p
 */
export function paceVerdict({ income = 0, spent = 0, setAside = 0, pendingFixed = 0, fixedPaid = 0, today, days, mode = 'current' }) {
  if (mode === 'future' || !(days > 0) || !(today >= 1)) return null
  const inc = Math.max(0, num(income))
  const sp = Math.max(0, num(spent))
  const aside = Math.max(0, num(setAside))
  const paid = Math.min(sp, Math.max(0, num(fixedPaid)))
  const pend = Math.max(0, num(pendingFixed))
  if (inc <= 0 && sp <= 0 && aside <= 0) return null
  const pool = r2(inc - aside - paid - pend)
  const used = r2(sp - paid)
  const left = r2(pool - used)
  const elapsed = Math.min(1, today / days)
  const ratio = pool > 0 ? used / pool : (used > 0 ? Infinity : 0)
  const over = pool > 0 ? ratio - elapsed : (left < 0 ? Infinity : 0)
  const level = left < 0 ? 'risk'
    : pool <= 0 ? 'attention'
      : over <= PACE_OK ? 'ok' : over <= PACE_HIGH ? 'attention' : 'risk'
  return {
    reference: 'income',
    income: inc, pool, used, left, fixedPaid: paid, pendingFixed: pend, setAside: aside,
    today, days, mode, elapsed,
    ratio, over, level,
    even: level === 'ok' && Math.abs(over) <= PACE_OK,
    // Lo que se podía haber gastado a hoy menos lo gastado (> 0: por debajo del ritmo).
    gap: r2(Math.max(0, pool) * elapsed - used),
  }
}

/**
 * El veredicto del mes a partir de los totales de "Te queda" (homeMonthTotals
 * `cur` / monthLeft): lo que usan el Inicio y Panorama.
 * @param {any} cur @param {string} activeMonth @param {Date} [now]
 */
export function monthPace(cur, activeMonth, now = new Date()) {
  if (!cur) return null
  const pos = paceDays(activeMonth, now)
  return paceVerdict({
    income: cur.totalInc ?? cur.income,
    spent: cur.totalExp ?? cur.spent,
    setAside: cur.setAside,
    pendingFixed: cur.pendingFixed,
    fixedPaid: cur.fixedPaid,
    today: pos.today, days: pos.days, mode: pos.mode,
  })
}
