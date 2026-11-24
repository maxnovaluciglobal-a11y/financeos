// @ts-check
// src/utils/monthLeft.js — "Te queda este mes": UNA sola cuenta para toda la
// app (F-1 hilo del dinero, 20-nov-2026; I-16 de benchmark/05-coherencia-360).
//
// Antes cada pantalla la hacía a su manera: el Inicio redondeaba a centavos y
// excluía la inversión, Metas sumaba con `+ r.amount` ("Disponible este mes
// para ahorrar"), Movimientos restaba aparte lo marcado 💼 y la ChartLupa
// tenía su propio "te quedaban". Ahora Inicio, Panorama (vía useHomeData),
// Metas, Movimientos y el día a día de la lupa llaman a esta función.
//
//   Te queda = ingresos − gastos − apartado − fijos por pagar
//
//  · UX-N2 (decisión de Walter, 23-nov-2026): también descuenta los GASTOS
//    fijos del mes que todavía faltan (previstos y sin registrar). Antes era
//    solo lo real (decisión del 08-oct-2026) y lo previsto iba aparte.
//    `leftReal` sigue siendo la cuenta vieja (solo lo registrado).
//  · Fijos por pagar = pendingTotals(monthPlan(...)).expense, la MISMA cuenta
//    de "Previsto pendiente" (utils/recurring.js): solo ocurrencias `pending`
//    de reglas de gasto, sin las omitidas ni las confirmadas (una ocurrencia ya
//    registrada, vinculada o reconocida a mano, es `confirmed` y nunca se
//    cuenta dos veces) y sin las reglas de inversión (`rule.inv`). Los
//    ingresos fijos que faltan NO se suman: "Te queda" no cuenta plata que no
//    llegó.
//  · Por mes: el mes en curso descuenta lo que falta; un mes pasado no tiene
//    nada pendiente (lo que no se registró, no se pagó); un mes futuro
//    descuenta todos sus fijos de gasto, porque en el plan todos están
//    pendientes (sin movimientos, el Inicio muestra "sin datos" igual).
//    Con `untilDay` (cortes por día: comparación con el mes anterior, la
//    lupa) no se descuenta nada: es la foto de lo registrado hasta ese día.
//  · Sin los movimientos marcados como inversión (`r.inv`: flujo de una
//    propiedad o negocio), como hasta ahora.
//  · Apartar (utils/setAside.js) no es gasto: resta de "Te queda" pero no de
//    la tasa de ahorro, que lo cuenta como ahorro. Los fijos por pagar tampoco
//    mueven la tasa de ahorro: todavía no son gasto.
import { roundCents } from './monthFigures.js'
import { isSetAside, monthSetAsides, uniqueSetAsides } from './setAside.js'
import { pendingTotals } from './recurring.js'

/**
 * @param {any} r @param {string} month @param {number | null} untilDay
 */
const inMonth = (r, month, untilDay) => typeof r?.date === 'string' && r.date.startsWith(month)
  && (untilDay == null || Number(r.date.slice(8, 10)) <= untilDay)

// 'AAAA-MM' de hoy, en hora LOCAL. `today` = Date o 'AAAA-MM-DD'.
/** @param {Date | string | null | undefined} today */
function monthOfToday(today) {
  if (typeof today === 'string' && /^\d{4}-\d{2}/.test(today)) return today.slice(0, 7)
  const d = today instanceof Date ? today : new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Fijos de gasto que faltan en `month` según el plan (monthPlan de ese mes).
/** @param {any[]} plan @param {string} month @param {Date | string | null | undefined} today */
export function pendingFixedOf(plan, month, today) {
  if (!Array.isArray(plan) || plan.length === 0) return { amount: 0, count: 0 }
  if (month < monthOfToday(today)) return { amount: 0, count: 0 }
  const own = plan.filter(o => o && o.kind === 'expense' && typeof o.date === 'string' && o.date.startsWith(month))
  const p = pendingTotals(own)
  return { amount: roundCents(p.expense), count: p.count }
}

/**
 * @param {{ incomes?: any[], expenses?: any[], setAsides?: any[], month: string, untilDay?: number | null,
 *   plan?: any[] | null, today?: Date | string | null }} p
 *   `plan` = monthPlan() del mes (utils/recurring.js); sin plan no hay fijos por pagar.
 */
export function monthLeft({ incomes = [], expenses = [], setAsides = [], month, untilDay = null, plan = null, today = null }) {
  let income = 0, spent = 0, incCount = 0, expCount = 0
  for (const r of incomes || []) {
    if (!r || r.inv || !inMonth(r, month, untilDay)) continue
    income += Number(r.amount) || 0
    incCount++
  }
  // Un apartado que llegue mezclado con los gastos (lista cruda de la store)
  // cuenta como apartado, nunca dos veces (aunque también venga en setAsides:
  // se deduplica por id).
  const mixed = []
  for (const r of expenses || []) {
    if (!r || r.inv) continue
    if (isSetAside(r)) { mixed.push(r); continue }
    if (!inMonth(r, month, untilDay)) continue
    spent += Number(r.amount) || 0
    expCount++
  }
  income = roundCents(income)
  spent = roundCents(spent)
  const sa = monthSetAsides(uniqueSetAsides(setAsides, mixed), month, { untilDay })
  const leftReal = roundCents(income - spent - sa.total)
  const fixed = untilDay == null ? pendingFixedOf(plan || [], month, today) : { amount: 0, count: 0 }
  const left = roundCents(leftReal - fixed.amount)
  return {
    income, spent,
    setAside: sa.total, setAsideGoals: sa.goals, setAsideInvest: sa.invest, setAsideCount: sa.count,
    // UX-N2: lo que ya descuenta de fijos por pagar, para explicar la cifra.
    pendingFixed: fixed.amount, pendingFixedCount: fixed.count,
    leftReal,
    left,
    // Tasa de ahorro: lo que no se gastó (lo apartado es ahorro) ÷ ingresos.
    // Los fijos por pagar no la mueven: todavía no son gasto.
    savingRate: income > 0 ? roundCents(income - spent) / income : 0,
    incCount, expCount,
  }
}
