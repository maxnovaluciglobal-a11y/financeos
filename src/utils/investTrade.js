// src/utils/investTrade.js — registrar una operación AJUSTA la posición.
//
// Copia en ES modules de invest-web/app/lib/holdings.js (applyTrade) y de la
// parte de saveTrade (app/index.html 7084-7172) que arma la operación del
// libro, para que una compra o venta registrada desde moyiq deje la posición
// igual que en Invest. Funciones puras, sin red.
//  · buy: suma unidades y recalcula la entrada como promedio ponderado.
//  · sell: resta unidades a la entrada actual; pnl = (precio − entrada) × vendidas.
//    Si llega a 0 devuelve 'close' (la pantalla pregunta si se quita).
//  · bonus: unidades sin costo.
// El stop nunca se toca aquí.
const EPS = 1e-7

export function applyTrade(holding, trade) {
  let qty = Number(trade?.qty) || 0
  if (trade?.type === 'bonus') {
    if (!(qty > 0)) return { action: 'none' }
    if (!holding) return { action: 'create', sh: qty, cost: 0, fxCost: null }
    const s0 = Number(holding.sh) || 0, sh = s0 + qty
    return { action: 'update', sh, cost: (s0 * (Number(holding.cost) || 0)) / sh, fxCost: holding.fxCost != null ? holding.fxCost : null }
  }
  const price = Number(trade?.price) || 0
  const amount = Number(trade?.amount) || 0
  if (!(qty > 0) && price > 0 && amount > 0) qty = amount / price
  if (!(qty > 0)) return { action: 'none' }
  const cash = amount > 0 ? amount : qty * price
  let fxT = Number(trade.fx)
  fxT = trade.fx != null && Number.isFinite(fxT) && fxT > 0 ? fxT : null
  if (trade.type === 'buy') {
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

const toNum = (v) => (v == null || v === '' ? NaN : typeof v === 'number' ? v : parseFloat(String(v).trim().replace(',', '.')))
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Formulario de compra/venta de la ficha → { ok, op, adj } o { ok:false, fields }.
// input: { type: 'buy'|'sell', price, qty, amount, date, note, rsi }.
// holding: el lote que se ajusta (el primero del ticker, como Invest) o null.
// ccy: moneda del activo. fx: tipo de cambio de HOY (moneda por 1 US$), que
// solo vale si la fecha es hoy (FIN-12); con otra fecha queda desconocido.
export function buildTrade(input = {}, { ticker, holding = null, ccy = 'USD', fx = null, today, uid, seq = 0 } = {}) {
  const fields = {}
  const type = input.type === 'sell' ? 'sell' : 'buy'
  const price = toNum(input.price)
  let qty = toNum(input.qty)
  let amount = toNum(input.amount)
  if (!(price > 0)) fields.price = 'price_invalid'
  if (!(qty > 0) && !(amount > 0)) fields.qty = 'qty_or_amount_required'
  if (input.qty !== '' && input.qty != null && !(qty > 0)) fields.qty = 'qty_invalid'
  if (input.amount !== '' && input.amount != null && !(amount > 0)) fields.amount = 'amount_invalid'
  if (!DATE_RE.test(String(input.date || '')) || Number.isNaN(Date.parse(`${input.date}T00:00:00Z`))) fields.date = 'date_invalid'
  else if (today && input.date > today) fields.date = 'date_future'
  const note = String(input.note ?? '').trim()
  if (note.length > 500) fields.note = 'note_too_long'
  if (!fields.price && !fields.qty && !fields.amount) {
    if (!(qty > 0)) qty = amount / price
    if (!(amount > 0)) amount = qty * price
    if (type === 'sell') {
      const have = Number(holding?.sh) || 0
      if (!(have > 0)) fields.qty = 'sell_none'
      else if (qty > have + EPS) fields.qty = 'sell_too_many'
    }
  }
  if (Object.keys(fields).length) return { ok: false, error: 'invalid', fields }
  const tFx = ccy && ccy !== 'USD' && input.date === today && Number(fx) > 0 ? Number(fx) : null
  const adj = applyTrade(holding, { type, qty, price, amount, fx: tFx })
  const rsi = Number(input.rsi)
  const op = {
    id: seq, uid, ticker, type, date: input.date, currency: ccy || null,
    price, qty, amount, fx: tFx, rsi: Number.isFinite(rsi) && rsi > 0 ? Math.round(rsi) : null,
    note, pnl: type === 'sell' && adj.pnl != null ? adj.pnl : null,
    cash: null, reinvested: false, edited: false, source: null,
  }
  return { ok: true, op, adj }
}
