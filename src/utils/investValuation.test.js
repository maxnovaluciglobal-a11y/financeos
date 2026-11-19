import { describe, it, expect } from 'vitest'
import {
  arsRate, buildSnapshot, currencyOf, holdingFromRow, portfolioTotals, quoteBatches, rateOf, realRates,
} from './investValuation.js'

const RATES = { CLP: 940, BRL: 5, MXN: 18.2 }

// Casos de invest-web/test/fx.test.js: las dos apps dan la misma cifra.
describe('currencyOf (igual que Invest)', () => {
  it('la cotización manda sobre el sufijo', () => {
    expect(currencyOf('SQM-B.SN', 'CLP')).toBe('CLP')
    expect(currencyOf('ALGO.SN', 'USD')).toBe('USD')
  })
  it('sin cotización, el sufijo: .SN .SA .MX .BA', () => {
    expect(currencyOf('SQM-B.SN')).toBe('CLP')
    expect(currencyOf('PETR4.SA')).toBe('BRL')
    expect(currencyOf('WALMEX.MX')).toBe('MXN')
    expect(currencyOf('GGAL.BA')).toBe('ARS')
  })
  it('sin sufijo es USD; sufijo desconocido, null', () => {
    expect(currencyOf('AAPL')).toBe('USD')
    expect(currencyOf('BTC-USD')).toBe('USD')
    expect(currencyOf('BRK-B')).toBe('USD')
    expect(currencyOf('XYZ.QQ')).toBeNull()
  })
  it('los peniques no se confunden con la libra: 1 GBP = 100 GBp', () => {
    expect(currencyOf('VOD.L', 'GBp')).toBe('GBp')
    expect(rateOf('GBp', { GBP: 0.8 })).toBe(80)
  })
})

// INV-N23: mismos casos que invest-web/test/fx.test.js.
describe('INV-N23: monedas europeas, CAD y JPY', () => {
  const EU = { EUR: 0.92, GBP: 0.79, CHF: 0.88, SEK: 10.5, CAD: 1.37, JPY: 150 }
  it('infiere la moneda por el sufijo de las bolsas europeas', () => {
    expect(currencyOf('SAP.DE')).toBe('EUR')
    expect(currencyOf('SAN.MC')).toBe('EUR')
    expect(currencyOf('MC.PA')).toBe('EUR')
    expect(currencyOf('ASML.AS')).toBe('EUR')
    expect(currencyOf('VOD.L')).toBe('GBp')
    expect(currencyOf('NESN.SW')).toBe('CHF')
    expect(currencyOf('VOLV-B.ST')).toBe('SEK')
    expect(currencyOf('SHOP.TO')).toBe('CAD')
    expect(currencyOf('7203.T')).toBe('JPY')
  })
  it('una acción en EUR suma al total en USD', () => {
    const t = portfolioTotals([{ t: 'SAP.DE', sh: 10, cost: 184 }], () => ({ price: 230, changePct: 0 }), (x) => currencyOf(x, 'EUR'), EU)
    expect(t.excluded).toBe(0)
    expect(t.value).toBeCloseTo(2300 / 0.92, 6)
    expect(t.cost).toBeCloseTo(1840 / 0.92, 6)
  })
  it('VOD.L en peniques: 7.200 GBp valen 72 GBP, no 7.200', () => {
    const t = portfolioTotals([{ t: 'VOD.L', sh: 1, cost: 7200 }], () => null, (x) => currencyOf(x, 'GBp'), EU)
    expect(t.value).toBeCloseTo(72 / 0.79, 6)
  })
  it('ZAc e ILA se derivan de ZAR e ILS; sin la mayor, quedan sin tasa', () => {
    expect(rateOf('ZAc', { ZAR: 18 })).toBe(1800)
    expect(rateOf('ILA', { ILS: 3.7 })).toBe(370)
    expect(rateOf('ZAc', EU)).toBeNull()
    expect(rateOf('GBp', {})).toBeNull()
  })
  it('una tasa propia de la submoneda manda sobre la derivada', () => {
    expect(rateOf('GBp', { GBp: 81, GBP: 0.79 })).toBe(81)
  })
})

describe('portfolioTotals (igual que Invest)', () => {
  it('USD: mismas cuentas que dashTotals', () => {
    const port = [{ t: 'AAPL', sh: 10, cost: 100 }, { t: 'MSFT', sh: 2, cost: 300 }]
    const live = { AAPL: { price: 120, changePct: 0.02 } }
    const T = portfolioTotals(port, (t) => live[t] || null, (t) => currencyOf(t), {})
    expect(T.value).toBeCloseTo(1200 + 600)
    expect(T.cost).toBeCloseTo(1600)
    expect(T.total).toBeCloseTo(200)
    expect(T.totalPct).toBeCloseTo(0.125)
    expect(T.day).toBeCloseTo(10 * (120 - 120 / 1.02))
    expect(T.priced).toBe(1)
    expect(T.missing).toBe(1)
    expect(T.excluded).toBe(0)
  })
  it('una acción en CLP no suma millones de dólares', () => {
    const port = [{ t: 'SQM-B.SN', sh: 100, cost: 60000 }]
    const T = portfolioTotals(port, () => ({ price: 63190, changePct: 0 }), (t) => currencyOf(t), RATES)
    expect(T.value).toBeCloseTo((100 * 63190) / 940)
    expect(T.cost).toBeCloseTo((100 * 60000) / 940)
  })
  it('sin tasa, fuera: nunca 1:1', () => {
    const port = [{ t: 'AAPL', sh: 1, cost: 100 }, { t: 'SQM-B.SN', sh: 100, cost: 60000 }]
    const T = portfolioTotals(port, () => null, (t) => currencyOf(t), {})
    expect(T.value).toBe(100)
    expect(T.excluded).toBe(1)
  })
  it('el costo usa el tipo de cambio de la compra si se conoce (FIN-12)', () => {
    const port = [{ t: 'SQM-B.SN', sh: 100, cost: 60000, fxCost: 800 }]
    const T = portfolioTotals(port, () => null, (t) => currencyOf(t), RATES)
    expect(T.cost).toBeCloseTo((100 * 60000) / 800)
    expect(T.value).toBeCloseTo((100 * 60000) / 940)
  })
})

describe('realRates: las tasas de respaldo no convierten activos', () => {
  it('saca las marcadas fallback', () => {
    expect(realRates({ CLP: 950, MXN: 18 }, { CLP: 'mindicador', MXN: 'fallback' })).toEqual({ CLP: 950 })
    expect(realRates(undefined, undefined)).toEqual({})
  })
})

describe('arsRate', () => {
  it('MEP primero; sin MEP, el oficial real; sin nada, null', () => {
    expect(arsRate({ rate: 1200 }, 1000)).toBe(1200)
    expect(arsRate(null, 1000)).toBe(1000)
    expect(arsRate(null, null)).toBeNull()
    expect(arsRate({ rate: 0 }, undefined)).toBeNull()
  })
})

describe('holdingFromRow', () => {
  it('traduce la fila de portfolio_holdings', () => {
    expect(holdingFromRow({ ticker: 'aapl ', asset_type: 'ETF', shares: '2.5', avg_cost: '100', fx_at_cost: null }))
      .toEqual({ id: null, t: 'AAPL', type: 'ETF', sh: 2.5, cost: 100, fxCost: null })
    expect(holdingFromRow({ ticker: 'SQM-B.SN', shares: 1, avg_cost: 1, fx_at_cost: 900 }).fxCost).toBe(900)
  })
})

describe('quoteBatches', () => {
  it('reparte por API y en trozos de 10 (Yahoo) y 30 (CoinGecko)', () => {
    const stocks = Array.from({ length: 23 }, (_, i) => ({ t: `T${i}`, type: 'Stock' }))
    const crypto = [{ t: 'BTC-USD', type: 'Crypto' }, { t: 'ETH-USD', type: 'Crypto' }]
    const b = quoteBatches([...stocks, ...crypto])
    expect(b.stocks.map(x => x.length)).toEqual([10, 10, 3])
    expect(b.crypto).toEqual([['BTC-USD', 'ETH-USD']])
  })
  it('no repite tickers y deja fuera lo que haría fallar el lote', () => {
    const b = quoteBatches([{ t: 'AAPL' }, { t: 'AAPL' }, { t: 'NO VALE' }, { t: '.', type: 'Crypto' }])
    expect(b.stocks).toEqual([['AAPL']])
    expect(b.crypto).toEqual([])
  })
})

describe('buildSnapshot', () => {
  const quotes = {
    AAPL: { price: 120, changePct: 0.02, currency: 'USD', marketTime: 2000 },
    'SQM-B.SN': { price: 47000, changePct: 0, currency: 'CLP', marketTime: 1000 },
  }
  const holdings = [
    { t: 'AAPL', sh: 10, cost: 100 },
    { t: 'SQM-B.SN', sh: 10, cost: 47000 },
    { t: 'VOD.L', sh: 5, cost: 70 },
  ]

  it('sin posiciones: vacío, sin valor', () => {
    const s = buildSnapshot({ holdings: [], now: 5 })
    expect(s).toMatchObject({ status: 'empty', positions: 0, valueUsd: null, at: 5 })
  })
  it('con precios: valor, cambios, hora del precio más viejo y exclusiones', () => {
    const s = buildSnapshot({ holdings, quotes, rates: RATES })
    expect(s.status).toBe('live')
    expect(s.positions).toBe(3)
    expect(s.excluded).toBe(1)
    expect(s.valueUsd).toBeCloseTo(1200 + 500)
    expect(s.dayUsd).toBeCloseTo(10 * (120 - 120 / 1.02))
    expect(s.totalUsd).toBeCloseTo(200)
    expect(s.pricesAt).toBe(1000)
    expect(s.yahoo).toBe(true)
    expect(s.coingecko).toBe(false)
  })
  it('no fallan los precios: al costo, sin cambios del día ni resultado', () => {
    const s = buildSnapshot({ holdings: holdings.slice(0, 1), rates: {} })
    expect(s).toMatchObject({ status: 'cost', valueUsd: 1000, dayUsd: null, totalUsd: null, pricesAt: null, priced: 0 })
  })
  it('falla el tipo de cambio: lo local queda fuera, jamás 1:1', () => {
    const s = buildSnapshot({ holdings, quotes, rates: {} })
    expect(s.excluded).toBe(2)
    expect(s.valueUsd).toBeCloseTo(1200)
  })
  it('ninguna posición convertible: sin valor', () => {
    const s = buildSnapshot({ holdings: [{ t: 'SQM-B.SN', sh: 1, cost: 1 }], rates: {} })
    expect(s).toMatchObject({ status: 'nofx', valueUsd: null, excluded: 1 })
  })
  it('lo guardado no lleva tickers', () => {
    const s = JSON.stringify(buildSnapshot({ uid: 'u', holdings, quotes, rates: RATES }))
    expect(s).not.toContain('AAPL')
    expect(s).not.toContain('SQM')
  })
})

describe('holdingRows y allocationByType', async () => {
  const { holdingRows, allocationByType, portfolioTotals, currencyOf } = await import('./investValuation.js')
  const holdings = [
    { t: 'AAPL', type: 'Stock', sh: 10, cost: 100, fxCost: null },
    { t: 'SQM-B.SN', type: 'Stock', sh: 100, cost: 40000, fxCost: 800 },
    { t: 'BTC-USD', type: 'Crypto', sh: 0.1, cost: 50000, fxCost: null },
    { t: 'XYZ.ZZ', type: 'Stock', sh: 1, cost: 10, fxCost: null },
  ]
  const quotes = { AAPL: { price: 120, changePct: 0.02 }, 'SQM-B.SN': { price: 44000, currency: 'CLP', changePct: -0.01 } }
  const rates = { CLP: 1000 }
  const rows = holdingRows(holdings, quotes, rates)
  const by = Object.fromEntries(rows.map(r => [r.t, r]))

  it('estado por posición: con precio, al costo y sin tipo de cambio', () => {
    expect(by.AAPL.status).toBe('live')
    expect(by['BTC-USD'].status).toBe('cost')
    expect(by['XYZ.ZZ'].status).toBe('nofx')
    expect(by['XYZ.ZZ'].valueUsd).toBeNull()
  })
  it('ganancia y costo al tipo de cambio de compra', () => {
    expect(by.AAPL.plUsd).toBeCloseTo(200, 6)
    expect(by['SQM-B.SN'].costUsd).toBeCloseTo(100 * 40000 / 800, 6)
    expect(by['SQM-B.SN'].valueUsd).toBeCloseTo(100 * 44000 / 1000, 6)
  })
  it('las filas suman lo mismo que portfolioTotals', () => {
    const T = portfolioTotals(holdings, t => quotes[t] || null, t => currencyOf(t, quotes[t]?.currency), rates)
    const sum = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0)
    expect(sum('valueUsd')).toBeCloseTo(T.value, 6)
    expect(sum('costUsd')).toBeCloseTo(T.cost, 6)
    expect(sum('dayUsd')).toBeCloseTo(T.day, 6)
  })
  it('INV-N15: dos lotes del mismo ticker son dos filas con su propio id', () => {
    const lots = [
      holdingFromRow({ id: 11, ticker: 'AAPL', asset_type: 'Stock', shares: 1, avg_cost: 100 }),
      holdingFromRow({ id: 12, ticker: 'AAPL', asset_type: 'Stock', shares: 2, avg_cost: 150 }),
    ]
    const r = holdingRows(lots, { AAPL: { price: 200, changePct: 0 } }, {})
    expect(r.map(x => x.id).sort()).toEqual(['11', '12'])
    expect(new Set(r.map(x => x.id)).size).toBe(2)
    expect(r.reduce((a, x) => a + x.valueUsd, 0)).toBeCloseTo(600, 6)
  })
  it('INV-N15: la lista de posiciones no usa el ticker como key', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(new URL('../pages/Investments/Portfolio.jsx', import.meta.url), 'utf8')
    expect(src).not.toMatch(/<li key=\{r\.t\}>/)
    expect(src).toContain('key={r.id ?? `${r.t}-${i}`}')
  })
  it('ordena por valor y reparte por tipo', () => {
    expect(rows[rows.length - 1].t).toBe('XYZ.ZZ')
    const alloc = allocationByType(rows)
    expect(alloc.map(a => a.type).sort()).toEqual(['Crypto', 'Stock'])
    expect(alloc.reduce((a, x) => a + x.share, 0)).toBeCloseTo(1, 6)
  })
})
