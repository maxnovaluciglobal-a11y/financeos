// Efectivo y aportes (Hoy, F2): mismos casos que invest-web/test/ledger.test.js.
import { describe, it, expect } from 'vitest'
import { cashBook, cashByCurrency } from './investCash.js'
import { currencyOf, toUsd } from './investValuation.js'

const RATES = { CLP: 1000 }
const opts = (prices = {}, rates = RATES) => ({
  ccyOf: (t) => currencyOf(t),
  priceOf: (t) => prices[t] ?? null,
  toUsd: (v, c) => toUsd(v, c, rates),
})
const dep = (amount, extra = {}) => ({ id: 1, type: 'deposit', ticker: null, date: '2026-01-01', amount, ...extra })
const buy = (t, qty, price, extra = {}) => ({ id: 2, type: 'buy', ticker: t, date: '2026-01-02', qty, price, amount: qty * price, cash: true, ...extra })
const sell = (t, qty, price, extra = {}) => ({ id: 3, type: 'sell', ticker: t, date: '2026-01-03', qty, price, amount: qty * price, cash: true, ...extra })

describe('efectivo por moneda', () => {
  it('depósitos, retiros, compras y ventas lo mueven; sin mezclar monedas', () => {
    const ops = [dep(1000), buy('AAPL', 2, 100), sell('AAPL', 1, 150), { id: 4, type: 'withdrawal', date: '2026-02-01', amount: 50 }]
    expect(cashByCurrency(ops, currencyOf)).toEqual({ USD: 900 })
    expect(cashByCurrency([dep(1000), buy('SQM-B.SN', 1, 60000)], currencyOf)).toEqual({ USD: 1000, CLP: -60000 })
  })
  it('operaciones viejas sin marca: con depósitos pasan por el efectivo; sin ellos, no', () => {
    const old = { id: 2, type: 'buy', ticker: 'AAPL', date: '2026-01-02', qty: 1, price: 100, amount: 100 }
    expect(cashByCurrency([dep(500), old], currencyOf)).toEqual({ USD: 400 })
    expect(cashByCurrency([old], currencyOf)).toEqual({})
  })
  it('el dividendo al efectivo suma; reinvertido, no', () => {
    const div = { id: 5, type: 'dividend', ticker: 'AAPL', date: '2026-03-01', amount: 10 }
    expect(cashByCurrency([div], currencyOf)).toEqual({ USD: 10 })
    expect(cashByCurrency([{ ...div, reinvested: true }], currencyOf)).toEqual({})
  })
})

describe('total aportado y rendimiento', () => {
  it('rendimiento sobre lo aportado con el efectivo incluido', () => {
    const b = cashBook([dep(1000), buy('AAPL', 5, 100)], [{ t: 'AAPL', sh: 5, cost: 100 }], opts({ AAPL: 120 }))
    expect(b).toMatchObject({ cash: 500, contributed: 1000, positionsValue: 600, value: 1100, usesCash: true })
    expect(b.returnPct).toBeCloseTo(0.1)
  })
  it('una posición cargada a mano cuenta como aporte a su costo y no usa el efectivo', () => {
    const b = cashBook([], [{ t: 'AAPL', sh: 10, cost: 100 }], opts({ AAPL: 120 }))
    expect(b).toMatchObject({ contributed: 1000, openingCount: 1, usesCash: false })
    expect(b.gain).toBeCloseTo(200)
  })
  it('borrar las posiciones no crea una pérdida falsa (error de Capital Planner)', () => {
    const ops = [dep(6000), buy('PG', 2, 150.5), buy('VOO', 1, 500)].map((o, i) => ({ ...o, id: i + 1 }))
    const b = cashBook(ops, [], opts({ PG: 150.5, VOO: 500 }))
    expect(b.orphans.map(o => o.t).sort()).toEqual(['PG', 'VOO'])
    expect(b.value).toBeCloseTo(6000)
    expect(b.returnPct).toBeCloseTo(0)
    expect(cashBook(ops, [], opts({})).unpriced.length).toBe(2)
  })
  it('sin tipo de cambio excluye, avisa y no inventa un rendimiento', () => {
    const b = cashBook([dep(1000), dep(500000, { currency: 'CLP' })], [{ t: 'SQM-B.SN', sh: 1, cost: 60000 }], opts({ 'SQM-B.SN': 60000 }, {}))
    expect(b).toMatchObject({ cash: 1000, excludedCcys: ['CLP'], excludedPositions: ['SQM-B.SN'], complete: false, gain: null, returnPct: null })
  })
  it('usa el tipo de cambio de la operación para lo aportado', () => {
    const b = cashBook([dep(450000, { currency: 'CLP', fx: 900 })], [], opts())
    expect(b.contributed).toBeCloseTo(500)
    expect(b.cash).toBe(450)
    expect(b.gain).toBeCloseTo(-50)
  })
})
