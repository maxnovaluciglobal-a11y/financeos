// @ts-check
// src/extras/exampleMoney.js — cifras de los avisos de ejemplo de la hoja de
// pre-permiso (components/PushAsk.jsx) en la moneda de la persona: un arriendo
// de ejemplo no dice "$450.000" a quien usa euros. Escala aproximada por
// moneda (no es un tipo de cambio: solo que el orden de magnitud se vea real),
// redondeada a cifras "de ejemplo".

/** @type {Record<string, number>} */
const SCALE = { CLP: 500, ARS: 1000, COP: 2000, PYG: 3500, VES: 20, MXN: 10, UYU: 25, BRL: 2.5, PEN: 2, USD: 0.5, EUR: 0.5 }
// Valores base (CLP / 500): arriendo, gasto y límite del presupuesto, lo que queda y por día.
const BASE = { rent: 900, spent: 184, limit: 200, left: 620, daily: 44 }

/** Dos cifras significativas: 22.000, 450, 1.800.000. @param {number} n */
export function niceRound(n) {
  if (!(n > 0)) return 0
  if (n < 100) return Math.round(n)
  const p = 10 ** (Math.floor(Math.log10(n)) - 1)
  return Math.round(n / p) * p
}

/**
 * Variables de los textos `la.ex.*` ya formateadas.
 * @param {(n: number) => string} money @param {string} [currency]
 */
export function exampleVars(money, currency) {
  const k = SCALE[String(currency || 'CLP')] ?? 1
  const v = (/** @type {number} */ base) => money(niceRound(base * k))
  return { amount: v(BASE.rent), spent: v(BASE.spent), limit: v(BASE.limit), left: v(BASE.left), daily: v(BASE.daily) }
}
