import { describe, it, expect } from 'vitest'
import { applyTrade, buildTrade } from './investTrade.js'

const UID = '11111111-1111-4111-8111-111111111111'
const ctx = (o = {}) => ({ ticker: 'AAPL', ccy: 'USD', today: '2026-11-20', uid: UID, seq: 7, ...o })

describe('applyTrade (holdings.js de Invest)', () => {
  it('compra sin posición: crea con el costo por unidad', () => {
    expect(applyTrade(null, { type: 'buy', qty: 4, price: 100 })).toEqual({ action: 'create', sh: 4, cost: 100, fxCost: null })
  })
  it('compra con posición: promedio ponderado', () => {
    const r = applyTrade({ sh: 10, cost: 100 }, { type: 'buy', qty: 10, price: 200 })
    expect(r).toMatchObject({ action: 'update', sh: 20, cost: 150 })
  })
  it('compra solo con monto: deduce las unidades', () => {
    expect(applyTrade(null, { type: 'buy', amount: 500, price: 250 })).toMatchObject({ action: 'create', sh: 2, cost: 250 })
  })
  it('compra en otra moneda: el tipo de cambio de compra se pondera en dólares', () => {
    // 10 a 1000 con fx 900 (11,11 US$ c/u) + 10 a 1200 con fx 1000 (12 US$ c/u)
    const r = applyTrade({ sh: 10, cost: 1000, fxCost: 900 }, { type: 'buy', qty: 10, price: 1200, fx: 1000 })
    const usd = 10000 / 900 + 12000 / 1000
    expect(r.cost).toBe(1100)
    expect(r.fxCost).toBeCloseTo((20 * 1100) / usd, 9)
  })
  it('compra sin tipo de cambio de hoy: el de compra queda desconocido', () => {
    expect(applyTrade({ sh: 10, cost: 1000, fxCost: 900 }, { type: 'buy', qty: 1, price: 1000 }).fxCost).toBeNull()
  })
  it('venta: resta unidades, mantiene la entrada y calcula el resultado', () => {
    expect(applyTrade({ sh: 10, cost: 100, fxCost: null }, { type: 'sell', qty: 4, price: 130 }))
      .toEqual({ action: 'update', sh: 6, cost: 100, fxCost: null, sold: 4, pnl: 120 })
  })
  it('venta total: pide cerrar; nunca vende más de lo que hay', () => {
    const r = applyTrade({ sh: 5, cost: 100 }, { type: 'sell', qty: 9, price: 80 })
    expect(r.action).toBe('close')
    expect(r.sold).toBe(5)
    expect(r.pnl).toBe(-100)
  })
  it('venta sin posición o sin unidades: no hace nada', () => {
    expect(applyTrade(null, { type: 'sell', qty: 1, price: 1 }).action).toBe('none')
    expect(applyTrade({ sh: 1, cost: 1 }, { type: 'buy', qty: 0, price: 0 }).action).toBe('none')
  })
  it('bono: unidades sin costo', () => {
    expect(applyTrade({ sh: 10, cost: 100 }, { type: 'bonus', qty: 10 })).toMatchObject({ action: 'update', sh: 20, cost: 50 })
    expect(applyTrade(null, { type: 'bonus', qty: 2 })).toEqual({ action: 'create', sh: 2, cost: 0, fxCost: null })
  })
})

describe('buildTrade (formulario de la ficha)', () => {
  it('arma la operación del libro y el ajuste', () => {
    const v = buildTrade({ type: 'buy', price: '210,5', qty: '2', amount: '', date: '2026-11-20', note: ' x ', rsi: 55.4 }, ctx())
    expect(v.ok).toBe(true)
    expect(v.op).toMatchObject({ id: 7, uid: UID, ticker: 'AAPL', type: 'buy', price: 210.5, qty: 2, amount: 421, fx: null, rsi: 55, note: 'x', pnl: null, currency: 'USD' })
    expect(v.adj).toMatchObject({ action: 'create', sh: 2, cost: 210.5 })
  })
  it('valida precio, unidades o monto, fecha y nota', () => {
    const v = buildTrade({ type: 'buy', price: '', qty: '', amount: '', date: '2026-13-40', note: 'a'.repeat(501) }, ctx())
    expect(v.ok).toBe(false)
    expect(v.fields).toMatchObject({ price: 'price_invalid', qty: 'qty_or_amount_required', date: 'date_invalid', note: 'note_too_long' })
    expect(buildTrade({ type: 'buy', price: 1, qty: -1, date: '2026-11-20' }, ctx()).fields.qty).toBe('qty_invalid')
    expect(buildTrade({ type: 'buy', price: 1, qty: 1, date: '2026-11-21' }, ctx()).fields.date).toBe('date_future')
  })
  it('venta: sin unidades o con más de las que hay, error en el campo', () => {
    expect(buildTrade({ type: 'sell', price: 1, qty: 1, date: '2026-11-20' }, ctx()).fields.qty).toBe('sell_none')
    expect(buildTrade({ type: 'sell', price: 1, qty: 3, date: '2026-11-20' }, ctx({ holding: { sh: 2, cost: 1 } })).fields.qty).toBe('sell_too_many')
    const ok = buildTrade({ type: 'sell', price: 3, qty: 1, date: '2026-11-20' }, ctx({ holding: { sh: 2, cost: 1 } }))
    expect(ok.op.pnl).toBe(2)
  })
  it('el tipo de cambio solo vale si la operación es de hoy y en otra moneda (FIN-12)', () => {
    const hoy = buildTrade({ type: 'buy', price: 1000, qty: 1, date: '2026-11-20' }, ctx({ ccy: 'CLP', fx: 950 }))
    expect(hoy.op.fx).toBe(950)
    const antes = buildTrade({ type: 'buy', price: 1000, qty: 1, date: '2026-11-01' }, ctx({ ccy: 'CLP', fx: 950 }))
    expect(antes.op.fx).toBeNull()
    expect(buildTrade({ type: 'buy', price: 1, qty: 1, date: '2026-11-20' }, ctx({ fx: 950 })).op.fx).toBeNull()
  })
})
