// src/utils/dailyAvailable.js — el mes día a día de la ChartLupa del Inicio
// (Entrega 1.5). Funciones puras: la serie, el ritmo ideal, la proyección, el
// día de cobro, qué día está bajo el dedo y el teclado.
//
// v3 (18-nov, revisión de Walter): el gráfico es el GASTO ACUMULADO del mes
// contra el ritmo ideal (estilo Copilot Money), no el disponible: una línea que
// solo sube, sin saltos por los ingresos. Mismas cuentas que el resto del Inicio:
//   - gastado(d) = gastos registrados del día 1 al d. En el mes en curso, un
//     gasto con fecha posterior a hoy cuenta hoy (como "Te queda").
//   - ritmo ideal(d) = fijos ya pagados + disponible × d / días, con
//     disponible = ingreso − apartado − fijos (pagados y por pagar). Es la
//     cuenta del veredicto del mes (utils/monthPace.js, I-22): los fijos se
//     reservan enteros desde el día 1 y lo demás se reparte parejo. Sin fijos
//     ni apartado es la recta de ~0 al ingreso del mes de siempre.
//   - píldora = ideal(hoy) − gastado(hoy) = monthPace().gap; > 0 "por
//     delante", < 0 "por detrás", pareja dentro del 2 % (PACE_OK). La píldora,
//     el Anillo Vivo y la frase del mes (Inicio y Panorama) son paceVerdict.
//   - proyección = la de projectEndOfMonth (projection.js), la misma de la
//     tarjeta Proyección: mediana diaria sin los fijos + fijos pendientes. Antes
//     era gastado(hoy) + promedio × días que faltan, y el arriendo pagado el
//     día 1 se extrapolaba como gasto diario (auditoría 360, ENG-N2).
//   - disponible(d) = ingresos hasta d − gastos hasta d − apartado hasta d (para
//     "te quedaban"): la misma cuenta de "Te queda" (utils/monthLeft.js). Lo
//     apartado no es gasto: no sube la línea del gasto ni mueve el ritmo.
//   - UX-N2 (23-nov-2026): "Te queda" descuenta los fijos de gasto que faltan.
//     En el mes en curso, disponible(hoy) también los descuenta (`pendingFixed`
//     = monthLeft().pendingFixed), para que "te queda" de la lupa y de la hoja
//     del día sea la cifra grande. Los días pasados quedan como lo registrado
//     ("te quedaban" es historia: ese día el fijo todavía no se había pagado).
//     La línea del gasto NO los suma (no son gasto todavía); la proyección ya
//     los incluía (projectEndOfMonth con `pending`), así que el punto final
//     proyectado y la cifra grande cuentan los mismos fijos.
// Quien llama ya sacó los movimientos de inversión (r.inv), como useHomeData.

import { projectEndOfMonth } from './projection.js'
import { isSetAside, uniqueSetAsides } from './setAside.js'
import { PACE_OK, paceVerdict } from './monthPace.js'

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
export const PACE_EVEN = PACE_OK   // la tolerancia del veredicto del mes (monthPace.js)

// Serie del mes. `income` = ingreso registrado del mes (kpis.totalInc); sin
// ingreso no hay ritmo ideal. `plan` = monthPlan() del mes, para ubicar el cobro
// previsto si todavía no se registró. `pending` = pendingTotals(plan), los
// fijos que faltan (los suma la proyección, como en la tarjeta Proyección).
// `pendingFixed` = monthLeft().pendingFixed: lo que "Te queda" ya descuenta.
// `fixedPaid` = monthLeft().fixedPaid: fijos de gasto ya pagados (I-22).
export function dailyAvailable({ incomes = [], expenses = [], setAsides = [], activeMonth, now = new Date(), income = 0, plan = [], pending = null, pendingFixed = 0, fixedPaid = 0 }) {
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
  for (const r of expenses || []) if (!isSetAside(r)) add(spent, r)
  // Un apartado que llegue en las dos listas cuenta una sola vez.
  for (const r of uniqueSetAsides(setAsides, expenses)) add(aside, r)

  const avail = new Array(days + 1).fill(0)
  const spentCum = new Array(days + 1).fill(0)
  let earnedCum = 0, asideCum = 0
  for (let d = 1; d <= days; d++) {
    earnedCum += earned[d]
    asideCum += aside[d]
    spentCum[d] = round2(spentCum[d - 1] + spent[d])
    avail[d] = round2(earnedCum - spentCum[d] - asideCum)
  }
  const fixed = pos.mode === 'current' ? Math.max(0, Number(pendingFixed) || 0) : 0
  if (fixed > 0) for (let d = Math.max(1, lastDay); d <= days; d++) avail[d] = round2(avail[d] - fixed)
  const ref = Number(income) > 0 ? Number(income) : null
  // Fijos ya pagados y por pagar: los mismos que usa el veredicto del mes. Un
  // mes pasado no tiene nada por pagar (monthLeft).
  const pendFixedAll = pos.mode === 'past' ? 0 : Math.max(0, Number(pendingFixed) || 0)
  const paid = Math.min(spentCum[days], Math.max(0, Number(fixedPaid) || 0))
  const pool = ref == null ? 0 : Math.max(0, ref - asideCum - paid - pendFixedAll)
  const ideal = ref == null ? null : spentCum.map((_, d) => round2(paid + pool * d / days))
  const projEnd = pos.mode === 'current' && lastDay < days
    ? Math.max(spentCum[lastDay], projectEndOfMonth({ incomes, expenses, activeMonth, pending, now }).projExp)
    : null
  return {
    mode: pos.mode, days, lastDay, income: ref, pendingFixed: fixed,
    // Para el veredicto (paceToday): apartado del mes y fijos ya pagados.
    setAside: round2(asideCum), fixedPaid: paid, pendingFixedAll: pendFixedAll,
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

// Ritmo de hoy: la píldora y el anillo del detalle son el veredicto del mes
// (paceVerdict, utils/monthPace.js) con las cifras de la serie.
//   gap   = ideal(hoy) − gastado(hoy)
//   over  = variable/disponible − hoy/días
//   level = 'ok' ≤ 2 %, 'attention' ≤ 10 %, 'risk' (o "te queda" < 0)
export function paceToday(series) {
  if (!series || series.mode !== 'current' || !series.ideal || !(series.lastDay >= 1)) return null
  const d = series.lastDay
  const v = paceVerdict({ income: series.income, spent: series.spentCum[d], setAside: series.setAside,
    pendingFixed: series.pendingFixedAll, fixedPaid: series.fixedPaid, today: d, days: series.days, mode: series.mode })
  if (!v) return null
  return { gap: v.gap, over: v.over, even: v.even, level: v.level, cause: v.cause }
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
