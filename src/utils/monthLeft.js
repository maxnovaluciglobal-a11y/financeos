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
//   Te queda = ingresos − gastos − apartado
//
//  · Solo lo REAL registrado (decisión de Walter, 08-oct-2026): los fijos
//    previstos van aparte en "Previsto pendiente". Si Walter decide UX-N2
//    (descontar los fijos pendientes), se cambia acá y en ningún otro lado.
//  · Sin los movimientos marcados como inversión (`r.inv`: flujo de una
//    propiedad o negocio), como hasta ahora.
//  · Apartar (utils/setAside.js) no es gasto: resta de "Te queda" pero no de
//    la tasa de ahorro, que lo cuenta como ahorro.
import { roundCents } from './monthFigures.js'
import { isSetAside, monthSetAsides } from './setAside.js'

/**
 * @param {any} r @param {string} month @param {number | null} untilDay
 */
const inMonth = (r, month, untilDay) => typeof r?.date === 'string' && r.date.startsWith(month)
  && (untilDay == null || Number(r.date.slice(8, 10)) <= untilDay)

/**
 * @param {{ incomes?: any[], expenses?: any[], setAsides?: any[], month: string, untilDay?: number | null }} p
 */
export function monthLeft({ incomes = [], expenses = [], setAsides = [], month, untilDay = null }) {
  let income = 0, spent = 0, incCount = 0, expCount = 0
  for (const r of incomes || []) {
    if (!r || r.inv || !inMonth(r, month, untilDay)) continue
    income += Number(r.amount) || 0
    incCount++
  }
  // Un apartado que llegue mezclado con los gastos (lista cruda de la store)
  // cuenta como apartado, nunca dos veces.
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
  const sa = monthSetAsides([...(setAsides || []), ...mixed], month, { untilDay })
  const left = roundCents(income - spent - sa.total)
  return {
    income, spent,
    setAside: sa.total, setAsideGoals: sa.goals, setAsideInvest: sa.invest, setAsideCount: sa.count,
    left,
    // Tasa de ahorro: lo que no se gastó (lo apartado es ahorro) ÷ ingresos.
    savingRate: income > 0 ? roundCents(income - spent) / income : 0,
    incCount, expCount,
  }
}
