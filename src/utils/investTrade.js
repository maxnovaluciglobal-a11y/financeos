// src/utils/investTrade.js — "Registrar operación" (F1 Portafolio y F3 ficha), puro.
//
// Del formulario a { op, holding } con las reglas de saveTrade de Invest
// (invest-web/app/index.html): precio × unidades llena el monto y monto ÷
// precio las unidades; la compra y la venta ajustan la posición (applyTrade);
// vender todo pide confirmar si se quita la posición. Lo que cambia al pasarlo:
//  · Una compra de un ticker nuevo usa el tipo que la persona elige (Invest la
//    creaba siempre como Stock o Crypto, nunca ETF).
//  · Si el ticker tiene varios lotes (INV-N15), la operación se guarda pero la
//    posición no se toca sola: se avisa para ajustarla a mano.
//  · No se aceptan fechas futuras ni ventas de más unidades de las que hay.
// El tipo de cambio de la operación se toma, como en Invest, solo si la fecha
// es hoy (con otra fecha el costo en USD de la compra queda desconocido).
import { applyTrade, costOf, nextSeq } from './investLedger.js'
import { currencyOf, rateOf } from './investValuation.js'

export const TRADE_TYPES = ['buy', 'sell', 'dividend', 'bonus', 'deposit', 'withdrawal']
export const CASH_CCYS = ['USD', 'CLP', 'MXN', 'COP', 'ARS', 'PEN', 'BRL']
const TICKER_RE = /^[A-Z0-9.\-^=]{1,15}$/

// "1.234,5" y "1234.5": la última coma o punto decide el decimal.
export function num(v) {
  if (v == null || v === '') return NaN
  if (typeof v === 'number') return v
  const s = String(v).trim().replace(/\s/g, '')
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.')
  return lc > ld ? parseFloat(s.replace(/\./g, '').replace(',', '.')) : parseFloat(s.replace(/,/g, ''))
}
const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d

export function localToday(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

// Cálculo cruzado del formulario: cambia el precio o las unidades → monto;
// cambia el monto → unidades. Devuelve el formulario actualizado.
export function crossFill(form, changed) {
  const price = num(form.price), qty = num(form.qty), amount = num(form.amount)
  if ((changed === 'price' || changed === 'qty') && price > 0 && qty > 0) return { ...form, amount: String(round(price * qty, 2)) }
  if (changed === 'amount' && price > 0 && amount > 0) return { ...form, qty: String(round(amount / price, 6)) }
  return form
}

// form: { type, ticker, assetType, mode ('cash'|'drip' en dividendos), currency,
// price, qty, amount, cash (bool), rsi, date, note, source }
// ctx: { lots (posiciones del ticker), ops, quoteCcy, rates, today, uid }
// → { ok, errors: { campo: código }, op, effect }
// effect: { kind: 'none'|'create'|'update'|'close'|'lots', input?, prev?, sold?, pnl? }
export function planTrade(form, { lots = [], ops = [], quoteCcy = null, rates = {}, today = localToday(), uid } = {}) {
  const errors = {}
  const type = form.type
  if (!TRADE_TYPES.includes(type)) errors.type = 'type_invalid'
  const cashOnly = type === 'deposit' || type === 'withdrawal'
  const drip = type === 'dividend' && form.mode === 'drip'
  const ticker = cashOnly ? null : String(form.ticker || '').toUpperCase().trim()
  if (!cashOnly) {
    if (!ticker) errors.ticker = 'ticker_required'
    else if (!TICKER_RE.test(ticker)) errors.ticker = 'ticker_invalid'
  }
  const date = String(form.date || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) errors.date = 'date_required'
  else if (date > today) errors.date = 'date_future'
  let price = num(form.price), qty = num(form.qty), amount = num(form.amount)
  if (type === 'buy' || type === 'sell') {
    if (!(qty > 0) && price > 0 && amount > 0) qty = amount / price
    if (!(price > 0) && qty > 0 && amount > 0) price = amount / qty
    if (!(qty > 0)) errors.qty = 'qty_required'
    if (!(price > 0)) errors.price = 'price_required'
    if (!(amount > 0) && qty > 0 && price > 0) amount = qty * price
  } else if (drip) {
    if (!(qty > 0) && price > 0 && amount > 0) qty = amount / price
    if (!(amount > 0) && qty > 0 && price > 0) amount = qty * price
    if (!(qty > 0) || !(amount > 0)) errors.qty = 'drip_required'
  } else if (type === 'dividend' || cashOnly) {
    if (!(amount > 0)) errors.amount = 'amount_required'
  } else if (type === 'bonus') {
    if (!(qty > 0)) errors.qty = 'bonus_required'
    amount = 0
  }
  // Nunca vender más de lo que hay (Invest lo recortaba en la posición pero
  // guardaba la operación con las unidades escritas, y el libro quedaba con
  // unidades negativas). Lo que hay: los lotes de Posiciones o, si la
  // posición ya no está, las unidades netas de las operaciones.
  if (type === 'sell' && qty > 0 && !errors.ticker) {
    const list = (lots || []).filter(Boolean)
    const have = list.length ? list.reduce((a, h) => a + (Number(h.sh) || 0), 0) : costOf(ops, ticker).units
    if (!(have > 1e-9)) errors.qty = 'sell_none'
    else if (qty > have + 1e-9) errors.qty = 'sell_over'
  }
  const rsi = num(form.rsi)
  if (form.rsi != null && form.rsi !== '' && !(rsi >= 0 && rsi <= 100)) errors.rsi = 'rsi_invalid'
  const note = String(form.note || '').trim()
  if (note.length > 500) errors.note = 'note_too_long'
  const currency = cashOnly ? (CASH_CCYS.includes(form.currency) ? form.currency : 'USD') : currencyOf(ticker || '', quoteCcy)
  if (!cashOnly && ticker && !currency) errors.ticker = 'ticker_currency'
  if (Object.keys(errors).length) return { ok: false, errors }

  const fx = currency && currency !== 'USD' && date === today ? rateOf(currency, rates) : null
  const op = {
    uid, id: nextSeq(ops), type, ticker, date, currency,
    price: type === 'buy' || type === 'sell' || drip ? round(price || 0, 8) || null : null,
    qty: type === 'buy' || type === 'sell' || drip || type === 'bonus' ? round(qty, 8) : null,
    amount: round(amount || 0, 8),
    fx: fx > 0 ? fx : null,
    pnl: null,
    rsi: type === 'buy' || type === 'sell' ? (rsi >= 0 ? rsi : null) : null,
    note,
    cash: type === 'buy' || type === 'sell' ? !!form.cash : null,
    reinvested: drip,
    edited: !!form.edited,
    source: form.source === 'moyiq' && type === 'deposit' ? 'moyiq' : null,
  }

  let effect = { kind: 'none' }
  const touches = type === 'buy' || type === 'sell' || type === 'bonus' || drip
  if (touches) {
    const list = (lots || []).filter(Boolean)
    if (list.length > 1) effect = { kind: 'lots', count: list.length }
    else {
      const prev = list[0] || null
      const r = applyTrade(prev, { type: drip ? 'buy' : type, qty: op.qty, price: op.price, amount: op.amount, fx: op.fx })
      if (type === 'sell' && r.pnl != null) op.pnl = round(r.pnl, 8)
      if (r.action === 'create') {
        const assetType = ['Stock', 'ETF', 'Crypto', 'Bond'].includes(form.assetType) ? form.assetType : (/-USD$/.test(ticker) ? 'Crypto' : 'Stock')
        effect = { kind: 'create', input: { t: ticker, type: assetType, sh: r.sh, cost: r.cost, fxCost: r.fxCost, stop: null, note: '' } }
      } else if (r.action === 'update') {
        effect = { kind: 'update', prev, input: { ...prev, sh: r.sh, cost: r.cost, fxCost: r.fxCost } }
      } else if (r.action === 'close') {
        effect = { kind: 'close', prev, sold: r.sold }
      }
    }
  }
  return { ok: true, errors: {}, op, effect }
}

// Formulario vacío (o prellenado) para un tipo.
export function emptyTrade(type = 'buy', prefill = {}, { today = localToday(), hasDeposits = false } = {}) {
  return {
    type, ticker: '', assetType: '', mode: 'cash', currency: 'USD', price: '', qty: '', amount: '', rsi: '', note: '',
    cash: hasDeposits, date: today, source: null, ...prefill,
  }
}

// ── Ficha del activo (F3) ────────────────────────────────────────────────────
// applyTrade (holdings.js de Invest) vive en investLedger.js; se reexporta para
// la ficha. buildTrade: el formulario corto de compra/venta de la ficha.
export { applyTrade }
const EPS = 1e-7
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
