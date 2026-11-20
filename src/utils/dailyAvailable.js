// src/utils/dailyAvailable.js — el mes día a día de la ChartLupa del Inicio
// (Entrega 1.5). Funciones puras: la serie, el ritmo ideal, la proyección, el
// día de cobro, qué día está bajo el dedo y el teclado.
//
// v3 (18-nov, revisión de Walter): el gráfico es el GASTO ACUMULADO del mes
// contra el ritmo ideal (estilo Copilot Money), no el disponible: una línea que
// solo sube, sin saltos por los ingresos. Mismas cuentas que el resto del Inicio:
//   - gastado(d) = gastos registrados del día 1 al d. En el mes en curso, un
//     gasto con fecha posterior a hoy cuenta hoy (como "Te queda").
//   - ritmo ideal(d) = ingreso registrado del mes × d / días: una recta de ~0 al
//     ingreso del mes el último día. Es la misma cuenta del Anillo Vivo
//     (`pulse`: gastado/ingreso contra día/días), de la frase del mes
//     (monthReading) y del gráfico de ritmo de Panorama (paceSeries).
//   - píldora = ideal(hoy) − gastado(hoy): > 0 "por delante", < 0 "por detrás",
//     pareja dentro del 2 % del ingreso (PACE_OK). Como mide a hoy, todo ingreso
//     registrado del mes ya cuenta; un cobro que no llegó no cambia el ideal.
//   - proyección = la de projectEndOfMonth (projection.js), la misma de la
//     tarjeta Proyección: mediana diaria sin los fijos + fijos pendientes. Antes
//     era gastado(hoy) + promedio × días que faltan, y el arriendo pagado el
//     día 1 se extrapolaba como gasto diario (auditoría 360, ENG-N2).
//   - disponible(d) = ingresos hasta d − gastos hasta d − apartado hasta d (para
//     "te quedaban"): la misma cuenta de "Te queda" (utils/monthLeft.js). Lo
//     apartado no es gasto: no sube la línea del gasto ni mueve el ritmo.
// Quien llama ya sacó los movimientos de inversión (r.inv), como useHomeData.

import { projectEndOfMonth } from './projection.js'
import { isSetAside } from './setAside.js'

// Mismo criterio que monthPosition (utils/monthReading.js), copiado acá para
// que la ChartLupa no arrastre al trozo todo monthReading/dashboardModel.
function monthPosition(activeMonth, now) {
  const [y, mo] = String(activeMonth).split('-').map(Number)
  const days = new Date(y, mo, 0).getDate()
  const cy = now.getFullYear(), cm = now.getMonth() + 1
  if (y < cy || (y === cy && mo < cm)) return { mode: 'past', today: days, days }
  if (y > cy || (y === cy && mo > cm)) return { mode: 'future', today: 0, days }
  return { mode: 'current', today: now.getDate(), days }
}

const dayOf = (r) => Number(String(r?.date || '').slice(8, 10))
export const PACE_EVEN = 0.02   // igual que PACE_OK de monthReading y `pulse`

// Serie del mes. `income` = ingreso registrado del mes (kpis.totalInc); sin
// ingreso no hay ritmo ideal. `plan` = monthPlan() del mes, para ubicar el cobro
// previsto si todavía no se registró. `pending` = pendingTotals(plan), los
// fijos que faltan (los suma la proyección, como en la tarjeta Proyección).
export function dailyAvailable({ incomes = [], expenses = [], setAsides = [], activeMonth, now = new Date(), income = 0, plan = [], pending = null }) {
  const pos = monthPosition(activeMonth, now)
  const days = pos.days
  const lastDay = pos.today
  const earned = new Array(days + 1).fill(0)
  const spent = new Array(days + 1).fill(0)
  const aside = new Array(days + 1).fill(0)
  const add = (arr, r) => {
    if (typeof r?.date !== 'string' || !r.date.startsWith(activeMonth)) return
    let d = dayOf(r)
    if (!(d >= 1 && d <= days)) return
    if (pos.mode === 'current' && d > lastDay) d = lastDay
    if (d < 1) return
    arr[d] += Number(r.amount) || 0
  }
  for (const r of incomes || []) add(earned, r)
  for (const r of expenses || []) add(isSetAside(r) ? aside : spent, r)
  for (const r of setAsides || []) if (isSetAside(r)) add(aside, r)

  const avail = new Array(days + 1).fill(0)
  const spentCum = new Array(days + 1).fill(0)
  let earnedCum = 0, asideCum = 0
  for (let d = 1; d <= days; d++) {
    earnedCum += earned[d]
    asideCum += aside[d]
    spentCum[d] = round2(spentCum[d - 1] + spent[d])
    avail[d] = round2(earnedCum - spentCum[d] - asideCum)
  }
  const ref = Number(income) > 0 ? Number(income) : null
  const ideal = ref == null ? null : spentCum.map((_, d) => round2(ref * d / days))
  const projEnd = pos.mode === 'current' && lastDay < days
    ? Math.max(spentCum[lastDay], projectEndOfMonth({ incomes, expenses, activeMonth, pending, now }).projExp)
    : null
  return {
    mode: pos.mode, days, lastDay, income: ref,
    spent, spentCum, earned, avail, ideal,
    projEnd,
    payday: paydayOf({ incomes, activeMonth, plan, days }),
  }
}

// Día de cobro: el ingreso más grande del mes (registrado o previsto en los
// fijos). null si no hay ninguno.
export function paydayOf({ incomes = [], activeMonth, plan = [], days = 31 }) {
  let best = null
  const take = (day, amount) => {
    if (!(day >= 1 && day <= days) || !(amount > 0)) return
    if (!best || amount > best.amount) best = { day, amount }
  }
  for (const r of incomes || []) if (r?.date?.startsWith(activeMonth)) take(dayOf(r), Number(r.amount) || 0)
  for (const o of plan || []) {
    if (o?.kind !== 'income' || o?.rule?.inv || o.status === 'skipped' || o.status === 'confirmed') continue
    if (typeof o.date === 'string' && o.date.startsWith(activeMonth)) take(dayOf(o), Number(o.expected) || 0)
  }
  return best ? best.day : null
}

// Ritmo de hoy: la píldora y el anillo del detalle (pulse) son la misma cuenta.
//   gap   = ideal(hoy) − gastado(hoy)
//   over  = gastado/ingreso − hoy/días  (lo que mide `pulse`)
//   level = 'ok' ≤ 2 %, 'attention' ≤ 10 %, 'risk' (umbrales del Anillo Vivo)
export function paceToday(series) {
  if (!series || series.mode !== 'current' || !series.ideal || !(series.lastDay >= 1)) return null
  const d = series.lastDay
  const gap = round2(series.ideal[d] - series.spentCum[d])
  const over = series.spentCum[d] / series.income - d / series.days
  return { gap, over, even: Math.abs(over) <= PACE_EVEN, level: over <= PACE_EVEN ? 'ok' : over <= 0.10 ? 'attention' : 'risk' }
}

// ── Geometría (unidades del viewBox) ────────────────────────────────────────
export const CHART_W = 358
export const CHART_H = 140
export const CHART_PAD = { l: 8, r: 8, t: 24, b: 10 }

export function xOf(day, days, W = CHART_W, P = CHART_PAD) {
  return P.l + (days > 1 ? (day - 1) / (days - 1) * (W - P.l - P.r) : 0)
}

// De 0 al mayor de lo gastado, el ideal del último día y la proyección, con
// aire arriba (el pico, el aro de la lupa y su mango nunca se cortan).
export function yDomain(series) {
  let max = series.lastDay >= 1 ? series.spentCum[series.lastDay] : 0
  if (series.ideal) max = Math.max(max, series.ideal[series.days])
  if (series.projEnd != null) max = Math.max(max, series.projEnd)
  if (!(max > 0)) max = 1
  return [0, max * 1.08]
}

export function yOf(v, [min, max], H = CHART_H, P = CHART_PAD) {
  return P.t + (max - v) / (max - min) * (H - P.t - P.b)
}

// Qué día está bajo el puntero: `clientX` en px de pantalla, `rect` del
// gráfico (getBoundingClientRect). Se limita a [1, maxDay].
export function dayAt(clientX, rect, { days, maxDay = days, W = CHART_W, P = CHART_PAD }) {
  if (!rect || !(rect.width > 0) || !(days >= 1)) return 1
  const vx = (clientX - rect.left) / rect.width * W
  const raw = Math.round((vx - P.l) / (W - P.l - P.r) * (days - 1)) + 1
  return Math.max(1, Math.min(Math.max(1, maxDay), raw))
}

// Teclado del slider (patrón APG): flechas ±1, Re Pág/Av Pág ±7, Inicio y
// Fin. Devuelve el día nuevo o null si la tecla no es del slider.
export function keyStep(key, cur, maxDay) {
  const max = Math.max(1, maxDay)
  switch (key) {
    case 'ArrowLeft': case 'ArrowDown': return Math.max(1, cur - 1)
    case 'ArrowRight': case 'ArrowUp': return Math.min(max, cur + 1)
    case 'PageDown': return Math.max(1, cur - 7)
    case 'PageUp': return Math.min(max, cur + 7)
    case 'Home': return 1
    case 'End': return max
    default: return null
  }
}

// Dónde va la lente (px del gráfico). Con el dedo sube por encima del punto
// para no quedar tapada; si arriba no entra (taparía la cifra protagonista),
// se corre al costado, como el callout de Shift (Vogel y Baudisch, 2007). Con
// el mouse se centra en el punto. En reposo queda chica sobre hoy.
export function lensPlacement({ x, y, mode, width, R = 44, lift = 40, topRoom = 30 }) {
  let cx = x, cy = y, scale = 1
  if (mode === 'rest') scale = 0.5
  else if (mode === 'touch') {
    cy = y - R - lift
    if (cy - R < -topRoom) { cy = y - 10; cx = x + (x > width / 2 ? -(R + 34) : (R + 34)) }
  } else if (mode === 'key') {
    // Sin dedo encima: arriba si entra; si no, al costado (abajo taparía el eje).
    cy = y - R - 30
    if (cy - R < -topRoom) { cy = y - 10; cx = x + (x > width / 2 ? -(R + 34) : (R + 34)) }
  }
  cx = Math.max(R - 6, Math.min(width - R + 6, cx))
  return { cx, cy, scale }
}

function round2(v) { return Math.round(v * 100) / 100 }
