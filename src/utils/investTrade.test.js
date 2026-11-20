import { describe, it, expect } from 'vitest'
import { planTrade, crossFill, emptyTrade, localToday, num } from './investTrade.js'

const today = '2026-11-20'
const uid = '11111111-1111-4111-8111-111111111111'
const base = (f) => ({ ...emptyTrade(f.type || 'buy', {}, { today }), ...f })

describe('Registrar operación', () => {
  it('precio × unidades llena el monto; monto ÷ precio, las unidades', () => {
    expect(crossFill({ price: '10', qty: '3', amount: '' }, 'qty').amount).toBe('30')
    expect(crossFill({ price: '8', qty: '', amount: '100' }, 'amount').qty).toBe('12.5')
    expect(crossFill({ price: '', qty: '3', amount: '' }, 'qty')).toEqual({ price: '', qty: '3', amount: '' })
  })
  it('compra de un ticker nuevo: crea la posición con el tipo elegido (también ETF)', () => {
    const r = planTrade(base({ ticker: 'voo', price: '500', qty: '2', assetType: 'ETF', cash: true }), { uid, today })
    expect(r.ok).toBe(true)
    expect(r.op).toMatchObject({ uid, id: 1, type: 'buy', ticker: 'VOO', currency: 'USD', amount: 1000, cash: true, fx: null })
    expect(r.effect).toEqual({ kind: 'create', input: { t: 'VOO', type: 'ETF', sh: 2, cost: 500, fxCost: null, stop: null, note: '' } })
    expect(planTrade(base({ ticker: 'BTC-USD', price: '1', qty: '1' }), { uid, today }).effect.input.type).toBe('Crypto')
  })
  it('compra sobre una posición: promedio ponderado; el stop no se toca', () => {
    const prev = { id: '9', t: 'AAPL', type: 'Stock', sh: 10, cost: 100, stop: 90 }
    const r = planTrade(base({ ticker: 'AAPL', price: '200', qty: '10' }), { uid, today, lots: [prev] })
    expect(r.effect.kind).toBe('update')
    expect(r.effect.input).toMatchObject({ id: '9', sh: 20, cost: 150, stop: 90 })
  })
  it('venta: guarda el resultado con la entrada de la posición; vender todo pide confirmar', () => {
    const prev = { id: '9', t: 'AAPL', sh: 10, cost: 100 }
    const part = planTrade(base({ type: 'sell', ticker: 'AAPL', price: '120', qty: '4' }), { uid, today, lots: [prev] })
    expect(part.op.pnl).toBeCloseTo(80)
    expect(part.effect).toMatchObject({ kind: 'update', input: { sh: 6, cost: 100 } })
    const all = planTrade(base({ type: 'sell', ticker: 'AAPL', price: '120', qty: '10' }), { uid, today, lots: [prev] })
    expect(all.effect).toMatchObject({ kind: 'close', sold: 10 })
    expect(all.op.pnl).toBeCloseTo(200)
  })
  it('nunca vende más de lo que hay (ni deja el libro con unidades negativas)', () => {
    const prev = { id: '9', t: 'AAPL', sh: 10, cost: 100 }
    expect(planTrade(base({ type: 'sell', ticker: 'AAPL', price: '120', qty: '44' }), { uid, today, lots: [prev] }).errors.qty).toBe('sell_over')
    // Sin posición: lo que dicen las operaciones.
    const ops = [{ id: 1, type: 'buy', ticker: 'AAPL', qty: 3, amount: 300 }]
    expect(planTrade(base({ type: 'sell', ticker: 'AAPL', price: '120', qty: '3' }), { uid, today, ops }).ok).toBe(true)
    expect(planTrade(base({ type: 'sell', ticker: 'AAPL', price: '120', qty: '4' }), { uid, today, ops }).errors.qty).toBe('sell_over')
    expect(planTrade(base({ type: 'sell', ticker: 'NVDA', price: '1', qty: '1' }), { uid, today, ops }).errors.qty).toBe('sell_none')
    // Dos lotes: cuenta la suma.
    expect(planTrade(base({ type: 'sell', ticker: 'AAPL', price: '1', qty: '2' }), { uid, today, lots: [{ sh: 1, cost: 1 }, { sh: 1, cost: 1 }] }).ok).toBe(true)
  })
  it('varios lotes del ticker: guarda la operación y no ajusta la posición sola', () => {
    const r = planTrade(base({ ticker: 'AAPL', price: '1', qty: '1' }), { uid, today, lots: [{ id: 'a', sh: 1, cost: 1 }, { id: 'b', sh: 1, cost: 1 }] })
    expect(r.ok).toBe(true)
    expect(r.effect).toEqual({ kind: 'lots', count: 2 })
  })
  it('tipo de cambio de la operación solo si la fecha es hoy', () => {
    const rates = { CLP: 950 }
    expect(planTrade(base({ ticker: 'SQM-B.SN', price: '60000', qty: '1' }), { uid, today, rates }).op.fx).toBe(950)
    expect(planTrade(base({ ticker: 'SQM-B.SN', price: '60000', qty: '1', date: '2026-11-01' }), { uid, today, rates }).op.fx).toBeNull()
  })
  it('dividendo al efectivo, DRIP y bono', () => {
    const cash = planTrade(base({ type: 'dividend', ticker: 'AAPL', amount: '12,5' }), { uid, today })
    expect(cash.op).toMatchObject({ amount: 12.5, reinvested: false, qty: null, price: null })
    expect(cash.effect.kind).toBe('none')
    const drip = planTrade(base({ type: 'dividend', mode: 'drip', ticker: 'AAPL', price: '200', amount: '20' }), { uid, today, lots: [{ id: '1', sh: 10, cost: 100 }] })
    expect(drip.op).toMatchObject({ reinvested: true, qty: 0.1, amount: 20 })
    expect(drip.effect.input.sh).toBeCloseTo(10.1)
    const bonus = planTrade(base({ type: 'bonus', ticker: 'AAPL', qty: '2' }), { uid, today, lots: [{ id: '1', sh: 10, cost: 100 }] })
    expect(bonus.op.amount).toBe(0)
    expect(bonus.effect.input).toMatchObject({ sh: 12 })
    expect(bonus.effect.input.cost).toBeCloseTo(1000 / 12)
  })
  it('depósito y retiro: sin ticker, en la moneda elegida; el aporte de moyiq lleva su origen', () => {
    const d = planTrade(base({ type: 'deposit', currency: 'CLP', amount: '410000', source: 'moyiq', ticker: 'AAPL' }), { uid, today, ops: [{ id: 4 }] })
    expect(d.op).toMatchObject({ ticker: null, currency: 'CLP', amount: 410000, source: 'moyiq', id: 5, cash: null })
    expect(planTrade(base({ type: 'withdrawal', currency: 'XXX', amount: '5', source: 'moyiq' }), { uid, today }).op).toMatchObject({ currency: 'USD', source: null })
  })
  it('validaciones', () => {
    expect(planTrade(base({ ticker: '' }), { uid, today }).errors).toMatchObject({ ticker: 'ticker_required', qty: 'qty_required', price: 'price_required' })
    expect(planTrade(base({ type: 'dividend', ticker: 'AAPL' }), { uid, today }).errors).toEqual({ amount: 'amount_required' })
    expect(planTrade(base({ type: 'bonus', ticker: 'AAPL' }), { uid, today }).errors).toEqual({ qty: 'bonus_required' })
    expect(planTrade(base({ type: 'dividend', mode: 'drip', ticker: 'AAPL' }), { uid, today }).errors).toEqual({ qty: 'drip_required' })
    expect(planTrade(base({ ticker: 'AAPL', price: '1', qty: '1', date: '2026-12-01' }), { uid, today }).errors).toEqual({ date: 'date_future' })
    expect(planTrade(base({ ticker: 'AAPL', price: '1', qty: '1', date: '' }), { uid, today }).errors).toEqual({ date: 'date_required' })
    expect(planTrade(base({ ticker: 'AAPL', price: '1', qty: '1', rsi: '140' }), { uid, today }).errors).toEqual({ rsi: 'rsi_invalid' })
    expect(planTrade(base({ ticker: 'X.ZZ', price: '1', qty: '1' }), { uid, today }).errors).toEqual({ ticker: 'ticker_currency' })
  })
  it('números como los escribe la persona', () => {
    expect([num('1.234,5'), num('1,234.5'), num('12,5'), num('7'), num('')].map(x => (Number.isNaN(x) ? 'NaN' : x))).toEqual([1234.5, 1234.5, 12.5, 7, 'NaN'])
  })
  it('fecha local de hoy', () => {
    expect(localToday(new Date(2026, 0, 3))).toBe('2026-01-03')
  })
})
