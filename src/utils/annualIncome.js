// src/utils/annualIncome.js — ingreso anual estimado para precargar las
// calculadoras fiscales (QA pre-tiendas 23-nov-2026, I9).
//
// Antes Ahorro fiscal precargaba la SUMA de los ingresos del año en curso: con
// seis meses cargados (jun–nov) daba ~US$26.863 en vez de ~US$54.000 y la tasa
// marginal salía subestimada (10 % en vez de 12 %). Ahora: los 12 meses que
// terminan en el mes activo; si hay menos meses con ingresos, su promedio × 12.
// Sin movimientos de inversión (`inv`).
/**
 * @param {any[]} incomes @param {string} activeMonth 'AAAA-MM'
 * @returns {{ amount: number, months: number }}
 */
export function annualIncomeEstimate(incomes, activeMonth) {
  const [y, m] = String(activeMonth || '').split('-').map(Number)
  if (!y || !m) return { amount: 0, months: 0 }
  const window = new Set()
  for (let i = 0; i < 12; i++) {
    const d = new Date(y, m - 1 - i, 1)
    window.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const byMonth = {}
  for (const r of incomes || []) {
    const k = String(r?.date || '').slice(0, 7)
    if (r?.inv || !window.has(k)) continue
    byMonth[k] = (byMonth[k] || 0) + (Number(r.amount) || 0)
  }
  const months = Object.keys(byMonth).length
  if (!months) return { amount: 0, months: 0 }
  const total = Object.values(byMonth).reduce((s, v) => s + v, 0)
  return { amount: Math.round(months >= 12 ? total : (total / months) * 12), months }
}
