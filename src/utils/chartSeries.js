// src/utils/chartSeries.js — series de los gráficos de tiempo (UI-M6)
// Funciones puras: cuánto entra o sale por mes y el gasto acumulado por día,
// con su período anterior (la línea gris punteada).

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

// Claves "AAAA-MM" de `months` meses que terminan `offset` meses antes del mes
// de `now` (offset 0 = incluye el mes actual), de más viejo a más nuevo.
export function monthKeys(months, offset = 0, now = new Date()) {
  const out = []
  for (let i = months - 1; i >= 0; i--) out.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i - offset, 1)))
  return out
}

export function totalForMonth(records, key) {
  let t = 0
  for (const r of records || []) if (r?.date?.startsWith(key)) t += Number(r.amount) || 0
  return t
}

const daysIn = (key) => { const [y, m] = key.split('-').map(Number); return new Date(y, m, 0).getDate() }
export function prevMonthKey(key) {
  const [y, m] = key.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

// Gasto acumulado por día de `month` contra el mes anterior. En el mes en
// curso la serie actual se corta en `today` (null después), la anterior sigue.
// Un día que el mes anterior no tuvo (31 contra 30) repite su último total.
export function cumulativeByDay(records, month, today = new Date()) {
  const prev = prevMonthKey(month)
  const n = daysIn(month), np = daysIn(prev)
  const cur = new Array(n).fill(0), old = new Array(np).fill(0)
  for (const r of records || []) {
    const d = r?.date
    if (typeof d !== 'string') continue
    const day = Number(d.slice(8, 10))
    if (d.startsWith(month) && day >= 1 && day <= n) cur[day - 1] += Number(r.amount) || 0
    else if (d.startsWith(prev) && day >= 1 && day <= np) old[day - 1] += Number(r.amount) || 0
  }
  for (let i = 1; i < n; i++) cur[i] += cur[i - 1]
  for (let i = 1; i < np; i++) old[i] += old[i - 1]
  const isCurrent = month === monthKey(today)
  const lastDay = isCurrent ? today.getDate() : n
  const r2 = (v) => Math.round(v * 100) / 100
  return Array.from({ length: n }, (_, i) => ({
    day: i + 1,
    current: i + 1 <= lastDay ? r2(cur[i]) : null,
    currentPrev: r2(old[Math.min(i, np - 1)]),
  }))
}
