// src/pages/Investments/oportunidades/signals.js — Oportunidades (Inversiones v2), puro.
//
// Dónde está el precio de hoy frente a sus medias móviles simples de 20, 50,
// 100 y 200 días, leído como la escalera de Invest (Plan de Capital,
// app/index.html CAP_LADDERS y renderCapital): cada media es un TRAMO
// (20 → tramo 1, 50 → 2, 100 → 3, 200 → 4) y un tramo "se cumple" cuando el
// precio está EN o BAJO esa media (precio ≤ media, el mismo criterio que
// Invest). Es una lectura de datos con la regla de la persona: nunca dice
// "compra" ni ordena activos por conveniencia.
//
// Reglas de borde:
//  · precio exactamente igual a la media → se cumple (≤);
//  · "en la media" (near) = a ±1 % de ella, solo para el texto;
//  · una media sin cierres suficientes queda null y NO cuenta (ni como
//    cumplida ni como no cumplida): la fila lo dice ("sin la de 200");
//  · menos de 20 cierres válidos → sin lectura (null);
//  · cripto cotiza todos los días: 200 cierres son 200 días corridos; una
//    acción o un ETF, 200 sesiones (unos 9 meses y medio). Solo cambia el texto.
//  · RSI de Wilder de 14 (utils/investIndicators.js, el de Invest) y caída
//    desde el máximo de cierre de las últimas 252 sesiones (o de lo que haya).
import { sma, lastRsi, rsiZone } from '../../../utils/investIndicators.js'

export const SMAS = [20, 50, 100, 200]
export const MIN_CLOSES = SMAS[0]
export const NEAR = 0.01
export const HIGH_WINDOW = 252
// La condición de RSI de la versión original del Plan de Capital (julio de
// 2026): RSI entre 30 y 45. Opcional y apagada por defecto.
export const RSI_RULE = { min: 30, max: 45 }

const lastOf = (arr) => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i]; return null }
const clean = (closes) => (closes || []).map(Number).filter(v => Number.isFinite(v) && v > 0)

/**
 * Lectura de una serie de cierres diarios (del más viejo al más nuevo).
 * → null (menos de 20 cierres) o
 *   { price, closes, crypto, smas: [{ n, tramo, value, dist, hit, near }],
 *     level, deepest, tramos, missing, rsi, rsiZone, high, drawdown }
 * dist = precio / media − 1 (negativo = bajo la media).
 */
export function readSignal(closes, { crypto = false } = {}) {
  const c = clean(closes)
  if (c.length < MIN_CLOSES) return null
  const price = c[c.length - 1]
  const smas = SMAS.map((n, i) => {
    const value = c.length >= n ? lastOf(sma(c, n)) : null
    if (value == null || !(value > 0)) return { n, tramo: i + 1, value: null, dist: null, hit: false, near: false }
    const dist = price / value - 1
    return { n, tramo: i + 1, value, dist, hit: price <= value, near: Math.abs(dist) <= NEAR }
  })
  const hits = smas.filter(x => x.hit)
  const win = c.slice(-HIGH_WINDOW)
  const high = Math.max(...win)
  const rsi = lastRsi(c, 14)
  return {
    price,
    closes: c.length,
    crypto: !!crypto,
    smas,
    level: hits.length,
    deepest: hits.length ? hits[hits.length - 1].n : null,
    tramos: hits.map(x => x.tramo),
    missing: smas.filter(x => x.value == null).map(x => x.n),
    rsi,
    rsiZone: rsiZone(rsi),
    high,
    drawdown: high > 0 ? price / high - 1 : null,
  }
}

/**
 * Clave de texto de una lectura, para la frase de la fila:
 *  'none'      — sin lectura (pocos cierres o sin datos)
 *  'below'     — en o bajo al menos una media (deepest dice cuál)
 *  'near'      — sobre todas, pero a ±1 % de alguna (nearest dice cuál)
 *  'above'     — sobre todas sus medias con dato
 */
export function signalKey(r) {
  if (!r) return { key: 'none' }
  if (r.level > 0) return { key: 'below', n: r.deepest, tramos: r.tramos }
  const near = r.smas.filter(x => x.near && x.value != null)
  if (near.length) return { key: 'near', n: near[0].n }
  return { key: 'above' }
}

/** ¿Cumple la condición opcional de RSI (30–45)? Sin RSI, no cumple. */
export function rsiRuleOk(r, rule = RSI_RULE) {
  return !!r && r.rsi != null && r.rsi >= rule.min && r.rsi <= rule.max
}

/**
 * Resumen para Resumen: cuántas de las posiciones leídas tienen al menos un
 * tramo que se cumple. items: [{ t, reading }] (reading null = sin lectura).
 * → { read, hit, rows: [{ t, deepest, tramos }] } con rows en el mismo orden.
 */
export function summarize(items) {
  const read = (items || []).filter(x => x.reading)
  const rows = read.filter(x => x.reading.level > 0).map(x => ({ t: x.t, deepest: x.reading.deepest, tramos: x.reading.tramos }))
  return { read: read.length, hit: rows.length, rows }
}

// "1", "1 y 2", "1, 2 y 3" en el idioma activo (clave opp.and).
export function joinList(items, t) {
  const a = (items || []).map(String)
  if (a.length <= 1) return a.join('')
  return t('opp.and', { a: a.slice(0, -1).join(', '), b: a[a.length - 1] })
}
