// src/pages/Reports/reportsModel.js — cuentas puras de Reportes (y su PDF),
// alineadas con las reglas únicas del resto de la app (auditoría 360, ENG-N6).
import { budgetStatus } from '../../utils/budgets.js'
import { roundCents } from '../../utils/monthFigures.js'

// Categorías excedidas: la misma regla en centavos que Presupuestos, Inicio y
// el Asesor (budgetStatus). Con `>` en coma flotante, 50,10 + 50,20 contra un
// límite de 100,30 salía "excedido" solo en Reportes (regresión de FIN-13).
export function reportOverBudget({ budgets, expByCat, limits }) {
  return (Array.isArray(budgets) ? budgets : [])
    .filter(b => b && budgetStatus(expByCat?.[b.category] || 0, limits?.[b.category] || 0).over)
}

// Suscripciones que todavía faltan este mes, según el plan de fijos
// (monthPlan, la misma regla de "Previsto pendiente" del Inicio). Una
// suscripción ya cobrada es un gasto real del mes: restarla otra vez dejaba
// "Disponible tras deudas y suscripciones" por debajo de la realidad.
// Sin reglas de suscripción (datos de antes de reconcileRules) se resta el
// equivalente mensual de todas, como antes.
export function subscriptionsToDeduct({ plan, rules, monthlySubs }) {
  const hasSubRules = (Array.isArray(rules) ? rules : []).some(r => r?.source === 'subscription')
  if (!hasSubRules) return roundCents(monthlySubs)
  let s = 0
  for (const o of plan || []) {
    if (o?.status !== 'pending' || o.kind !== 'expense' || o.rule?.source !== 'subscription' || o.rule?.inv) continue
    s += Number(o.amount ?? o.expected) || 0
  }
  return roundCents(s)
}
