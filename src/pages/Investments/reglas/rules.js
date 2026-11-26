// src/pages/Investments/reglas/rules.js — "Tus reglas hoy", puro.
//
// Lee, para cada activo que la persona tiene, en qué estado está su propia
// regla (la escalera de Tus tramos y, si la encendió, la condición de RSI).
// NO recalcula nada por su cuenta: los estados de cada tramo salen de
// planCapital (oportunidades/capital.js), así "Se cumplen N de M tramos" es
// exactamente lo que muestra Tus tramos con la misma escalera y la misma
// regla de RSI. Aquí solo se resume y se elige el dato concreto de cada fila.
//
// Tres estados neutros, nunca una calificación del momento:
//  · 'meets' "Cumple tu regla": al menos un tramo en estado 'today' (precio en
//    o bajo su media y, con la regla de RSI encendida, RSI entre 30 y 45).
//    Dato: la media más larga que se cumple y el RSI.
//  · 'near'  "Cerca": ningún tramo se cumple, pero (a) el precio está como
//    mucho NEAR_RULE sobre su media más cercana, o (b) el precio ya está en o
//    bajo una media y lo que falta es la condición de RSI (o su dato).
//  · 'far'   "Lejos": el precio está más de NEAR_RULE sobre todas sus medias.
// Además: 'loading' (la historia no llegó) y 'none' (sin lectura: menos de 20
// cierres o la fuente falló). Esos activos no entran en N ni en M.
//
// NEAR_RULE = 2 %. Por qué: signals.js ya usa ±1 % para decir "en la media"
// (NEAR); "cerca" tiene que ser un poco más ancho, pero no tanto como para
// marcar casi todo. Un 2 % es del orden de lo que se mueve en un día normal
// una acción grande o un ETF amplio (volatilidad diaria típica de 1 a 2 %):
// "cerca" quiere decir "a una sesión corriente de distancia". Con 3 % o más,
// en un mercado tranquilo casi todas las posiciones quedarían "cerca" y el
// estado dejaría de informar. En cripto (que se mueve 3–4 % al día) es más
// estricto a propósito. Es una constante para poder ajustarla en un lugar.
//
// El orden de las filas es el del portafolio: nunca se ordena por estado ni
// por conveniencia, y nada usa el perfil de riesgo de la persona.
import { planCapital, DEFAULT_LADDER, DEFAULT_RSI_RULE } from '../oportunidades/capital.js'
import { readSignal } from '../oportunidades/signals.js'

export const NEAR_RULE = 0.02
// Comparar distancias en millonésimas: 102 / 100 − 1 da 0,020000000000000018
// en coma flotante, y el borde (justo 2 %) tiene que contar como "cerca".
const micro = (x) => Math.round(x * 1e6)
export const STATES = Object.freeze(['meets', 'near', 'far'])

/**
 * Estado de un activo con la regla de la persona.
 * reading: readSignal(...) | null (sin lectura) | undefined (cargando).
 * → { t, state, fact, met, counted, tramos }
 *   fact: { kind: 'meets', n, rsi } | { kind: 'rsi', n, rsi } | { kind: 'dist', n, dist } | null
 *   met: tramos en 'today'; counted: tramos con media ('today' + 'wait').
 */
export function classifyAsset(t, reading, { ladder = DEFAULT_LADDER, rsiRule = DEFAULT_RSI_RULE, near = NEAR_RULE } = {}) {
  if (reading === undefined) return { t, state: 'loading', fact: null, met: 0, counted: 0, tramos: null }
  if (!reading) return { t, state: 'none', fact: null, met: 0, counted: 0, tramos: null }
  const plan = planCapital({ amount: 100, alloc: [{ t, p: 100 }], readings: { [t]: reading }, ladder, rsiRule })
  const tramos = plan.ok ? plan.rows[0].tramos || [] : []
  const met = tramos.filter(x => x.state === 'today')
  const counted = tramos.filter(x => x.state !== 'none')
  const base = { t, met: met.length, counted: counted.length, tramos }
  if (met.length) {
    return { ...base, state: 'meets', fact: { kind: 'meets', n: met[met.length - 1].n, rsi: rsiRule ? reading.rsi : null } }
  }
  const blocked = tramos.filter(x => x.rsiBlocked)
  if (blocked.length) {
    return { ...base, state: 'near', fact: { kind: 'rsi', n: blocked[blocked.length - 1].n, rsi: reading.rsi } }
  }
  const waits = counted.filter(x => x.dist != null && x.dist > 0)
  if (!waits.length) return { ...base, state: 'none', fact: null }
  const nearest = waits.reduce((a, b) => (b.dist < a.dist ? b : a))
  return { ...base, state: micro(nearest.dist) <= micro(near) ? 'near' : 'far', fact: { kind: 'dist', n: nearest.n, dist: nearest.dist } }
}

/**
 * Resumen de la tarjeta. items: [{ t, label?, crypto?, rows }] con rows =
 * historia diaria ({ date, close }) | null (falló) | undefined (cargando).
 * → { rows, met, total, read, none, loading, date }
 *   met / total: "Se cumplen met de total tramos" (solo activos con lectura).
 *   date: 'YYYY-MM-DD' del último cierre más reciente entre los leídos.
 */
export function summarizeRules(items, opts = {}) {
  const seen = new Set()
  const rows = []
  let met = 0, total = 0, read = 0, none = 0, loading = 0, date = null
  for (const it of items || []) {
    if (!it || seen.has(it.t)) continue
    seen.add(it.t)
    const reading = it.reading !== undefined ? it.reading
      : it.rows === undefined ? undefined
        : it.rows ? readSignal(it.rows.map(r => r.close), { crypto: !!it.crypto }) : null
    const r = classifyAsset(it.t, reading, opts)
    rows.push({ ...r, label: it.label || it.t })
    if (r.state === 'loading') { loading++; continue }
    if (r.state === 'none') { none++; continue }
    read++
    met += r.met
    total += r.counted
    const last = it.rows && it.rows.length ? it.rows[it.rows.length - 1]?.date : null
    if (last && (!date || last > date)) date = last
  }
  return { rows, met, total, read, none, loading, date }
}

/**
 * Hechos del mercado, solo descriptivos (los mismos datos que Mercado):
 * SPY (el ETF del S&P 500) frente a sus medias de 50 y 200 días y el VIX con
 * la zona de investMarket.vixZone. → { spy, vix } (cada uno null si falta).
 *   spy: { pos: 'above' | 'below' | 'between' | 'above50' | 'below50' }
 */
export function marketFacts(spyRows, vix, zoneOf) {
  let spy = null
  const r = spyRows ? readSignal(spyRows.map(x => x.close)) : null
  if (r) {
    const s50 = r.smas[1], s200 = r.smas[3]
    if (s50?.value != null && s200?.value != null) {
      const a50 = r.price > s50.value, a200 = r.price > s200.value
      spy = { pos: a50 && a200 ? 'above' : !a50 && !a200 ? 'below' : 'between' }
    } else if (s50?.value != null) spy = { pos: r.price > s50.value ? 'above50' : 'below50' }
  }
  const z = typeof zoneOf === 'function' ? zoneOf(vix) : null
  return { spy, vix: z ? { v: vix, zone: z } : null }
}
