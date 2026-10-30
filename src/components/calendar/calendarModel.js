// src/components/calendar/calendarModel.js — lógica pura del calendario de
// Movimientos (B3b) y de lo previsto por día (D4, rial #12, #46, #47).
//
// Sin React (tests en calendarModel.test.js). Fechas siempre 'YYYY-MM-DD' en
// hora local, como utils/recurring.js.
//
// Reglas:
//   - Lo real (ingresos y gastos registrados) se suma por día.
//   - Lo previsto (ocurrencias pendientes de fijos, suscripciones y cuotas de
//     deudas, de monthPlan) va aparte y NUNCA entra en los totales reales. Solo
//     se muestra de hoy en adelante: lo que ya pasó y sigue sin confirmar vive
//     en "Fijos del mes".
//   - Un previsto cuyo origen no tiene fecha (deuda sin vencimiento,
//     suscripción sin próximo cobro) no se ubica en un día: va al grupo
//     "Sin fecha" (rial #47), una vez por regla.

import { parseYMD, ymd, daysInMonth } from '../../utils/recurring.js'

// ── Semana según el país o el idioma ────────────────────────────────────────
// Regiones donde la semana empieza el domingo (CLDR, firstDay = sun). El resto
// empieza el lunes. Se usa si el navegador no expone Intl.Locale#weekInfo.
const SUNDAY_FIRST = new Set(('AG AS BD BR BS BT BW BZ CA CN CO DM DO ET GT GU HK HN ID IL IN JM JP KE KH KR ' +
  'LA MH MM MO MT MX MZ NI NP PA PE PH PK PR PT PY SA SG SV TH TT TW UM US VE VI WS YE ZA ZW').split(' '))

// 0 = domingo, 1 = lunes. `region` (código de país de Ajustes) manda sobre la
// región del locale; sin ninguna de las dos, lunes.
export function weekStartFor(locale, region) {
  const reg = String(region || '').toUpperCase()
  if (/^[A-Z]{2}$/.test(reg)) return SUNDAY_FIRST.has(reg) ? 0 : 1
  try {
    const loc = new Intl.Locale(String(locale || ''))
    const info = typeof loc.getWeekInfo === 'function' ? loc.getWeekInfo() : loc.weekInfo
    if (info && Number(info.firstDay) >= 1) return Number(info.firstDay) === 7 ? 0 : 1
  } catch { /* locale inválido o sin soporte: se sigue con la tabla */ }
  const m = /[-_]([A-Za-z]{2})\b/.exec(String(locale || ''))
  if (m) return SUNDAY_FIRST.has(m[1].toUpperCase()) ? 0 : 1
  return 1
}

// Orden de los días de la semana (0 = domingo … 6 = sábado) empezando en weekStart.
export const weekdayOrder = (weekStart) => Array.from({ length: 7 }, (_, i) => (i + (weekStart ? 1 : 0)) % 7)

// Semanas del mes 'YYYY-MM': cada una con 7 casillas, 'YYYY-MM-DD' o null
// (días de otro mes). Siempre de 4 a 6 semanas.
export function monthWeeks(ym, weekStart = 1) {
  const [y, m] = String(ym || '').split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) return []
  const dim = daysInMonth(y, m)
  const lead = (new Date(y, m - 1, 1).getDay() - (weekStart ? 1 : 0) + 7) % 7
  const cells = Array(lead).fill(null)
  for (let d = 1; d <= dim; d++) cells.push(ymd(y, m, d))
  while (cells.length % 7) cells.push(null)
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

// ── Lo real por día ─────────────────────────────────────────────────────────
const kindOf = (e) => (e?.kind === 'income' ? 'income' : 'expense')
const passesType = (kind, type) => !type || type === 'all' || kind === type

// Map 'YYYY-MM-DD' → { income, expense, items } con los ítems de la lista
// unificada (mergeMovements) del tipo pedido. Montos positivos.
export function realByDay(items, { type = 'all' } = {}) {
  const map = new Map()
  for (const e of Array.isArray(items) ? items : []) {
    if (!e) continue
    const date = String(e.date || '').slice(0, 10)
    if (!parseYMD(date)) continue
    const kind = kindOf(e)
    if (!passesType(kind, type)) continue
    if (!map.has(date)) map.set(date, { income: 0, expense: 0, items: [] })
    const g = map.get(date)
    g[kind] += Math.abs(Number(e.amount) || 0)
    g.items.push(e)
  }
  return map
}

// ── Lo previsto ─────────────────────────────────────────────────────────────
// ¿El origen de la regla no tiene fecha? Deuda sin vencimiento (la regla cae
// el último día por convención) o suscripción sin próximo cobro (la regla se
// ancla a "hoy"). Una regla manual siempre tiene fecha.
export function isUndatedRule(rule, { debts = [], subscriptions = [] } = {}) {
  if (!rule) return false
  if (rule.source === 'debt') {
    const d = (debts || []).find(x => x && x.id === rule.sourceId)
    return !!d && !parseYMD(d.dueDate)
  }
  if (rule.source === 'subscription') {
    const s = (subscriptions || []).find(x => x && x.id === rule.sourceId)
    return !!s && !parseYMD(s.nextPaymentDate)
  }
  return false
}

// Ocurrencias pendientes (monthPlan) desde `today`, del tipo pedido.
// Devuelve { byDay: Map fecha → [occ], undated: [occ] } — undated con una sola
// ocurrencia por regla, la primera.
export function plannedByDay(plan, { today, type = 'all', debts = [], subscriptions = [] } = {}) {
  const byDay = new Map()
  const undated = []
  const seen = new Set()
  for (const o of Array.isArray(plan) ? plan : []) {
    if (!o || o.status !== 'pending') continue
    if (!passesType(o.kind === 'income' ? 'income' : 'expense', type)) continue
    if (isUndatedRule(o.rule, { debts, subscriptions })) {
      if (!seen.has(o.ruleId)) { seen.add(o.ruleId); undated.push(o) }
      continue
    }
    if (!parseYMD(o.date) || (today && o.date < today)) continue
    if (!byDay.has(o.date)) byDay.set(o.date, [])
    byDay.get(o.date).push(o)
  }
  return { byDay, undated }
}

// ── El mes completo ─────────────────────────────────────────────────────────
// weeks: [[celda | null] × 7], celda = { date, day, isToday, isPast, income,
// expense, items, planned, plannedIncome, plannedExpense }. `amount` convierte
// cada cifra (lente de moneda); por defecto la deja igual.
export function buildCalendar({ ym, items = [], plan = [], today = '', type = 'all', weekStart = 1, debts = [], subscriptions = [], amount = (n) => n } = {}) {
  const real = realByDay(items, { type })
  const { byDay, undated } = plannedByDay(plan, { today, type, debts, subscriptions })
  const sum = (list, kind) => list.reduce((s, o) => s + (o.kind === kind ? Math.abs(Number(o.amount) || 0) : 0), 0)
  const weeks = monthWeeks(ym, weekStart).map(week => week.map(date => {
    if (!date) return null
    const r = real.get(date) || { income: 0, expense: 0, items: [] }
    const planned = byDay.get(date) || []
    return {
      date, day: Number(date.slice(8, 10)),
      isToday: date === today, isPast: !!today && date < today,
      income: amount(r.income), expense: amount(r.expense), items: r.items,
      planned, plannedIncome: amount(sum(planned, 'income')), plannedExpense: amount(sum(planned, 'expense')),
    }
  }))
  return { weeks, undated }
}

// Día con el foco al entrar a la cuadrícula: hoy si está en el mes, si no el 1.
export function initialFocusDate(ym, today) {
  if (today && String(today).slice(0, 7) === ym) return today
  return `${ym}-01`
}

// Navegación con teclado dentro del mes (patrón APG de cuadrícula de fechas):
// ←/→ un día, ↑/↓ una semana, Inicio/Fin al comienzo o fin de la semana.
// Nunca sale del mes (se queda en el borde). Tecla sin efecto → null.
export function moveFocus(date, key, { weekStart = 1 } = {}) {
  const p = parseYMD(date)
  if (!p) return null
  const dim = daysInMonth(p.y, p.m)
  const dow = (new Date(p.y, p.m - 1, p.d).getDay() - (weekStart ? 1 : 0) + 7) % 7
  let d = p.d
  switch (key) {
    case 'ArrowLeft': d -= 1; break
    case 'ArrowRight': d += 1; break
    case 'ArrowUp': d -= 7; break
    case 'ArrowDown': d += 7; break
    case 'Home': d -= dow; break
    case 'End': d += 6 - dow; break
    default: return null
  }
  d = Math.min(Math.max(1, d), dim)
  return ymd(p.y, p.m, d)
}

// Cifra corta para una casilla, sin símbolo: 950 · 1,2K · 12K · 1,5M (en el
// separador decimal del locale). El monto completo va en la etiqueta accesible
// y en la hoja del día.
export function compactNumber(n, locale = 'es-CL') {
  const a = Math.abs(Number(n) || 0)
  const fmt = (v, frac) => {
    try { return v.toLocaleString(locale, { maximumFractionDigits: frac, minimumFractionDigits: 0 }) } catch { return String(Math.round(v)) }
  }
  if (a < 1000) return fmt(Math.round(a), 0)
  if (a < 1_000_000) { const v = a / 1000; return fmt(v, v < 10 ? 1 : 0) + 'K' }
  const v = a / 1_000_000
  return fmt(v, v < 10 ? 1 : 0) + 'M'
}
