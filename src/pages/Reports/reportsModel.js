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

// Flujo del mes (QA pre-tiendas I7): las MISMAS cifras que "Te queda" del
// Inicio (utils/monthLeft.js). `m` = monthLeft(...) del mes con su plan de
// fijos. Ingresos = gastos + apartado + fijos por pagar + disponible, al
// centavo; si el mes ya está en rojo, disponible 0 y el faltante aparte.
// Antes el gráfico restaba TODAS las suscripciones y cuotas mínimas otra vez
// (aunque ya estaban en los gastos) y daba un "Disponible" distinto del KPI.
export function reportFlow(m) {
  const income = roundCents(Number(m?.income) || 0)
  const spent = roundCents(Number(m?.spent) || 0)
  const setAside = roundCents(Number(m?.setAside) || 0)
  const pendingFixed = roundCents(Number(m?.pendingFixed) || 0)
  const left = roundCents(Number(m?.left) || 0)
  return { income, spent, setAside, pendingFixed, available: Math.max(0, left), short: Math.max(0, -left) }
}

// Regla 50/30/20 (QA I7): partes del ingreso del mes que suman 100 % cuando el
// mes no está en rojo. Necesidades (incluye las cuotas de deuda ya pagadas,
// que son gastos registrados) = todo gasto que no es "Deseo"; Ahorro = la tasa
// de ahorro de toda la app (ingresos − gastos). Antes se sumaban encima las
// cuotas mínimas de las deudas aunque no fueran gasto del mes y la regla
// llegaba a 113 %.
export function rule503020({ income, spent, wants }) {
  const inc = Number(income) || 0
  const exp = Number(spent) || 0
  const w = Math.min(Number(wants) || 0, exp)
  const needs = roundCents(exp - w)
  const savings = roundCents(Math.max(0, inc - exp))
  return { needs, wants: roundCents(w), savings, income: inc }
}
