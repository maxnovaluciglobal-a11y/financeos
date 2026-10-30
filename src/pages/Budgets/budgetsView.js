// src/pages/Budgets/budgetsView.js — poda P2 ("densidad"), 30-oct-2026.
// "¿En qué me estoy pasando?": los 3 KPIs pasan a UNA línea bajo el titular
// (el detalle completo queda en una hoja) y cada categoría a "Gastado X de Y"
// con el estado; Restante y arrastre van en la hoja de la categoría. Acá solo
// se decide QUÉ decir (claves i18n y valores); la página traduce y formatea
// (los montos pasan por <Amount>/useMoney, ocultar montos T13). Sin React;
// testeado en budgetsView.test.js.
import { exceedsWithTolerance } from '../../utils/budgets.js'

// Línea de KPIs: "2 categorías excedidas · 79 % del ingreso".
// tone: 'risk' si hay categorías excedidas o el presupuesto supera el ingreso,
// 'warn' si usa más del 80 % del ingreso, si no 'ok'.
export function kpiLine({ overCount = 0, totalBudget = 0, income = 0 } = {}) {
  const n = Math.max(0, Number(overCount) || 0)
  const over = n === 0
    ? { key: 'budgets.p2.kpi.overNone' }
    : { key: n === 1 ? 'budgets.p2.kpi.overOne' : 'budgets.p2.kpi.overMany', n }
  const inc = Number(income) || 0
  const total = Number(totalBudget) || 0
  const coverage = inc > 0 ? { key: 'budgets.p2.kpi.coverage', ratio: total / inc } : { key: 'budgets.p2.kpi.noIncome' }
  const overIncome = inc > 0 && exceedsWithTolerance(total, inc)
  const tone = n > 0 || overIncome ? 'risk' : inc > 0 && total / inc > 0.8 ? 'warn' : 'ok'
  return { over, coverage, tone }
}

// Línea de una categoría: con presupuesto "Gastado X de Y"; sin presupuesto
// (gasto sin asignar) solo "Gastado X".
export function rowLine(row) {
  const spent = Math.max(0, Number(row?.spent) || 0)
  const limit = Math.max(0, Number(row?.limit) || 0)
  return limit > 0
    ? { key: 'budgets.p2.row.spentOf', spent, limit }
    : { key: 'budgets.p2.row.spent', spent }
}

// Detalle de la categoría (hoja): Restante o Excedido, y el arrastre del mes
// anterior. Sin presupuesto no hay restante.
export function rowDetail(row) {
  const spent = Math.max(0, Number(row?.spent) || 0)
  const limit = Math.max(0, Number(row?.limit) || 0)
  const carry = Number(row?.carry) || 0
  const base = row?.budget ? Math.max(0, Number(row.budget.limit) || 0) : 0
  if (!(limit > 0)) return { spent, limit: 0, base: 0, carry: 0, left: null }
  const left = limit - spent
  return {
    spent, limit, base, carry,
    left: { key: left < 0 ? 'budgets.col.over' : 'budgets.col.left', value: Math.abs(left), over: left < 0 },
  }
}

// Límite editado en la hoja: número positivo ("1.500" o "1500,5" → 1500.5 si
// trae coma decimal). null si no sirve.
export function parseLimit(v) {
  const s = String(v ?? '').trim().replace(/\s/g, '')
  if (!s) return null
  const norm = s.includes(',') && !s.includes('.') ? s.replace(',', '.') : s.replace(/,/g, '')
  const n = Number(norm)
  return Number.isFinite(n) && n > 0 ? n : null
}
