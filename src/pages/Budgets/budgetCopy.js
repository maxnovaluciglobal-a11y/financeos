// src/pages/Budgets/budgetCopy.js — "Copiar del mes anterior" (R10).
// En MOY IQ un presupuesto es una categoría + límite mensual que vale para
// todos los meses (la store `budgets` no tiene mes), así que no hay "el
// presupuesto de septiembre" que copiar. Lo equivalente útil, sin tocar el
// esquema: armar un presupuesto por categoría con lo que se gastó el mes
// anterior. Excluye inversión (r.inv, igual que la página) y las categorías que
// ya tienen presupuesto; el límite se redondea hacia arriba a la unidad.
export function prevMonthKey(month) {
  const [y, m] = String(month).split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

export function budgetsFromPreviousMonth(expenses = [], activeMonth, existing = []) {
  const prev = prevMonthKey(activeMonth)
  const taken = new Set((existing || []).map(b => b?.category))
  const byCat = new Map()
  for (const e of expenses || []) {
    if (!e?.date?.startsWith(prev) || e.inv) continue
    const amt = Number(e.amount) || 0
    if (amt <= 0 || !e.category) continue
    byCat.set(e.category, (byCat.get(e.category) || 0) + amt)
  }
  return [...byCat.entries()]
    .filter(([cat]) => !taken.has(cat))
    .sort((a, b) => b[1] - a[1])
    .map(([category, total]) => ({ category, limit: Math.ceil(total) }))
}
