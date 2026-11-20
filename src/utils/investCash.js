// src/utils/investCash.js — efectivo y aportes del libro de operaciones (Hoy, F2).
//
// Copia en ES modules de `book` y `cashByCurrency` de invest-web/app/lib/ledger.js
// para que "Efectivo y aportes" dé la misma cifra en las dos apps. Reglas:
//  · Las unidades de cada ticker salen de las operaciones; si Posiciones tiene
//    menos, la diferencia se sigue valuando (huérfanas) y se avisa; si tiene
//    más, esa parte cuenta como aporte a su costo.
//  · Una compra que no pasó por el efectivo es dinero que entró de afuera.
//  · Sin tipo de cambio no se hace 1:1: los montos quedan fuera y el
//    rendimiento queda sin calcular.
// Así siempre: ganancia = valor actual − total aportado.
// (Si la fase de Movimientos trae su propio port del libro, este se reemplaza.)
const EPS = 1e-7
const num = (v) => { const n = Number(v); return v != null && Number.isFinite(n) ? n : 0 }
const byDateThenId = (a, b) => {
  const da = String(a.date || ''), db = String(b.date || '')
  return da < db ? -1 : da > db ? 1 : num(a.id) - num(b.id)
}
const usesCash = (op, legacy) => (op.type === 'buy' || op.type === 'sell') && (op.cash == null ? !!legacy : !!op.cash)
const hasDeposits = (ops) => (ops || []).some(t => t.type === 'deposit')
const isReinvest = (op) => op.type === 'dividend' && !!op.reinvested
function opCcy(op, ccyOf) {
  if (op.currency) return op.currency
  if (!op.ticker) return 'USD'
  return ccyOf ? ccyOf(op.ticker) : null
}

// Saldo por moneda, sin mezclar monedas: { USD: 1200, CLP: -50000 }.
export function cashByCurrency(ops, ccyOf) {
  const legacy = hasDeposits(ops), out = {}
  for (const t of ops || []) {
    let sign = 0
    if (t.type === 'deposit' || (t.type === 'dividend' && !isReinvest(t))) sign = 1
    else if (t.type === 'withdrawal') sign = -1
    else if (usesCash(t, legacy)) sign = t.type === 'sell' ? 1 : -1
    if (!sign) continue
    const c = opCcy(t, ccyOf) || '?'
    out[c] = (out[c] || 0) + sign * num(t.amount)
  }
  return out
}

function flowUsd(op, ccy, toUsd) {
  const fx = Number(op.fx)
  if (ccy && ccy !== 'USD' && op.fx != null && Number.isFinite(fx) && fx > 0) return num(op.amount) / fx
  return toUsd(num(op.amount), ccy)
}

function openingUnitCost(list, baseSh, holdSh, holdCost) {
  let a = baseSh, b = 0, sh = baseSh, fromSell = null, sellPrice = null
  for (const t of list) {
    const q = num(t.qty)
    if (t.type === 'buy' || isReinvest(t)) { sh += q; b += num(t.amount) }
    else if (t.type === 'bonus') sh += q
    else if (t.type === 'sell' && sh > EPS) {
      if (fromSell == null && t.pnl != null && q > 0) fromSell = ((num(t.amount) - num(t.pnl)) / q * sh - b) / a
      if (sellPrice == null && q > 0) sellPrice = num(t.amount) / q
      const f = Math.max(0, sh - q) / sh
      a *= f; b *= f; sh = Math.max(0, sh - q)
    }
  }
  let c
  if (holdSh > EPS && a > EPS) c = (holdCost - b) / a
  else if (fromSell != null) c = fromSell
  else c = sellPrice != null ? sellPrice : 0
  return Math.max(0, c)
}

// ops: operaciones (investData.listOperations). holdings: [{ t, sh, cost, fxCost }].
// opts: { ccyOf(t), priceOf(t) (moneda del activo; null si no hay), toUsd(monto, moneda) }.
export function cashBook(ops, holdings, { ccyOf, priceOf, toUsd }) {
  const list = (ops || []).slice().sort(byDateThenId)
  const legacy = hasDeposits(list)
  let deposits = 0, withdrawals = 0, implicit = 0, dividends = 0, excludedOps = 0
  const perT = {}
  for (const t of list) {
    if (t.ticker) (perT[t.ticker] = perT[t.ticker] || []).push(t)
    const ccy = opCcy(t, ccyOf)
    const flows = t.type === 'deposit' || t.type === 'withdrawal' || t.type === 'dividend' || ((t.type === 'buy' || t.type === 'sell') && !usesCash(t, legacy))
    if (!flows) continue
    const usd = flowUsd(t, ccy, toUsd)
    if (usd == null) { excludedOps++; continue }
    if (t.type === 'deposit') deposits += usd
    else if (t.type === 'withdrawal') withdrawals += usd
    else if (t.type === 'dividend') dividends += usd
    else implicit += t.type === 'buy' ? usd : -usd
  }

  const held = {}
  for (const h of holdings || []) {
    const o = held[h.t] = held[h.t] || { sh: 0, cost: 0, fxCost: null }
    o.sh += num(h.sh)
    o.cost += num(h.sh) * num(h.cost)
    if (h.fxCost > 0) o.fxCost = Number(h.fxCost)
  }

  let opening = 0, openingCount = 0, positionsValue = 0, positionsCost = 0
  const excludedPositions = [], orphans = [], unpriced = []
  for (const t of Object.keys({ ...held, ...perT })) {
    const h = held[t] || { sh: 0, cost: 0, fxCost: null }
    const mine = perT[t] || []
    let net = 0, lastPrice = null
    for (const o of mine) {
      const q = num(o.qty)
      if (o.type === 'buy' || o.type === 'bonus' || isReinvest(o)) net += q
      else if (o.type === 'sell') net -= q
      if (o.price > 0) lastPrice = Number(o.price)
    }
    const ccy = ccyOf(t)
    const extra = h.sh - net
    const unit = h.sh > EPS ? h.cost / h.sh : 0
    const orphanSh = extra < -EPS ? -extra : 0
    let px = priceOf ? priceOf(t) : null
    if (!(px > 0)) { px = lastPrice > 0 ? lastPrice : unit; if (h.sh + orphanSh > EPS) unpriced.push(t) }
    const units = h.sh + orphanSh
    const valueUsd = toUsd(units * px, ccy)
    if (valueUsd == null) {
      if (units > EPS) excludedPositions.push(t)
    } else {
      if (extra > EPS) {
        const costCcy = openingUnitCost(mine, extra, h.sh, h.cost) * extra
        opening += h.fxCost > 0 && ccy !== 'USD' ? costCcy / h.fxCost : toUsd(costCcy, ccy)
        openingCount++
      }
      positionsValue += valueUsd
      const c0 = toUsd(h.cost + orphanSh * (lastPrice > 0 ? lastPrice : unit), ccy)
      positionsCost += c0 == null ? 0 : c0
    }
    if (orphanSh > EPS) orphans.push({ t, sh: orphanSh, value: valueUsd, ccy, price: px })
  }

  const byCcy = cashByCurrency(list, ccyOf)
  let cash = 0
  const excludedCcys = []
  for (const c of Object.keys(byCcy)) {
    const u = c === '?' ? null : toUsd(byCcy[c], c)
    if (u == null) excludedCcys.push(c)
    else cash += u
  }
  const contributed = deposits - withdrawals + implicit + opening
  const complete = !excludedOps && !excludedCcys.length && !excludedPositions.length
  const value = cash + positionsValue
  const gain = complete ? value - contributed : null
  return {
    cash, cashByCcy: byCcy, excludedCcys, deposits, withdrawals, implicit, opening, openingCount,
    contributed, dividends, positionsValue, positionsCost, value,
    gain, returnPct: gain != null && contributed > EPS ? gain / contributed : null,
    orphans, unpriced, excludedPositions, excludedOps, complete,
    usesCash: list.some(t => t.type === 'deposit' || t.type === 'withdrawal' || t.cash === true),
  }
}
