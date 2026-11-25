// src/utils/investDeposit.js — "Depositado frente a ganancia", la primera
// lectura de Resumen en Inversiones v2 (24-nov-2026). Lógica
// pura, sin textos: la pantalla traduce las claves.
//
// La cifra de comparación depende de lo que la persona registró, y la pantalla
// dice cuál se usó (nunca se presenta un costo como si fuera un depósito):
//  · 'deposits'  — hay depósitos en el libro y el libro está completo:
//                  Depositado = depósitos − retiros + compras con dinero de
//                  afuera + posiciones sin operaciones a su costo
//                  (investCash.contributed). Valor = posiciones + efectivo.
//  · 'purchases' — no hay depósitos, pero hay compras registradas con dinero de
//                  afuera (libro completo): lo puesto en esas compras.
//  · 'cost'      — sin libro útil: lo que se pagó por las posiciones de hoy.
//                  No es lo depositado y la pantalla lo dice.
// hint: por qué no se pudo usar lo depositado ('noDeposits' · 'incomplete' ·
// 'opsUnavailable') o null si sí se pudo.
// Todo en US$. Sin dato, null: nunca un número supuesto.
const EPS = 0.005
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

export function depositGain({ ledger = null, totals = null, opsMissing = false } = {}) {
  const day = totals && isNum(totals.day) && totals.priced > 0 ? totals.day : null
  const dayPct = day != null && isNum(totals.dayPct) ? totals.dayPct : null
  const out = (o) => ({
    day, dayPct,
    pct: o.deposited > EPS && isNum(o.gain) ? o.gain / o.deposited : null,
    partial: !!totals && totals.excluded > 0,
    ...o,
  })

  const L = ledger
  const hasDeposits = !!L && L.deposits > EPS
  if (L && L.complete && isNum(L.gain) && L.contributed > EPS) {
    if (hasDeposits) {
      return out({
        basis: 'deposits', hint: null,
        value: L.value, deposited: L.contributed, gain: L.gain,
        withdrawals: L.withdrawals > EPS ? L.withdrawals : 0,
        atCost: L.openingCount > 0 ? L.openingCount : 0,
        cash: isNum(L.cash) ? L.cash : 0,
      })
    }
    if (L.implicit > EPS) {
      return out({
        basis: 'purchases', hint: 'noDeposits',
        value: L.value, deposited: L.contributed, gain: L.gain,
        withdrawals: 0, atCost: L.openingCount > 0 ? L.openingCount : 0, cash: isNum(L.cash) ? L.cash : 0,
      })
    }
  }
  if (!totals || !(totals.cost > EPS) || !isNum(totals.value)) return null
  const hint = opsMissing ? 'opsUnavailable' : hasDeposits ? 'incomplete' : 'noDeposits'
  return out({
    basis: 'cost', hint,
    value: totals.value, deposited: totals.cost, gain: totals.value - totals.cost,
    withdrawals: 0, atCost: 0, cash: 0,
  })
}

// Resultado sobre el costo de las posiciones de hoy (Vista completa), aparte
// de la ganancia frente a lo depositado: solo cuando las dos difieren.
export function costResult(totals, dep) {
  if (!totals || !(totals.cost > EPS) || !dep || dep.basis === 'cost') return null
  const abs = isNum(totals.total) ? totals.total : totals.value - totals.cost
  return { abs, pct: abs / totals.cost }
}
