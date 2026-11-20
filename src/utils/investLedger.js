// src/utils/investLedger.js — libro de operaciones de Inversiones (F1), puro.
//
// Copia en ES modules de invest-web/app/lib/ledger.js (book, cashByCurrency,
// costOf, aportePending) y holdings.js (applyTrade), con los mismos casos de
// prueba. Regla heredada de Capital Planner: una operación nunca queda
// huérfana; ganancia = valor actual − total aportado, sin importar cómo se
// cargaron los datos. Sin tipo de cambio no se hace 1:1: se excluye y se dice.
//
// Lo nuevo de F1 (errores de Invest que se corrigen al pasarlos):
//  · UN SOLO "resultado realizado" (realizedSells). Invest tenía dos: la banda
//    sumaba `t.pnl` (precio de venta − entrada de la posición) y la tabla
//    "Costo promedio ponderado" lo recalculaba con el promedio de TODAS las
//    compras (realizedPnlFor), así que las dos cifras no coincidían. Aquí cada
//    venta tiene un único resultado: el `pnl` guardado al registrarla (es el
//    que conoce la entrada real de la posición, también la cargada a mano) y,
//    si no lo trae, el del costo promedio corrido del libro antes de la venta.
//    La banda, las estadísticas y la tabla por activo salen de esa lista.
//  · tradeStats (movStats de Invest) se alimenta de esa misma lista.
const EPS = 1e-7

const num = (v) => {
  const n = Number(v)
  return v != null && Number.isFinite(n) ? n : 0
}
export function byDateThenId(a, b) {
  const da = String(a.date || ''), db = String(b.date || '')
  return da < db ? -1 : da > db ? 1 : num(a.id) - num(b.id)
}

// Operaciones anteriores al libro: sin `cash`. Si la persona ya anotaba
// depósitos, sus compras y ventas se descontaban del efectivo; si no, entraron
// y salieron por fuera.
export function usesCash(op, legacy) {
  if (op.type !== 'buy' && op.type !== 'sell') return false
  return op.cash == null ? !!legacy : !!op.cash
}
export const hasDeposits = (ops) => (ops || []).some(t => t.type === 'deposit')
export const isReinvest = (op) => op.type === 'dividend' && !!op.reinvested

// Moneda de la operación: la guardada o la del activo; sin ticker, USD.
export function opCcy(op, ccyOf) {
  if (op.currency) return op.currency
  if (!op.ticker) return 'USD'
  return ccyOf ? ccyOf(op.ticker) : null
}

// Saldo por moneda: { USD: 1200, CLP: -50000 }. Nunca mezcla monedas.
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

// Flujo histórico en USD: con el tipo de cambio del día de la operación si se
// conoce; si no, el de hoy. null = sin tipo de cambio.
export function flowUsd(op, ccy, toUsd) {
  const fx = Number(op.fx)
  if (ccy && ccy !== 'USD' && op.fx != null && Number.isFinite(fx) && fx > 0) return num(op.amount) / fx
  return toUsd(num(op.amount), ccy)
}

// Costo por unidad de lo que había antes de las operaciones (se despeja: con
// costo promedio, el costo final es lineal en él).
function openingUnitCost(list, baseSh, holdSh, holdCost) {
  let a = baseSh, b = 0, sh = baseSh, fromSell = null, sellPrice = null
  for (const t of list) {
    const q = num(t.qty)
    if (t.type === 'buy' || isReinvest(t)) { sh += q; b += num(t.amount) }
    else if (t.type === 'bonus') { sh += q }
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

// ops: operaciones. holdings: [{ t, sh, cost, fxCost }]. opts: { ccyOf(t),
// priceOf(t) (moneda del activo; null si no hay), toUsd(monto, moneda) }.
export function book(ops, holdings, { ccyOf, priceOf, toUsd }) {
  const list = (ops || []).slice().sort(byDateThenId)
  const legacy = hasDeposits(list)
  let deposits = 0, withdrawals = 0, implicit = 0, dividends = 0, excludedOps = 0
  const perT = {}
  for (const t of list) {
    if (t.ticker) (perT[t.ticker] = perT[t.ticker] || []).push(t)
    const ccy = opCcy(t, ccyOf)
    const flows = t.type === 'deposit' || t.type === 'withdrawal' || t.type === 'dividend' ||
      ((t.type === 'buy' || t.type === 'sell') && !usesCash(t, legacy))
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
    const priced = px > 0
    if (!priced) { px = lastPrice > 0 ? lastPrice : unit; if (h.sh + orphanSh > EPS) unpriced.push(t) }
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
    cash, cashByCcy: byCcy, excludedCcys,
    deposits, withdrawals, implicit, opening, openingCount,
    contributed, dividends,
    positionsValue, positionsCost, value,
    gain, returnPct: gain != null && contributed > EPS ? gain / contributed : null,
    orphans, unpriced, excludedPositions, excludedOps, complete,
    usesCash: list.some(t => t.type === 'deposit' || t.type === 'withdrawal' || t.cash === true),
  }
}

// Costo promedio de lo pagado por ticker (los bonos suman unidades, no costo).
export function costOf(ops, ticker) {
  let paid = 0, paidSh = 0, bonusSh = 0, sold = 0
  for (const t of ops || []) {
    if (t.ticker !== ticker) continue
    if (t.type === 'buy' || isReinvest(t)) { paid += num(t.amount); paidSh += num(t.qty) }
    else if (t.type === 'bonus') bonusSh += num(t.qty)
    else if (t.type === 'sell') sold += num(t.qty)
  }
  return { paid, paidSh, bonusSh, units: paidSh + bonusSh - sold, avgPaid: paidSh > 0 ? paid / paidSh : 0 }
}

// Cuánto de lo marcado como inversión este mes en moyiq falta registrar como
// depósito (evita contar dos veces el mismo dinero). a: { amount, ccy, usd? }.
export function aportePending(a, ops, month) {
  if (!a) return null
  const ccy = a.ccy || (a.usd > 0 ? 'USD' : null)
  if (!ccy) return null
  const amount = a.ccy ? num(a.amount) : num(a.usd)
  const done = (ops || []).reduce((s, t) => {
    const same = t.type === 'deposit' && t.source === 'moyiq' && (t.currency || 'USD') === ccy && String(t.date || '').startsWith(month)
    return same ? s + num(t.amount) : s
  }, 0)
  return { amount: Math.max(0, Math.round((amount - done) * 100) / 100), ccy }
}

// ── Ajuste de la posición por una operación (holdings.js) ──
// holding: { sh, cost, fxCost } | null. trade: { type, qty, price, amount, fx }.
// → { action: 'create'|'update'|'close'|'none', sh, cost, fxCost, sold?, pnl? }.
// El stop nunca se toca. fxCost (FIN-12): el tipo de cambio que deja igual el
// costo en USD; si alguna compra no lo tiene, queda null (desconocido).
export function applyTrade(holding, trade) {
  let qty = Number(trade.qty) || 0
  if (trade.type === 'bonus') {
    if (!(qty > 0)) return { action: 'none' }
    if (!holding) return { action: 'create', sh: qty, cost: 0, fxCost: null }
    const bs0 = Number(holding.sh) || 0, bsh = bs0 + qty
    return { action: 'update', sh: bsh, cost: (bs0 * (Number(holding.cost) || 0)) / bsh, fxCost: holding.fxCost != null ? holding.fxCost : null }
  }
  const price = Number(trade.price) || 0
  const amount = Number(trade.amount) || 0
  if (!(qty > 0) && price > 0 && amount > 0) qty = amount / price
  if (!(qty > 0)) return { action: 'none' }
  const cash = amount > 0 ? amount : qty * price
  let fxT = Number(trade.fx)
  fxT = trade.fx != null && Number.isFinite(fxT) && fxT > 0 ? fxT : null
  if (trade.type === 'buy' || isReinvest(trade)) {
    if (!holding) return { action: 'create', sh: qty, cost: cash / qty, fxCost: fxT }
    const sh0 = Number(holding.sh) || 0, c0 = Number(holding.cost) || 0
    const sh = sh0 + qty
    const cost = (sh0 * c0 + cash) / sh
    const fx0 = Number(holding.fxCost)
    let fxCost = null
    if (fxT && holding.fxCost != null && Number.isFinite(fx0) && fx0 > 0) {
      const usd = (sh0 * c0) / fx0 + cash / fxT
      fxCost = usd > 0 ? (sh * cost) / usd : null
    }
    return { action: 'update', sh, cost, fxCost }
  }
  if (trade.type === 'sell') {
    if (!holding) return { action: 'none' }
    const have = Number(holding.sh) || 0
    const sold = Math.min(qty, have)
    const sell = price > 0 ? price : cash / qty
    const pnl = (sell - (Number(holding.cost) || 0)) * sold
    const left = have - sold
    const keep = holding.fxCost != null ? holding.fxCost : null
    if (left <= EPS) return { action: 'close', sh: 0, cost: holding.cost, fxCost: keep, sold, pnl }
    return { action: 'update', sh: left, cost: holding.cost, fxCost: keep, sold, pnl }
  }
  return { action: 'none' }
}

// Varios lotes del mismo ticker (INV-N15) vistos como una sola posición para
// aplicar una operación: unidades sumadas, costo promedio ponderado y fxCost
// solo si todos los lotes lo comparten.
export function mergeLots(lots) {
  const list = (lots || []).filter(Boolean)
  if (!list.length) return null
  const sh = list.reduce((a, h) => a + num(h.sh), 0)
  const costTotal = list.reduce((a, h) => a + num(h.sh) * num(h.cost), 0)
  const fx = list.map(h => (h.fxCost > 0 ? Number(h.fxCost) : null))
  const sameFx = fx.every(f => f != null && Math.abs(f - fx[0]) < 1e-9)
  return { ...list[0], sh, cost: sh > 0 ? costTotal / sh : 0, fxCost: sameFx ? fx[0] : null, lots: list.length }
}

// ── Resultado realizado: UNA sola cuenta ──
// Para cada venta, en orden: el `pnl` guardado si existe y, si no, el del
// costo promedio corrido del libro (compras y DRIP suben el costo; los bonos
// suman unidades sin costo; las ventas no cambian el promedio). Devuelve
// [{ uid, id, t, date, ccy, pnl, source: 'stored'|'average' }] en la moneda
// del activo; quien suma pasa cada una a USD.
export function realizedSells(ops, ccyOf) {
  const list = (ops || []).slice().sort(byDateThenId)
  const run = {}
  const out = []
  for (const o of list) {
    if (!o.ticker) continue
    const r = run[o.ticker] = run[o.ticker] || { sh: 0, cost: 0 }
    const q = num(o.qty)
    if (o.type === 'buy' || isReinvest(o)) {
      const paid = num(o.amount) > 0 ? num(o.amount) : q * num(o.price)
      r.sh += q; r.cost += paid
    } else if (o.type === 'bonus') {
      r.sh += q
    } else if (o.type === 'sell' && q > 0) {
      const avg = r.sh > EPS ? r.cost / r.sh : null
      const sellPx = num(o.price) > 0 ? num(o.price) : num(o.amount) / q
      let pnl = o.pnl != null && Number.isFinite(Number(o.pnl)) ? Number(o.pnl) : null
      let source = 'stored'
      if (pnl == null && avg != null) { pnl = (sellPx - avg) * Math.min(q, r.sh); source = 'average' }
      if (pnl != null) out.push({ uid: o.uid, id: o.id, t: o.ticker, date: o.date, ccy: opCcy(o, ccyOf), pnl, source })
      if (r.sh > EPS) {
        const f = Math.max(0, r.sh - q) / r.sh
        r.sh = Math.max(0, r.sh - q); r.cost *= f
      }
    }
  }
  return out
}

// Estadísticas de las ventas (movStats de Invest) sobre la misma lista.
// sells: realizedSells(...); toUsd(monto, moneda). Las ventas sin tipo de
// cambio quedan fuera y se cuentan en `excluded`.
export function tradeStats(sells, toUsd) {
  const rows = []
  let excluded = 0
  for (const s of sells || []) {
    const usd = toUsd(s.pnl, s.ccy)
    if (usd == null) { excluded++; continue }
    rows.push({ ...s, usd })
  }
  const n = rows.length
  if (!n) return { n: 0, excluded, total: 0, byTicker: [] }
  const wins = rows.filter(r => r.usd > 0)
  const losses = rows.filter(r => r.usd < 0)
  const gain = wins.reduce((a, r) => a + r.usd, 0)
  const loss = losses.reduce((a, r) => a + r.usd, 0)
  const total = rows.reduce((a, r) => a + r.usd, 0)
  let cum = 0, peak = 0, maxDD = 0
  for (const r of rows) { cum += r.usd; peak = Math.max(peak, cum); maxDD = Math.max(maxDD, peak - cum) }
  const by = new Map()
  for (const r of rows) {
    const b = by.get(r.t) || { t: r.t, n: 0, w: 0, l: 0, pnl: 0 }
    b.n++; if (r.usd > 0) b.w++; if (r.usd < 0) b.l++; b.pnl += r.usd
    by.set(r.t, b)
  }
  return {
    n, excluded, total,
    wins: wins.length,
    winRate: wins.length / n,
    profitFactor: gain > 0 && loss < 0 ? gain / Math.abs(loss) : null,
    avgWin: wins.length ? gain / wins.length : null,
    avgLoss: losses.length ? loss / losses.length : null,
    avgPerTrade: total / n,
    maxDD,
    byTicker: [...by.values()].sort((a, b) => b.pnl - a.pnl),
  }
}

// Dividendos cobrados por ticker (del libro), en USD.
export function dividendsReceived(ops, ccyOf, toUsd) {
  const by = new Map()
  let excluded = 0
  for (const o of ops || []) {
    if (o.type !== 'dividend' || !o.ticker) continue
    const usd = flowUsd(o, opCcy(o, ccyOf), toUsd)
    if (usd == null) { excluded++; continue }
    const b = by.get(o.ticker) || { t: o.ticker, n: 0, usd: 0 }
    b.n++; b.usd += usd
    by.set(o.ticker, b)
  }
  return { rows: [...by.values()].sort((a, b) => b.usd - a.usd), excluded }
}

// Tabla "Costo promedio ponderado": por ticker con operaciones, el costo
// promedio de lo pagado, las unidades y el resultado realizado (de la MISMA
// lista que la banda, así las dos cifras coinciden).
export function costTable(ops, ccyOf, toUsd) {
  const tickers = [...new Set((ops || []).filter(o => o.ticker).map(o => o.ticker))].sort()
  const sells = realizedSells(ops, ccyOf)
  return tickers.map(t => {
    const c = costOf(ops, t)
    const mine = sells.filter(s => s.t === t)
    let realized = 0, missing = 0
    for (const s of mine) { const u = toUsd(s.pnl, s.ccy); if (u == null) missing++; else realized += u }
    return { t, ccy: ccyOf(t), avgPaid: c.paidSh > 0 ? c.avgPaid : null, units: c.units, bonusSh: c.bonusSh, realized: mine.length ? realized : null, missing }
  })
}

// Orden de la tabla de operaciones: lo más nuevo arriba.
export function sortOpsDesc(ops) {
  return (ops || []).slice().sort((a, b) => -byDateThenId(a, b))
}

export function filterOps(ops, { ticker = '', type = '' } = {}) {
  return (ops || []).filter(o => (!ticker || o.ticker === ticker) && (!type || o.type === type))
}

// Siguiente número de orden (seq) del libro.
export function nextSeq(ops) {
  return (ops || []).reduce((m, o) => Math.max(m, num(o.id)), 0) + 1
}
