// src/utils/budgets.js
// Cálculo ÚNICO del límite efectivo de presupuesto por categoría, honrando el
// rollover opt-in (settings.budgetRollover). Compartido por la página
// Presupuestos, el diagnóstico (coachRules), el score y el Modo Asesor, para
// que "presupuesto excedido" signifique lo mismo en todas partes.
//
// Rollover: lo NO gastado el mes anterior (acotado a [0, limit]) se suma al
// límite base del mes actual, SOLO si el presupuesto ya existía ese mes
// (`createdAt`; los viejos sin fecha cuentan como existentes) y si ese mes
// tiene al menos un gasto registrado. Antes, el primer mes (o uno sin cargar)
// arrastraba el 100 % y duplicaba el límite (auditoría 360, FIN-8).
//
// Estado de cada categoría (FIN-13, FIN-16): una sola regla para Presupuestos,
// Coach e Inicio. Atención desde el 80 %, excedido solo si el gasto SUPERA el
// límite, comparando en centavos (50,10 + 50,20 no "excede" 100,30).

export const BUDGET_WARN_PCT = 0.80

const cents = (n) => Math.round((Number(n) || 0) * 100 + Number.EPSILON * 100)

export function budgetStatus(spent, limit) {
  const s = cents(spent), l = cents(limit)
  const pct = l > 0 ? s / l : 0
  const over = s > l
  const warn = !over && l > 0 && pct >= BUDGET_WARN_PCT
  return { pct, over, warn, level: over ? 'risk' : warn ? 'attention' : 'ok' }
}

const monthOfIso = (iso) => (typeof iso === 'string' && /^\d{4}-\d{2}/.test(iso) ? iso.slice(0, 7) : null)

function prevMonthOf(activeMonth) {
  const [y, m] = String(activeMonth).split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

// Devuelve { [categoria]: limiteEfectivo }. Con rollover OFF = límite base.
export function budgetRollover({ budgets, expenses, activeMonth, settings }) {
  const out = {}
  const bs = Array.isArray(budgets) ? budgets : []
  if (!settings?.budgetRollover) return out
  const prev = prevMonthOf(activeMonth)
  const prevByCat = {}
  let prevHasData = false
  ;(expenses || []).forEach(e => {
    if (e?.date?.startsWith(prev) && !e?.inv) {
      prevHasData = true
      prevByCat[e.category] = (prevByCat[e.category] || 0) + (Number(e.amount) || 0)
    }
  })
  bs.forEach(b => {
    const limit = Number(b.limit) || 0
    const created = monthOfIso(b.createdAt)
    const existedPrev = !created || created <= prev
    out[b.category] = prevHasData && existedPrev
      ? Math.max(0, Math.min(limit - (prevByCat[b.category] || 0), limit))
      : 0
  })
  return out
}

// Devuelve { [categoria]: limiteEfectivo }. Con rollover OFF = límite base.
export function effectiveBudgetLimits({ budgets, expenses, activeMonth, settings }) {
  const out = {}
  const carry = budgetRollover({ budgets, expenses, activeMonth, settings })
  ;(Array.isArray(budgets) ? budgets : []).forEach(b => {
    out[b.category] = (Number(b.limit) || 0) + (carry[b.category] || 0)
  })
  return out
}

// Cuenta cuántas categorías superaron su límite EFECTIVO este mes (excluye
// gastos de inversión 💼, coherente con el presupuesto personal).
export function countBudgetsExceeded({ budgets, expenses, activeMonth, settings }) {
  const limits = effectiveBudgetLimits({ budgets, expenses, activeMonth, settings })
  const spent = {}
  ;(expenses || []).forEach(e => {
    if (e?.date?.startsWith(activeMonth) && !e?.inv) {
      spent[e.category] = (spent[e.category] || 0) + (Number(e.amount) || 0)
    }
  })
  return (Array.isArray(budgets) ? budgets : []).filter(
    b => budgetStatus(spent[b.category] || 0, limits[b.category] || 0).over
  ).length
}
