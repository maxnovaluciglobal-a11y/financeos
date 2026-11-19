// src/utils/dailyAvailable.js — "disponible día a día" del mes (Entrega 1.5,
// ChartLupa del Inicio). Funciones puras: la serie, el ritmo ideal, la
// proyección, el día de cobro, qué día está bajo el dedo y el teclado.
//
// Mismas reglas que el resto del Inicio, para que el gráfico no contradiga a
// la cifra que tiene encima:
//   - disponible(d) = ingresos registrados hasta d − gastos registrados hasta d
//     ("Te queda" es solo lo real, decisión del 08-oct-2026). En el mes en
//     curso, un movimiento con fecha posterior a hoy cuenta hoy: así el punto
//     de hoy es EXACTAMENTE la cifra "Te queda" (homeMonthTotals.freeFlow).
//   - ritmo ideal = UNA recta (v2, pedido de Walter del 18-nov: nada de
//     dientes de sierra en cada cobro). Arranca el día de cobro (inicio del
//     ciclo) con todo lo que el mes trae para gastar —la referencia del Anillo
//     Vivo (ingreso registrado del mes; sin ingreso, el gasto del mes anterior)
//     menos lo ya gastado antes del cobro— y baja parejo hasta 0 el último día.
//     Antes del cobro no hay ideal: esos días se dibujan atenuados.
//     La distancia de hoy contra esa recta es la píldora "por delante/detrás".
//   - proyección = projBal de projectEndOfMonth (la misma de ProjectionCard).
// Quien llama ya sacó los movimientos de inversión (r.inv), como useHomeData.

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

// Serie del mes. `reference` = paceReference().value (o null). `projBal` =
// projectEndOfMonth().projBal (o null). `plan` = monthPlan() del mes, para
// ubicar el cobro previsto si todavía no se registró.
export function dailyAvailable({ incomes = [], expenses = [], activeMonth, now = new Date(), reference = null, projBal = null, plan = [] }) {
  const pos = monthPosition(activeMonth, now)
  const days = pos.days
  const lastDay = pos.today
  const earned = new Array(days + 1).fill(0)
  const spent = new Array(days + 1).fill(0)
  const add = (arr, r) => {
    if (typeof r?.date !== 'string' || !r.date.startsWith(activeMonth)) return
    let d = dayOf(r)
    if (!(d >= 1 && d <= days)) return
    if (pos.mode === 'current' && d > lastDay) d = lastDay
    if (d < 1) return
    arr[d] += Number(r.amount) || 0
  }
  for (const r of incomes || []) add(earned, r)
  for (const r of expenses || []) add(spent, r)

  const avail = new Array(days + 1).fill(0)
  const earnedCum = new Array(days + 1).fill(0)
  const spentCum = new Array(days + 1).fill(0)
  for (let d = 1; d <= days; d++) {
    earnedCum[d] = earnedCum[d - 1] + earned[d]
    spentCum[d] = spentCum[d - 1] + spent[d]
    avail[d] = round2(earnedCum[d] - spentCum[d])
  }
  const ref = Number(reference) > 0 ? Number(reference) : null
  const payday = paydayOf({ incomes, activeMonth, plan, days })
  // Inicio del ciclo: el cobro, si ya ocurrió (en el mes en curso, hasta hoy).
  const cycleStart = payday && payday <= Math.max(1, lastDay) ? payday : 1
  let ideal = null
  if (ref != null) {
    const startValue = ref - spentCum[cycleStart - 1]
    const span = Math.max(1, days - cycleStart)
    ideal = avail.map((_, d) => (d < cycleStart || d === 0 ? null : round2(startValue * (days - d) / span)))
  }

  return {
    mode: pos.mode, days, lastDay,
    avail, earned, spent, ideal,
    // La proyección solo existe en el mes en curso, desde hoy hasta el último día.
    projEnd: pos.mode === 'current' && lastDay < days && Number.isFinite(Number(projBal)) && projBal != null ? Number(projBal) : null,
    payday, cycleStart,
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

// Distancia de hoy contra el ritmo ideal: > 0 = gastó menos que el ritmo.
export function paceGap(series, day = series?.lastDay) {
  if (!series?.ideal || !(day >= 1) || series.ideal[day] == null) return null
  return round2(series.avail[day] - series.ideal[day])
}

// ── Geometría (unidades del viewBox) ────────────────────────────────────────
export const CHART_W = 358
export const CHART_H = 132
export const CHART_PAD = { l: 8, r: 8, t: 26, b: 10 }

export function xOf(day, days, W = CHART_W, P = CHART_PAD) {
  return P.l + (days > 1 ? (day - 1) / (days - 1) : 0) * (W - P.l - P.r)
}

// Rango vertical con aire, incluyendo el cero si la serie lo cruza.
export function yDomain(series) {
  const vals = []
  for (let d = 1; d <= series.lastDay; d++) vals.push(series.avail[d])
  if (series.ideal) for (let d = 1; d <= series.days; d++) if (series.ideal[d] != null) vals.push(series.ideal[d])
  if (series.projEnd != null) vals.push(series.projEnd)
  if (!vals.length) vals.push(0)
  let min = Math.min(...vals), max = Math.max(...vals)
  if (min > 0 && min < max * 0.25) min = 0
  if (max === min) { max += 1; min -= 1 }
  // Aire arriba para el pico, el anillo de la lupa en reposo y el mango.
  const span = max - min
  return [min - span * 0.06, max + span * 0.1]
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
