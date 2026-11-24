// src/pages/Investments/oportunidades/capital.js — "Repartir mi capital", puro.
//
// Dos pasos, los dos de Invest (Plan de Capital):
//  1. Entre activos: el monto se reparte por los % de la persona (a mano,
//     parejo o hacia sus objetivos por desvío: repartoPorDesvio, en
//     utils/investPlan.js allocByDrift).
//  2. Dentro de cada activo: su parte se divide en 4 tramos con los pesos de la
//     escalera elegida (CAP_LADDERS: parejo 25/25/25/25, más peso en las largas
//     15/20/25/40, mitad en la de 200 10/15/25/50). Un tramo "se cumple hoy"
//     si el precio está en o bajo su media (signals.js); si no, "espera" a que
//     el precio llegue a esa media. Opcional: además exigir RSI entre 30 y 45
//     (la condición de la primera versión del Plan de Capital).
// Todo en centavos enteros: hoy + espera + sin lectura = el monto, exacto.
// Un tramo sin media (pocos cierres) no recibe dinero: su parte va a los
// otros tramos del mismo activo (como utils/investPlan.js ladderSplit).
// Es aritmética con las reglas de la persona, no una recomendación.
import { LADDERS, splitAmount, splitCents } from '../../../utils/investPlan.js'
import { SMAS, rsiRuleOk } from './signals.js'

export const LADDER_KEYS = Object.keys(LADDERS)
// Por defecto, el modelo original de Walter (10/15/25/50, decisión del 24-nov-2026).
export const DEFAULT_LADDER = 'half200'
const cents = (v) => Math.round(Number(v) * 100)

/**
 * amount: número en US$; alloc: [{ t, p }] que suma 100;
 * readings: { t: readSignal(...) | null }; ladder: clave de LADDERS.
 * → { ok:false, error } | { ok:true, total, today, wait, noData, reassigned,
 *      rows: [{ t, p, amount, today, wait, noData, reading, reassigned,
 *               tramos: [{ n, tramo, w, amount, sma, dist, hit, rsiBlocked, state }] | null }] }
 * state: 'today' (se cumple) | 'wait' (espera) | 'none' (sin media).
 */
// La condición de RSI 30–45 va ENCENDIDA por defecto (modelo de julio de
// Walter, decisión del 24-nov-2026); sin dato de RSI, el tramo no se cumple.
export const DEFAULT_RSI_RULE = true
export function planCapital({ amount, alloc, readings = {}, ladder = DEFAULT_LADDER, rsiRule = DEFAULT_RSI_RULE } = {}) {
  const base = splitAmount(amount, alloc)
  if (!base.ok) return base
  const w = LADDERS[ladder] || LADDERS[DEFAULT_LADDER]
  let todayC = 0, waitC = 0, noDataC = 0
  const rows = base.rows.map(r => {
    const rd = readings[r.t] || null
    const rc = cents(r.amount)
    if (!rd) {
      noDataC += rc
      return { ...r, today: 0, wait: 0, noData: r.amount, reading: null, reassigned: false, tramos: null }
    }
    const avail = SMAS.map((n, i) => (rd.smas[i]?.value != null ? w[i] : 0))
    const parts = splitCents(r.amount, avail)
    const blocked = rsiRule && !rsiRuleOk(rd)
    let rt = 0, rw = 0
    const tramos = SMAS.map((n, i) => {
      const m = rd.smas[i] || {}
      if (m.value == null) return { n, tramo: i + 1, w: w[i], amount: null, sma: null, dist: null, hit: false, rsiBlocked: false, rsiMissing: false, state: 'none' }
      const pc = cents(parts[i])
      const today = m.hit && !blocked
      if (today) rt += pc; else rw += pc
      return { n, tramo: i + 1, w: w[i], amount: pc / 100, sma: m.value, dist: m.dist, hit: !!m.hit, rsiBlocked: !!m.hit && blocked, rsiMissing: !!m.hit && blocked && rd.rsi == null, state: today ? 'today' : 'wait' }
    })
    todayC += rt; waitC += rw
    return { ...r, today: rt / 100, wait: rw / 100, noData: 0, reading: rd, reassigned: avail.some(x => x === 0), tramos }
  })
  return {
    ok: true,
    total: base.total,
    today: todayC / 100,
    wait: waitC / 100,
    noData: noDataC / 100,
    reassigned: rows.some(r => r.reassigned),
    rows,
  }
}

/**
 * Las cuentas del reparto por desvío, para mostrarlas (mismas reglas que
 * allocByDrift: solo lo que está más de 0,5 puntos bajo su objetivo, en
 * proporción a lo que le falta; si nada está debajo, en proporción al objetivo).
 * base: [{ t, valueUsd }]; targets: { t: % }.
 * → { mode: 'gap' | 'target', rows: [{ t, actual, target, gap, counts }] }
 */
export function driftMath(base, targets) {
  const list = (base || []).filter(b => b.valueUsd > 0)
  const tot = list.reduce((a, b) => a + b.valueUsd, 0)
  if (!(tot > 0)) return { mode: 'gap', rows: [] }
  const rows = list.map(b => {
    const actual = (b.valueUsd / tot) * 100
    const tg = Number(targets?.[b.t])
    const target = targets && targets[b.t] != null && Number.isFinite(tg) ? tg : actual
    return { t: b.t, actual, target, gap: target - actual }
  })
  const under = rows.some(r => r.gap > 0.5)
  return { mode: under ? 'gap' : 'target', rows: rows.map(r => ({ ...r, counts: under ? r.gap > 0.5 : r.target > 0 })) }
}

/** Capital sin invertir: capital de referencia − costo de lo invertido (≥ 0). null sin capital. */
export function uninvested(capital, investedCost) {
  const c = Number(capital)
  if (!(c > 0)) return null
  return Math.max(0, Math.round((c - (Number(investedCost) || 0)) * 100) / 100)
}
