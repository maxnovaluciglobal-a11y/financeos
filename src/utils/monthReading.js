// src/utils/monthReading.js — el mes en palabras (#9, #10, #12; 30-oct-2026).
// Lógica pura, sin IA ni red: decide QUÉ decir (clave i18n + valores) y
// renderReading lo convierte en texto. Los montos los formatea quien llama
// (useMoney().m), así "ocultar montos" vale también dentro de la frase.
//
//   monthReading(input)       → { short, long, kind }: una frase (Inicio) y hasta 3 (Panorama)
//   budgetsConclusion(rows)   → titular de Presupuestos
//   categoryConclusion(...)   → titular del anillo de categorías
//   barConclusion(...)        → titular de Ingresos vs Gastos
//   paceSeries / paceConclusion → gráfico de gasto acumulado contra el ritmo
//
// Voz: la app reporta, no opina. Sin "deberías", sin alarmas, sin inversión.
// Prioridad: un solo hecho, el más útil. El orden de `facts` ES la regla:
//   sin datos → mes cerrado → primeros días → saldo negativo → presupuesto
//   pasado → ritmo alto → presupuesto cerca → fijos pendientes → categoría que
//   más subió → ritmo normal. Lo que sigue en la lista completa Panorama.
//
// Ritmo: mismo cálculo y umbrales que el Anillo Vivo del Inicio (gastado sobre
// ingreso contra mes transcurrido), para que la frase y el anillo no se
// contradigan justo debajo del héroe. VE y AR: sin porcentajes de variación
// nominal (prefersAmountDelta), y en US$ con la tasa de cada período si existe.

import { monthDelta, usdMonthDelta, prefersAmountDelta, prevMonthOf } from '../pages/Dashboard/dashboardModel.js'

export const PACE_OK = 0.02        // Igual que `pulse` en Dashboard/index.jsx
export const PACE_HIGH = 0.10
export const EARLY_DAYS = 3        // Hasta este día no se habla de ritmo
export const EARLY_MOVES = 3       // ni con tan pocos movimientos
export const CATEGORY_MIN_PCT = 15 // Por debajo, la variación es ruido

const line = (key, vars = {}) => ({ key, vars })
const money = (value) => ({ money: value })
const usd = (value) => ({ usd: value })
const pct = (value) => ({ pct: value })
const cat = (value) => ({ cat: value })
const month = (value) => ({ month: value })
const left = (value) => ({ left: value })

// En qué momento del mes está `activeMonth` respecto de `now`.
export function monthPosition(activeMonth, now = new Date()) {
  const [y, mo] = String(activeMonth).split('-').map(Number)
  const days = new Date(y, mo, 0).getDate()
  const cy = now.getFullYear(), cm = now.getMonth() + 1
  if (y < cy || (y === cy && mo < cm)) return { mode: 'past', today: days, days, left: 0 }
  if (y > cy || (y === cy && mo > cm)) return { mode: 'future', today: 0, days, left: days }
  return { mode: 'current', today: now.getDate(), days, left: days - now.getDate() }
}

// Gasto por categoría del mes `ym` (hasta `untilDay` si se indica).
function byCategory(expenses, ym, untilDay = null) {
  const out = {}
  for (const e of expenses || []) {
    if (!e || e.inv || typeof e.date !== 'string' || !e.date.startsWith(ym)) continue
    if (untilDay != null && Number(e.date.slice(8, 10)) > untilDay) continue
    const k = e.category || 'Otros'
    out[k] = (out[k] || 0) + (Number(e.amount) || 0)
  }
  return out
}

// La variación por categoría más grande contra el mes anterior (mismo tramo
// del mes si el mes está en curso). `dir` 'up' primero: es lo que más se pregunta.
export function topCategoryDelta({ expenses, activeMonth, cutDay = null, country, rates = null }) {
  const prevKey = prevMonthOf(activeMonth)
  const cur = byCategory(expenses, activeMonth)
  const prev = byCategory(expenses, prevKey, cutDay)
  const preferAmount = prefersAmountDelta(country)
  const useRates = rates?.cur > 0 && rates?.prev > 0
  const rows = []
  for (const [category, value] of Object.entries(cur)) {
    if (!(prev[category] > 0)) continue
    const d = useRates
      ? usdMonthDelta(value, prev[category], { curRate: rates.cur, prevRate: rates.prev, invert: true })
      : monthDelta(value, prev[category], { invert: true, preferAmount })
    if (!d || d.dir === 'flat') continue
    if (Math.abs(d.pct) < CATEGORY_MIN_PCT) continue
    rows.push({ category, ...d })
  }
  rows.sort((a, b) => Math.abs(b.abs) - Math.abs(a.abs))
  return rows.find(r => r.dir === 'up') || rows[0] || null
}

const deltaVars = (d, useUsd) => (d.usePct
  ? { amount: pct(Math.abs(d.pct) / 100) }
  : { amount: useUsd ? usd(Math.abs(d.abs)) : money(Math.abs(d.abs)) })

/**
 * @param {object} input
 *   activeMonth 'AAAA-MM' · now
 *   totals      homeMonthTotals: { cur, prev, prevToDate, prevCutDay }
 *   expenses    gastos personales (sin inversión) de todos los meses
 *   rows        budgetRows del mes
 *   pending     pendingTotals: { count, expense, income }
 *   country     para la regla VE/AR
 *   rates       { cur, prev } tasa de cada período, o null
 */
export function monthReading({ activeMonth, now = new Date(), totals, expenses = [], rows = [], pending = null, country = '', rates = null }) {
  const pos = monthPosition(activeMonth, now)
  const { cur, prev, prevToDate, prevCutDay } = totals
  const moves = (cur.incCount || 0) + (cur.expCount || 0)
  const spent = cur.totalExp, income = cur.totalInc, balance = cur.freeFlow
  const prevKey = prevMonthOf(activeMonth)
  const facts = []
  const add = (l) => { if (l) facts.push(l) }
  const pendCount = Number(pending?.count) || 0
  const pendExp = Number(pending?.expense) || 0
  const pendInc = Number(pending?.income) || 0
  const amountOnly = prefersAmountDelta(country)
  const useUsd = rates?.cur > 0 && rates?.prev > 0
  const over = rows.filter(r => r.state === 'over')
  const near = rows.filter(r => r.state === 'near')

  const finish = (kind) => ({ kind, short: facts[0] || null, long: facts.slice(0, 3), facts })

  if (pos.mode === 'future') { add(line('reading.future')); return finish('future') }

  if (moves === 0) {
    if (pos.mode === 'past') { add(line('reading.emptyClosed', { month: month(activeMonth) })); return finish('empty') }
    if (pendCount > 0 && pendExp > 0) add(line('reading.emptyPending', { amount: money(pendExp) }))
    else add(line('reading.empty'))
    return finish('empty')
  }

  // Variación del gasto total contra el mes anterior.
  const baseline = pos.mode === 'current' ? (prevToDate || prev) : prev
  const hasPrev = (baseline?.expCount || 0) > 0
  const totalDelta = useUsd
    ? usdMonthDelta(spent, baseline?.totalExp, { curRate: rates.cur, prevRate: rates.prev, invert: true, hasPrev })
    : monthDelta(spent, baseline?.totalExp, { invert: true, hasPrev, preferAmount: amountOnly })
  const topCat = topCategoryDelta({ expenses, activeMonth, cutDay: pos.mode === 'current' ? prevCutDay : null, country, rates })

  if (pos.mode === 'past') {
    add(balance > 0 ? line('reading.closed.pos', { month: month(activeMonth), amount: money(balance) })
      : balance < 0 ? line('reading.closed.neg', { month: month(activeMonth), amount: money(-balance) })
        : line('reading.closed.zero', { month: month(activeMonth) }))
    if (over.length === 1) add(line('reading.closed.overOne', { cat: cat(over[0].category), amount: money(over[0].spent - over[0].limit) }))
    else if (over.length > 1) add(line('reading.closed.overMany', { n: over.length }))
    if (totalDelta && totalDelta.dir !== 'flat') {
      add(line(`reading.closed.spent.${totalDelta.dir}`, { ...deltaVars(totalDelta, useUsd), month: month(prevKey) }))
    }
    if (topCat) add(line(`reading.closed.cat.${topCat.dir}`, { cat: cat(topCat.category), ...deltaVars(topCat, useUsd), month: month(prevKey) }))
    return finish('closed')
  }

  // Mes en curso.
  const lf = left(pos.left)
  const few = pos.today <= EARLY_DAYS || moves < EARLY_MOVES
  if (few) add(line('reading.early', { left: lf }))

  if (income <= 0) {
    add(pendInc > 0
      ? line('reading.noIncomePending', { spent: money(spent), amount: money(pendInc) })
      : line('reading.noIncome', { spent: money(spent) }))
  } else if (balance < 0) {
    add(pendInc > 0
      ? line('reading.negativePending', { amount: money(-balance), pending: money(pendInc) })
      : line('reading.negative', { amount: money(-balance) }))
  }

  if (over.length === 1) add(line('reading.overOne', { cat: cat(over[0].category), amount: money(over[0].spent - over[0].limit) }))
  else if (over.length > 1) add(line('reading.overMany', { n: over.length, cat: cat(over[0].category) }))

  const elapsed = pos.today / pos.days
  const paceGap = income > 0 ? spent / income - elapsed : null
  const daily = pos.today > 0 ? spent / pos.today : 0
  const fits = income / pos.days
  const paceSentence = (() => {
    if (paceGap == null || paceGap <= PACE_OK || balance < 0 || few) return null
    return amountOnly
      ? line('reading.pace.highAmount', { daily: money(daily), diff: money(daily - fits), left: lf })
      : line('reading.pace.high', { elapsed: pct(elapsed), used: pct(spent / income), left: lf })
  })()
  add(paceSentence)

  if (near[0]) add(line('reading.near', { cat: cat(near[0].category), used: pct(near[0].ratio), left: lf }))
  if (pendCount > 0 && pendExp > 0) add(line(pendCount === 1 ? 'reading.pendingOne' : 'reading.pendingMany', { n: pendCount, amount: money(pendExp) }))
  if (topCat) add(line(`reading.cat.${topCat.dir}`, { cat: cat(topCat.category), ...deltaVars(topCat, useUsd), month: month(prevKey) }))
  // #12: el dato por día, solo si no fue ya la frase principal (VE/AR).
  if (paceSentence && !amountOnly && daily > fits) add(line('reading.perDay', { daily: money(daily), diff: money(daily - fits) }))
  if (totalDelta && totalDelta.dir !== 'flat' && !few) add(line(`reading.spent.${totalDelta.dir}`, { ...deltaVars(totalDelta, useUsd), month: month(prevKey) }))
  if (paceGap != null && paceGap <= PACE_OK && balance >= 0 && !few) add(line('reading.pace.ok', { left: lf }))
  return finish(few ? 'early' : 'current')
}

// ── Titulares que ya son la conclusión (#9) ─────────────────────────────────

export function budgetsConclusion(rows = [], { closed = false } = {}) {
  const list = (rows || []).filter(r => r && r.limit > 0)
  if (list.length === 0 || !list.some(r => r.spent > 0)) return null
  const over = list.filter(r => r.state === 'over')
  const near = list.filter(r => r.state === 'near')
  if (over.length === 1) return line('reading.title.budget.overOne', { cat: cat(over[0].category), amount: money(over[0].spent - over[0].limit) })
  if (over.length > 1) return line('reading.title.budget.overMany', { n: over.length })
  if (near.length === 1) return line('reading.title.budget.nearOne', { cat: cat(near[0].category) })
  if (near.length > 1) return line('reading.title.budget.nearMany', { n: near.length })
  return line(closed ? 'reading.title.budget.okClosed' : 'reading.title.budget.ok')
}

export function categoryConclusion(monthExpenses = []) {
  const map = {}
  let total = 0
  for (const e of monthExpenses || []) {
    const v = Number(e?.amount) || 0
    if (v <= 0) continue
    const k = e.category || 'Otros'
    map[k] = (map[k] || 0) + v
    total += v
  }
  const names = Object.keys(map)
  if (names.length < 2) return null
  const top = names.sort((a, b) => map[b] - map[a])[0]
  return line('reading.title.category', { cat: cat(top), share: pct(map[top] / total) })
}

// series: [{ income, expense }] por mes, del más viejo al más nuevo.
export function barConclusion(series = []) {
  const withData = (series || []).filter(s => s && (s.income > 0 || s.expense > 0))
  if (withData.length < 2) return null
  const deficit = withData.filter(s => s.expense > s.income).length
  return deficit === 0
    ? line('reading.title.bar.covered', { total: withData.length })
    : line('reading.title.bar.deficit', { n: deficit, total: withData.length })
}

// ── Gasto acumulado contra el ritmo (#11) ───────────────────────────────────

// Referencia del mes: el ingreso registrado, igual que el Anillo Vivo; sin
// ingreso, lo gastado el mes anterior. null si no hay con qué comparar.
export function paceReference({ income = 0, prevExpenses = 0 }) {
  if (income > 0) return { value: income, kind: 'income' }
  if (prevExpenses > 0) return { value: prevExpenses, kind: 'prev' }
  return null
}

// Suma a cumulativeByDay la línea de ritmo: la referencia repartida parejo.
export function paceSeries(cum, reference) {
  const n = (cum || []).length
  return (cum || []).map((d, i) => ({
    day: d.day,
    current: d.current,
    pace: reference > 0 && n > 0 ? Math.round((reference * (i + 1) / n) * 100) / 100 : null,
  }))
}

export function paceConclusion(series, { closed = false } = {}) {
  const known = (series || []).filter(d => d.current != null && d.pace != null)
  const last = known[known.length - 1]
  if (!last || !(last.current > 0)) return null
  const diff = last.current - last.pace
  const close = Math.abs(diff) <= last.pace * PACE_OK
  const tail = closed ? 'Closed' : ''
  if (close) return line(`reading.title.pace.even${tail}`)
  return line(`reading.title.pace.${diff > 0 ? 'over' : 'under'}${tail}`, { amount: money(Math.abs(diff)) })
}

// ── Texto ───────────────────────────────────────────────────────────────────

const upperFirst = (s) => (s ? s[0].toLocaleUpperCase() + s.slice(1) : s)

// `fmt`: { money(n), usd(n), pct(fracción), cat(c), month(ym) } y `t` de useT.
export function renderReading(l, { t, fmt }) {
  if (!l) return ''
  const vars = {}
  for (const [k, v] of Object.entries(l.vars || {})) {
    if (v && typeof v === 'object') {
      if ('money' in v) vars[k] = fmt.money(v.money)
      else if ('usd' in v) vars[k] = fmt.usd(v.usd)
      else if ('pct' in v) vars[k] = fmt.pct(v.pct)
      else if ('cat' in v) vars[k] = fmt.cat(v.cat)
      else if ('month' in v) vars[k] = fmt.month(v.month)
      else if ('left' in v) vars[k] = t(v.left === 0 ? 'reading.left.zero' : v.left === 1 ? 'reading.left.one' : 'reading.left.many', { n: v.left })
    } else vars[k] = v
  }
  return upperFirst(t(l.key, vars))
}
