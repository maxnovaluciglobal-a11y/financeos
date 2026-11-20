// Tests espejo de invest-web/test/fx.test.js, fx-at-cost.test.js y
// uxp8-ars-mep.test.js (las partes puras): moyiq y Invest tienen que dar la
// misma cifra para el mismo portafolio. Si un caso cambia allá, cambia acá.
import { describe, it, expect } from 'vitest'
import {
  currencyOf, rateOf, toUsd, fromUsd, decimalsFor, convertHoldings, portfolioTotals, sumUsd,
  arsRateFor, readArsKind, ARS_KIND_KEY, assetRates, displayRate, toDisplay, holdingFromRowFull, holdingRows,
} from './investValuation.js'

const RATES = { CLP: 940, BRL: 5, MXN: 18.2 }

describe('rateOf / toUsd / fromUsd (fx.test.js)', () => {
  it('USD no necesita tasa y no altera el número', () => {
    expect(rateOf('USD', {})).toBe(1)
    expect(toUsd(123.456, 'USD', {})).toBe(123.456)
    expect(toUsd(0.1 + 0.2, 'USD', null)).toBe(0.1 + 0.2)
  })
  it('convierte CLP a USD con la tasa por dólar', () => {
    expect(toUsd(63190, 'CLP', RATES)).toBeCloseTo(67.2234, 3)
    expect(fromUsd(100, 'CLP', RATES)).toBe(94000)
  })
  it('sin tasa devuelve null, nunca 1:1', () => {
    expect(toUsd(100, 'COP', RATES)).toBe(null)
    expect(toUsd(100, null, RATES)).toBe(null)
    expect(rateOf('CLP', { CLP: 0 })).toBe(null)
    expect(rateOf('CLP', { CLP: 'x' })).toBe(null)
  })
  it('VOD.L en peniques: 7.200 GBp = 72 GBP, de ida y de vuelta', () => {
    const EU = { GBP: 0.79 }
    expect(toUsd(7200, 'GBp', EU)).toBeCloseTo(72 / 0.79, 6)
    expect(fromUsd(72 / 0.79, 'GBp', EU)).toBeCloseTo(7200, 6)
  })
  it('decimales por moneda', () => {
    expect(decimalsFor('CLP')).toBe(0)
    expect(decimalsFor('JPY')).toBe(0)
    expect(decimalsFor('BRL')).toBe(2)
    expect(decimalsFor('USD')).toBe(2)
  })
})

describe('portfolioTotals (fx.test.js)', () => {
  it('mezcla USD + CLP: la posición en CLP suma su valor en USD', () => {
    const port = [{ t: 'AAPL', sh: 10, cost: 200 }, { t: 'SQM-B.SN', sh: 100, cost: 60000 }]
    const live = { AAPL: { price: 250, changePct: 0 }, 'SQM-B.SN': { price: 63190, changePct: 0 } }
    const T = portfolioTotals(port, (t) => live[t], (t) => currencyOf(t), RATES)
    expect(T.value).toBeCloseTo(2500 + 6319000 / 940, 6)
    expect(T.cost).toBeCloseTo(2000 + 6000000 / 940, 6)
    expect(T.excluded).toBe(0)
  })
  it('sin tipo de cambio la posición queda fuera y se cuenta en excluded', () => {
    const port = [{ t: 'AAPL', sh: 10, cost: 200 }, { t: 'ECOPETROL.CL', sh: 100, cost: 2000 }]
    const live = { AAPL: { price: 250, changePct: 0.01 }, 'ECOPETROL.CL': { price: 2100, changePct: 0 } }
    const T = portfolioTotals(port, (t) => live[t], (t) => currencyOf(t), RATES)
    expect(T).toMatchObject({ value: 2500, cost: 2000, excluded: 1, missing: 0, priced: 1 })
  })
})

describe('tipo de cambio de la compra y efecto cambiario (fx-at-cost.test.js, FIN-12)', () => {
  const R = { CLP: 980 }
  const ccy = (t) => currencyOf(t)
  const sqm = { t: 'SQM-B.SN', sh: 100, cost: 60000, fxCost: 900 }
  const live = { 'SQM-B.SN': { price: 60000, changePct: 0 } }
  it('el caso de la auditoría da −8,2 % en USD y el efecto cambiario aparte', () => {
    const T = portfolioTotals([sqm], (t) => live[t], ccy, R)
    expect(T.cost).toBeCloseTo(100 * 60000 / 900, 6)
    expect(T.value).toBeCloseTo(100 * 60000 / 980, 6)
    expect(Math.round(T.totalPct * 1000) / 10).toBe(-8.2)
    expect(T.fxEffect).toBeCloseTo(100 * 60000 / 980 - 100 * 60000 / 900, 6)
    expect(T.fxKnown).toBe(1)
    expect(T.fxUnknown).toBe(0)
  })
  it('sin fxCost se mantiene el cálculo anterior y se cuenta como desconocido', () => {
    const T = portfolioTotals([{ t: 'SQM-B.SN', sh: 100, cost: 60000 }], (t) => live[t], ccy, R)
    expect(T.totalPct).toBe(0)
    expect(T.fxEffect).toBe(0)
    expect(T.fxUnknown).toBe(1)
  })
  it('un portafolio en USD no cambia en nada (fxCost se ignora)', () => {
    const T = portfolioTotals([{ t: 'AAPL', sh: 2, cost: 100, fxCost: 5 }], () => ({ price: 110, changePct: 0 }), ccy, R)
    expect(T).toMatchObject({ cost: 200, value: 220, total: 20, fxEffect: 0, fxKnown: 0, fxUnknown: 0 })
  })
  it('fxCost inválido (0, negativo, texto, null) cuenta como desconocido', () => {
    for (const fxCost of [0, -1, 'x', null]) {
      const T = portfolioTotals([{ t: 'SQM-B.SN', sh: 1, cost: 1000, fxCost }], (t) => live[t], ccy, R)
      expect(T.fxUnknown).toBe(1)
    }
  })
  it('convertHoldings expone costUsdBuy con fxCost; null sin él o en USD', () => {
    const { rows } = convertHoldings([
      { t: 'SQM-B.SN', sh: 100, cost: 60000, fxCost: 900 },
      { t: 'SQM-B.SN', sh: 1, cost: 60000 },
      { t: 'AAPL', sh: 1, cost: 100 },
    ], ccy, R)
    expect(rows[0].costUsdBuy).toBeCloseTo(100 * 60000 / 900, 6)
    expect(rows[0].fxCost).toBe(900)
    expect(rows[1].costUsdBuy).toBe(null)
    expect(rows[2].costUsdBuy).toBe(null)
    expect(rows[0].cost).toBeCloseTo(60000 / 980, 9)
  })
  it('la fila de la pantalla suma lo mismo que el total y lleva su efecto cambiario', () => {
    const rows = holdingRows([sqm, { t: 'AAPL', sh: 1, cost: 100 }], { ...live, AAPL: { price: 120, changePct: 0 } }, R)
    const T = portfolioTotals([sqm, { t: 'AAPL', sh: 1, cost: 100 }], (t) => (t === 'AAPL' ? { price: 120 } : live[t]), ccy, R)
    expect(rows.reduce((a, r) => a + r.costUsd, 0)).toBeCloseTo(T.cost, 9)
    expect(rows.find(r => r.t === 'SQM-B.SN').fxEffectUsd).toBeCloseTo(T.fxEffect, 9)
    expect(rows.find(r => r.t === 'AAPL').fxEffectUsd).toBe(null)
  })
})

describe('convertHoldings (fx.test.js)', () => {
  it('el stop en CLP se convierte a USD y conserva los nativos', () => {
    const { rows, excluded } = convertHoldings([{ id: 1, t: 'SQM-B.SN', sh: 100, cost: 60000, cur: 63190, stop: 58000 }], (t) => currencyOf(t), RATES)
    expect(excluded).toHaveLength(0)
    expect(rows[0]).toMatchObject({ ccy: 'CLP', curN: 63190, stopN: 58000, costN: 60000 })
    expect((rows[0].cur - rows[0].stop) * 100).toBeCloseTo((63190 - 58000) * 100 / 940, 6)
  })
  it('USD queda intacto (mismos números que entraron)', () => {
    const { rows } = convertHoldings([{ id: 1, t: 'AAPL', sh: 3, cost: 172.5, cur: 234.12, stop: 222 }], (t) => currencyOf(t), {})
    expect(rows[0]).toMatchObject({ cost: 172.5, cur: 234.12, stop: 222, fx: 1 })
  })
  it('sin tasa: va a excluded con sus valores nativos', () => {
    const { rows, excluded } = convertHoldings([
      { id: 1, t: 'AAPL', sh: 1, cost: 100, cur: 110 },
      { id: 2, t: 'PETR4.SA', sh: 10, cost: 30, cur: 35 },
    ], (t) => currencyOf(t), { CLP: 940 })
    expect(rows.map((r) => r.t)).toEqual(['AAPL'])
    expect(excluded[0]).toMatchObject({ t: 'PETR4.SA', ccy: 'BRL', cur: 35, curN: 35, fx: null })
  })
})

describe('sumUsd (fx.test.js)', () => {
  it('suma montos en distintas monedas y cuenta los que no tienen tasa', () => {
    const trades = [
      { ticker: 'AAPL', amount: 1000 },
      { ticker: 'SQM-B.SN', amount: 940000 },
      { ticker: 'ECOPETROL.CL', amount: 5000 },
      { ticker: null, amount: 200 },
    ]
    const r = sumUsd(trades, (x) => x.amount, (x) => (x.ticker ? currencyOf(x.ticker) : 'USD'), RATES)
    expect(r.total).toBe(1000 + 1000 + 200)
    expect(r.excluded).toBe(1)
    expect(r.items).toHaveLength(3)
  })
})

describe('peso argentino: MEP u oficial (uxp8-ars-mep.test.js)', () => {
  const mep = { rate: 1544.1, date: '2026-10-19T21:00:00.000Z' }
  it('MEP por defecto cuando hay dato', () => {
    expect(arsRateFor('MEP', mep, 1510)).toEqual({ rate: 1544.1, kind: 'MEP', fallback: false, date: mep.date })
    expect(arsRateFor(undefined, mep, 1510).kind).toBe('MEP')
  })
  it('Oficial cuando se elige', () => {
    expect(arsRateFor('Oficial', mep, 1510)).toEqual({ rate: 1510, kind: 'Oficial', fallback: false, date: null })
  })
  it('sin MEP vuelve al oficial y lo marca', () => {
    expect(arsRateFor('MEP', null, 1510)).toEqual({ rate: 1510, kind: 'Oficial', fallback: true, date: null })
    expect(arsRateFor('MEP', { rate: 0 }, 1510).kind).toBe('Oficial')
  })
  it('sin oficial y con MEP, usa el MEP marcado como respaldo; sin ninguno, null', () => {
    expect(arsRateFor('Oficial', mep, null)).toMatchObject({ rate: 1544.1, kind: 'MEP', fallback: true })
    expect(arsRateFor('MEP', null, null)).toBeNull()
  })
  it('USD 1.000 se ven como ARS 1.544.100 con el MEP y 1.510.000 con el oficial', () => {
    expect(1000 * arsRateFor('MEP', { rate: 1544.1 }, 1510).rate).toBeCloseTo(1544100, 6)
    expect(1000 * arsRateFor('Oficial', { rate: 1544.1 }, 1510).rate).toBeCloseTo(1510000, 6)
  })
  it('una posición de .BA vuelve a su monto en pesos (ida y vuelta con la misma tasa)', () => {
    const r = arsRateFor('MEP', { rate: 1544.1 }, 1510).rate
    const port = [{ t: 'GGAL.BA', sh: 100, cost: 5000, cur: 6176.4 }]
    const { rows } = convertHoldings(port, () => 'ARS', { ARS: r })
    expect(rows[0].cur).toBeCloseTo(4, 10)
    expect(rows[0].cur * r * 100).toBeCloseTo(617640, 6)
    const tot = portfolioTotals(port, () => ({ price: 6176.4, changePct: 0 }), () => 'ARS', { ARS: r })
    expect(tot.value).toBeCloseTo(400, 10)
    expect(tot.cost).toBeCloseTo(500000 / 1544.1, 10)
  })
  it('la preferencia es de la cuenta (clave fos_*) y por defecto MEP', () => {
    expect(ARS_KIND_KEY.startsWith('fos_')).toBe(true)
    expect(readArsKind(() => null)).toBe('MEP')
    expect(readArsKind(() => 'Oficial')).toBe('Oficial')
    expect(readArsKind(() => 'cualquier cosa')).toBe('MEP')
    expect(readArsKind(() => { throw new Error('x') })).toBe('MEP')
  })
  it('assetRates: descarta las tasas de respaldo y aplica la preferencia al ARS', () => {
    const latam = { rates: { CLP: 950, ARS: 1060, MXN: 17.3 }, sources: { CLP: 'mindicador', ARS: 'yahoo', MXN: 'fallback' } }
    const a = assetRates(latam, { mep: mep }, 'MEP')
    expect(a.rates).toEqual({ CLP: 950, ARS: 1544.1 })
    expect(assetRates(latam, { mep }, 'Oficial').rates.ARS).toBe(1060)
    const noArs = assetRates({ rates: { ARS: 1060 }, sources: { ARS: 'fallback' } }, null, 'MEP')
    expect(noArs.rates.ARS).toBeUndefined()
    expect(noArs.ars).toBeNull()
  })
})

describe('moneda de visualización', () => {
  const latam = { rates: { CLP: 950, MXN: 17.3 }, sources: { CLP: 'mindicador', MXN: 'fallback' } }
  it('USD es 1; otra moneda usa su tasa y dice si es de respaldo', () => {
    expect(displayRate('USD', latam)).toEqual({ ccy: 'USD', rate: 1, fallback: false })
    expect(displayRate('CLP', latam)).toEqual({ ccy: 'CLP', rate: 950, fallback: false })
    expect(displayRate('MXN', latam)).toEqual({ ccy: 'MXN', rate: 17.3, fallback: true })
    expect(displayRate('PEN', latam)).toBeNull()
  })
  it('ARS se muestra con la tasa elegida (MEP u oficial)', () => {
    expect(displayRate('ARS', latam, { rate: 1544.1, kind: 'MEP' })).toMatchObject({ rate: 1544.1, kind: 'MEP' })
  })
  it('toDisplay convierte y no inventa: sin tasa, null', () => {
    expect(toDisplay(10, { rate: 950 })).toBe(9500)
    expect(toDisplay(10, null)).toBeNull()
    expect(toDisplay(null, { rate: 1 })).toBeNull()
  })
})

describe('holdingFromRowFull', () => {
  it('lee stop y nota como rowToHolding de Invest', () => {
    expect(holdingFromRowFull({ id: 7, ticker: 'aapl', asset_type: 'Stock', shares: '2', avg_cost: '100', stop: '90', note: 'x', fx_at_cost: null }))
      .toEqual({ id: '7', t: 'AAPL', type: 'Stock', sh: 2, cost: 100, fxCost: null, stop: 90, note: 'x' })
    expect(holdingFromRowFull({ ticker: 'A', stop: 0 }).stop).toBeNull()
    expect(holdingFromRowFull({ ticker: 'A', stop: null }).note).toBe('')
  })
})
