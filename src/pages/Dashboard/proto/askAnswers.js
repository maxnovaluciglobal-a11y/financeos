// src/pages/Dashboard/proto/askAnswers.js — respuestas de "Pregúntale a moyiq"
// (variante C del prototipo del Inicio v2). Reglas fijas, sin servidor ni
// modelo de lenguaje: cada pregunta se responde con las MISMAS cifras que ya
// muestra la app, nada de cuentas nuevas:
//   · gasto del mes y comparación → homeMonthTotals (monthLeft) vía useHomeData
//     (cur y prevToDate: el mes anterior cortado al mismo día);
//   · por día → budgetPace (utils/budgets.js), la misma cuenta "te quedan X por
//     día" de Presupuestos, aplicada a "Te queda";
//   · categorías → la suma por categoría de los gastos del mes (como el anillo).
// Devuelve datos; el texto lo arma el componente con i18n.
import { budgetPace } from '../../../utils/budgets.js'

export const ASK_QUESTIONS = Object.freeze(['spent', 'top', 'compare', 'perDay'])

const num = (v) => Number(v) || 0

/** ¿Cuánto gasté este mes? */
export function answerSpent({ kpis }) {
  const cur = kpis?.cur || {}
  return { spent: num(cur.totalExp), count: num(cur.expCount), income: num(cur.totalInc),
    share: num(cur.totalInc) > 0 ? num(cur.totalExp) / num(cur.totalInc) : null }
}

/** Top 5 categorías del mes (gastos personales, sin inversión). */
export function answerTop({ monthExpenses, limit = 5 }) {
  const by = {}
  let total = 0
  for (const e of monthExpenses || []) {
    if (!e || e.inv) continue
    const a = num(e.amount)
    if (a <= 0) continue
    const k = e.category || 'Otros'
    by[k] = (by[k] || 0) + a
    total += a
  }
  const rows = Object.entries(by)
    .map(([category, amount]) => ({ category, amount, share: total > 0 ? amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount)
  return { total, rows: rows.slice(0, limit), more: Math.max(0, rows.length - limit) }
}

/** Compara con el mes pasado, al mismo día (prevToDate) o completo si el mes ya cerró. */
export function answerCompare({ kpis }) {
  const cur = kpis?.cur || {}
  const prev = kpis?.prevToDate || kpis?.prev || {}
  const line = (a, b) => ({ cur: num(a), prev: num(b), diff: num(a) - num(b) })
  return {
    cutDay: kpis?.prevCutDay ?? null,
    hasPrev: num(prev.incCount) + num(prev.expCount) > 0,
    income: line(cur.totalInc, prev.totalInc),
    spent: line(cur.totalExp, prev.totalExp),
    left: line(cur.leftReal ?? cur.freeFlow, prev.freeFlow),
  }
}

/** ¿Cuánto me queda por día? "Te queda" repartido en los días que faltan (hoy incluido). */
export function answerPerDay({ kpis, activeMonth, today = new Date() }) {
  const free = num(kpis?.cur?.freeFlow)
  const p = budgetPace({ spent: 0, total: Math.max(0, free), activeMonth, today })
  return { free, perDay: p.perDay, daysLeft: p.daysLeft, closed: !!p.closed || p.daysLeft <= 0, short: free < 0 }
}

export function answerFor(id, input) {
  if (id === 'spent') return answerSpent(input)
  if (id === 'top') return answerTop(input)
  if (id === 'compare') return answerCompare(input)
  if (id === 'perDay') return answerPerDay(input)
  return null
}
