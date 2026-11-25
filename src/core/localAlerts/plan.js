// @ts-check
// src/core/localAlerts/plan.js — qué avisos locales programar (24-nov-2026).
//
// Lógica PURA (sin React, DOM ni plugins; tests en plan.test.js). Todo se
// calcula en el dispositivo con los datos de la persona: no hay servidor.
// Cuatro tipos, cada uno se puede apagar en Ajustes › Notificaciones:
//   fixedDue  "Vence un fijo mañana": a las 9:00 del día anterior a cada
//             ocurrencia PENDIENTE de un fijo de gasto (monthPlan), dentro de
//             HORIZON_DAYS. Sin reglas de inversión ni pausadas.
//   budget    "Presupuesto de <categoría> al 90 %": una vez por categoría y mes,
//             cuando el gasto llega al BUDGET_ALERT_PCT del límite efectivo
//             (utils/budgets.js, con rollover si está encendido).
//   left      "Te quedan $X para el resto del mes" (utils/monthLeft.js, la
//             misma cifra del Inicio): cada lunes a las 9:00 (si el lunes cae
//             en el mismo mes) y, una vez al mes, cuando baja del LEFT_LOW_PCT
//             de lo disponible. Solo con ingreso registrado y saldo positivo.
//   payday    "Día de cobro": a las 9:00 del día de cada ingreso fijo
//             pendiente. Solo sale de reglas de ingreso: si no hay, no hay aviso.
// Horario tranquilo: nada entre QUIET_START y QUIET_END; lo inmediato que caiga
// ahí se corre a las DELIVER_HOUR del día siguiente (y si ya no aplica, no se
// manda). Como la app es manual, los datos solo cambian con la app abierta:
// reprogramar al abrir y al cambiar los datos mantiene las cifras al día.
//
// `ledger` = { [key]: ms } de lo ya programado o mostrado. Una clave con hora
// pasada cuenta como entregada y no se repite; con hora futura se vuelve a
// programar (con la cifra nueva). Las claves llevan la fecha o el mes, así el
// mes siguiente vuelve a avisar.
import { monthPlan, addDays, daysInMonth, parseYMD } from '../../utils/recurring.js'
import { monthLeft } from '../../utils/monthLeft.js'
import { effectiveBudgetLimits } from '../../utils/budgets.js'

export const ALERT_TYPES = /** @type {const} */ (['fixedDue', 'budget', 'left', 'payday'])
export const DELIVER_HOUR = 9
export const QUIET_START = 21
export const QUIET_END = 8
export const BUDGET_ALERT_PCT = 0.9
export const LEFT_LOW_PCT = 0.2
export const HORIZON_DAYS = 14
export const MAX_SCHEDULED = 24 // iOS guarda hasta 64 pendientes por app
export const MIN_DELAY_MS = 2000 // lo inmediato sale a los 2 s (native.js)
const DAY_MS = 24 * 3600 * 1000
const LEDGER_KEEP_DAYS = 45

const pad = (/** @type {number} */ n) => String(n).padStart(2, '0')
/** @param {Date} d */
export const ymdOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
/** @param {string} s @param {number} hour */
function at(s, hour) {
  const p = parseYMD(s)
  return p ? new Date(p.y, p.m - 1, p.d, hour, 0, 0, 0).getTime() : NaN
}

/** Preferencias por tipo (settings.localAlerts). Sin dato = encendido. */
/** @param {any} settings */
export function alertPrefs(settings) {
  const p = (settings && typeof settings.localAlerts === 'object' && settings.localAlerts) || {}
  const out = /** @type {Record<string, boolean>} */ ({})
  for (const k of [...ALERT_TYPES, 'amounts']) out[k] = p[k] !== false
  // Ocultar montos (T13) también los saca de los avisos.
  if (settings?.hideAmounts) out.amounts = false
  return out
}

/** Primer momento permitido desde `ms`: fuera del horario tranquilo. */
/** @param {number} ms */
export function nextAllowed(ms) {
  const d = new Date(ms)
  const h = d.getHours()
  if (h >= QUIET_START) {
    const n = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, DELIVER_HOUR, 0, 0, 0)
    return n.getTime()
  }
  if (h < QUIET_END) return new Date(d.getFullYear(), d.getMonth(), d.getDate(), DELIVER_HOUR, 0, 0, 0).getTime()
  return ms
}

/** Id numérico estable (32 bits, positivo) para el plugin nativo. FNV-1a. */
/** @param {string} key */
export function alertId(key) {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0) % 2147483647 || 1
}

const delivered = (/** @type {Record<string, number>} */ ledger, /** @type {string} */ key, /** @type {number} */ now) =>
  Number.isFinite(ledger?.[key]) && ledger[key] <= now

/**
 * @param {{ incomes?: any[], expenses?: any[], setAsides?: any[], budgets?: any[], recurring?: any[],
 *   settings?: any, now?: number | Date, ledger?: Record<string, number> }} p
 * @returns {{ alerts: Array<{ key: string, id: number, type: string, at: number, vars: any }>,
 *   current: Array<{ key: string, type: string, vars: any }> }}
 *   `alerts`: lo que hay que programar o mostrar (hora ≥ ahora, sin lo ya
 *   entregado), ordenado por hora. `current`: lo que vale HOY para la tarjeta
 *   del Inicio (sin mirar lo entregado).
 */
export function planLocalAlerts({ incomes = [], expenses = [], setAsides = [], budgets = [], recurring = [], settings = {}, now = Date.now(), ledger = {} }) {
  const nowMs = now instanceof Date ? now.getTime() : Number(now)
  const today = new Date(nowMs)
  const todayS = ymdOf(today)
  const month = todayS.slice(0, 7)
  const prefs = alertPrefs(settings)
  const soon = nextAllowed(nowMs)
  const soonS = ymdOf(new Date(soon))
  /** @type {Array<{ key: string, id: number, type: string, at: number, vars: any }>} */
  const alerts = []
  /** @type {Array<{ key: string, type: string, vars: any }>} */
  const current = []
  const add = (/** @type {string} */ type, /** @type {string} */ key, /** @type {number} */ when, /** @type {any} */ vars) => {
    if (!prefs[type] || !Number.isFinite(when) || delivered(ledger, key, nowMs)) return
    alerts.push({ key, id: alertId(key), type, at: when, vars })
  }

  // ── Fijos (gasto) y días de cobro (ingreso): plan de este mes y el siguiente
  const rules = Array.isArray(recurring) ? recurring : []
  const horizon = addDays(todayS, HORIZON_DAYS)
  const nextMonth = horizon.slice(0, 7)
  const plan = monthPlan(rules, month, { incomes, expenses, today: todayS })
  const occs = nextMonth !== month ? [...plan, ...monthPlan(rules, nextMonth, { incomes, expenses, today: todayS })] : plan
  for (const o of occs) {
    if (o.status !== 'pending' || o.rule?.inv || o.rule?.paused) continue
    if (o.date < todayS || o.date > horizon) continue
    const name = String(o.rule?.description || '').trim() || String(o.rule?.category || '')
    const vars = { name, amount: Number(o.amount) || 0, date: o.date }
    if (o.kind === 'expense') {
      const eve = addDays(o.date, -1)
      if (eve === todayS) current.push({ key: `fixed:${o.ruleId}|${o.date}`, type: 'fixedDue', vars })
      const target = at(eve, DELIVER_HOUR)
      const when = target > nowMs ? target : (soonS === eve ? soon : NaN)
      add('fixedDue', `fixed:${o.ruleId}|${o.date}`, when, vars)
    } else if (o.kind === 'income') {
      if (o.date === todayS) current.push({ key: `payday:${o.ruleId}|${o.date}`, type: 'payday', vars })
      const target = at(o.date, DELIVER_HOUR)
      const when = target > nowMs ? target : (soonS === o.date ? soon : NaN)
      add('payday', `payday:${o.ruleId}|${o.date}`, when, vars)
    }
  }

  // ── Presupuestos al 90 %
  const bs = (Array.isArray(budgets) ? budgets : []).filter(b => b && b.category)
  if (bs.length) {
    const limits = effectiveBudgetLimits({ budgets: bs, expenses, activeMonth: month, settings })
    /** @type {Record<string, number>} */
    const spent = {}
    for (const e of expenses || []) {
      if (e?.date?.startsWith(month) && !e.inv) spent[e.category] = (spent[e.category] || 0) + (Number(e.amount) || 0)
    }
    for (const cat of [...new Set(bs.map(b => b.category))]) {
      const limit = limits[cat] || 0
      const s = Math.round((spent[cat] || 0) * 100) / 100
      if (!(limit > 0) || s < limit * BUDGET_ALERT_PCT) continue
      const vars = { cat, pct: Math.floor((s / limit) * 100), spent: s, limit }
      const key = `budget:${cat}:${month}`
      current.push({ key, type: 'budget', vars })
      add('budget', key, soonS.startsWith(month) ? soon : NaN, vars)
    }
  }

  // ── Lo que te queda del mes
  const ml = monthLeft({ incomes, expenses, setAsides, month, plan, today: todayS })
  const pool = ml.income - ml.setAside - ml.fixedPaid - ml.pendingFixed
  if (ml.income > 0 && ml.left > 0) {
    const [y, mo] = month.split('-').map(Number)
    const dim = daysInMonth(y, mo)
    const daysFrom = (/** @type {number} */ day) => dim - day + 1
    const low = pool > 0 && ml.left < pool * LEFT_LOW_PCT
    if (low) {
      const days = daysFrom(today.getDate())
      const vars = { amount: ml.left, days, daily: ml.left / days, low: true }
      const key = `left:low:${month}`
      current.push({ key, type: 'left', vars })
      add('left', key, soonS.startsWith(month) ? soon : NaN, vars)
    }
    // Próximo lunes (nunca hoy), si sigue en este mes.
    const dow = today.getDay() // 0 = domingo
    const monday = addDays(todayS, ((8 - dow) % 7) || 7)
    if (monday.startsWith(month)) {
      const days = daysFrom(Number(monday.slice(8, 10)))
      add('left', `left:week:${monday}`, at(monday, DELIVER_HOUR), { amount: ml.left, days, daily: ml.left / days, low: false })
    }
  }

  alerts.sort((a, b) => a.at - b.at || a.key.localeCompare(b.key))
  return { alerts: alerts.slice(0, MAX_SCHEDULED), current }
}

/** Lo que se entrega ya (web: notificación con la app abierta). */
/** @param {Array<{ at: number }>} alerts @param {number} now */
export function dueNow(alerts, now, slackMs = 60_000) {
  return (alerts || []).filter(a => a.at <= now + slackMs)
}

/**
 * Hora real de entrega: el plugin nativo no programa nada antes de `now +
 * minDelayMs` (lo "inmediato" sale unos segundos después). El ledger guarda
 * esta hora, no la planeada: si guardara una hora ya pasada, una
 * reprogramación en esos segundos lo daría por entregado y lo cancelaría.
 * @template {{ at: number }} A @param {A[]} alerts @param {number} now
 * @returns {A[]}
 */
export function withFireTimes(alerts, now, minDelayMs = MIN_DELAY_MS) {
  return (alerts || []).map(a => ({ ...a, at: Math.max(a.at, now + minDelayMs) }))
}

/** Ledger con lo programado/mostrado, sin entradas viejas. */
/** @param {Record<string, number>} ledger @param {Array<{ key: string, at: number }>} alerts @param {number} now */
export function withRecorded(ledger, alerts, now) {
  /** @type {Record<string, number>} */
  const out = {}
  const cutoff = now - LEDGER_KEEP_DAYS * DAY_MS
  for (const [k, v] of Object.entries(ledger || {})) if (Number.isFinite(v) && v >= cutoff) out[k] = v
  for (const a of alerts || []) out[a.key] = a.at
  return out
}

/** Lee el ledger guardado (string JSON); cualquier cosa rara = vacío. */
/** @param {string | null | undefined} raw */
export function readLedger(raw) {
  try {
    const v = JSON.parse(raw || '{}')
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  } catch { return {} }
}

// ── Título y cuerpo de cada aviso (antes text.js; un solo módulo = un chunk menos).
// `t` = traductor (src/extras/strings.*.js), `money(n)` = monto formateado,
// `cat(name)` = nombre visible de la categoría. Con `amounts: false`
// (preferencia u "Ocultar montos") ningún texto lleva cifras.
/**
 * @param {{ type: string, vars: any }} alert
 * @param {{ t: (k: string, v?: any) => string, money: (n: number) => string, cat?: (c: string) => string, amounts?: boolean }} f
 */
export function alertText(alert, { t, money, cat = (c) => c, amounts = true }) {
  const v = alert?.vars || {}
  switch (alert?.type) {
    case 'fixedDue':
      return { title: t('la.fixedDue.title'), body: amounts ? t('la.fixedDue.body', { name: v.name, amount: money(v.amount) }) : t('la.fixedDue.bodyHidden', { name: v.name }) }
    case 'budget':
      // Con montos ocultos, la pantalla bloqueada no dice categoría ni porcentaje.
      return {
        title: amounts ? t('la.budget.title', { cat: cat(v.cat), pct: v.pct }) : t('la.budget.titleHidden'),
        body: amounts ? t('la.budget.body', { spent: money(v.spent), limit: money(v.limit) }) : t('la.budget.bodyHidden'),
      }
    case 'left': {
      const one = v.days === 1 ? '.one' : '' // "1 día", no "1 días"
      if (!amounts) return { title: t('la.left.titleHidden'), body: t(`la.left.bodyHidden${one}`, { days: v.days }) }
      return {
        title: t('la.left.title', { amount: money(v.amount) }),
        body: v.low ? t(`la.left.bodyLow${one}`, { days: v.days }) : t(`la.left.body${one}`, { daily: money(v.daily), days: v.days }),
      }
    }
    case 'payday':
      return { title: t('la.payday.title', { name: v.name }), body: amounts ? t('la.payday.body', { amount: money(v.amount) }) : t('la.payday.bodyHidden') }
    default:
      return null
  }
}
