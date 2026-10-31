import { describe, it, expect } from 'vitest'
import { aporteHandoff, investValueForUser, monthContributions, resolveUserRate, withInvest } from './investNetWorth.js'
import { calcNetWorth } from './netWorth.js'

const snap = { valueUsd: 1000, at: 111, pricesAt: 222, status: 'live', fx: { rates: { CLP: 950 }, at: 333 } }
const none = () => null

describe('resolveUserRate', () => {
  it('en USD no hay conversión', () => {
    expect(resolveUserRate({ currency: 'USD' })).toEqual({ rate: 1, at: null, source: 'usd' })
  })
  it('quien usa moneda de referencia conserva su tasa con fecha', () => {
    const r = resolveUserRate({ currency: 'VES', country: 'VE', usdRate: 40, usdRateAt: 500, usdRateSource: 'bcv' }, snap.fx, none)
    expect(r).toEqual({ rate: 40, at: 500, source: 'bcv' })
  })
  it('usa la caché de la tasa con su fecha', () => {
    const read = () => JSON.stringify({ source: 'api', oficial: 41, ts: 600 })
    expect(resolveUserRate({ currency: 'VES', country: 'VE' }, null, read)).toMatchObject({ rate: 41, at: 600 })
  })
  it('el resto usa la tasa de mercado real que trajo Invest', () => {
    expect(resolveUserRate({ currency: 'CLP', country: 'CL' }, snap.fx, none)).toEqual({ rate: 950, at: 333, source: 'market' })
  })
  it('una tasa guardada sin fecha o una fija de respaldo no sirven', () => {
    expect(resolveUserRate({ currency: 'VES', country: 'VE', usdRate: 36 }, null, none)).toBeNull()
    expect(resolveUserRate({ currency: 'EUR', country: 'DE' }, snap.fx, none)).toBeNull()
  })
})

describe('investValueForUser', () => {
  it('convierte a la moneda de la persona con la fecha del precio', () => {
    const v = investValueForUser(snap, { currency: 'CLP', country: 'CL' }, none)
    expect(v).toMatchObject({ usd: 1000, amount: 950000, at: 222 })
  })
  it('sin tasa queda en US$ y sin monto', () => {
    const v = investValueForUser(snap, { currency: 'EUR', country: 'DE' }, none)
    expect(v.usd).toBe(1000)
    expect(v.amount).toBeNull()
  })
  it('sin valor no hay nada', () => {
    expect(investValueForUser(null, {}, none)).toBeNull()
    expect(investValueForUser({ valueUsd: null, status: 'nofx' }, { currency: 'USD' }, none)).toBeNull()
  })
})

describe('withInvest: patrimonio neto', () => {
  const base = { totalActivos: 500, totalPasivos: 100, netWorth: 400, hasData: true }
  it('suma como línea aparte', () => {
    const r = withInvest(base, { usd: 10, amount: 950 })
    expect(r).toMatchObject({ totalActivos: 1450, netWorth: 1350, investInTotal: true })
  })
  it('sin tasa NO suma al total', () => {
    const r = withInvest(base, { usd: 10, amount: null })
    expect(r).toMatchObject({ totalActivos: 500, netWorth: 400, investInTotal: false })
    expect(r.investments.usd).toBe(10)
  })
  it('sin valor deja todo igual', () => {
    expect(withInvest(base, null)).toMatchObject({ netWorth: 400, investInTotal: false, investments: null })
  })
  it('nunca cuenta dos veces lo que está en Metas', () => {
    const goals = [{ saved: 300 }]
    const nw = calcNetWorth({ goals, debts: [], incomes: [], expenses: [], settings: {} })
    const r = withInvest(nw, { usd: 1, amount: 200 })
    expect(r.savedInGoals).toBe(300)
    expect(r.netWorth).toBe(500)
  })
  it('una cuenta sin nada más igual tiene patrimonio que mostrar', () => {
    expect(withInvest({ ...base, hasData: false }, { usd: 1, amount: 1 }).hasData).toBe(true)
  })
})

describe('monthContributions: aportes del mes', () => {
  const expenses = [
    { inv: true, date: '2026-10-05', amount: 100 },
    { inv: true, date: '2026-10-09', amount: 50 },
    { inv: true, date: '2026-09-30', amount: 70 },
    { date: '2026-10-05', amount: 999 },
    { inv: true, date: '2026-10-05', amount: 400, project: 'Depto Ñuñoa' },
  ]
  it('cuenta egresos marcados del mes, sin el flujo de una propiedad', () => {
    expect(monthContributions(expenses, '2026-10')).toEqual({ count: 2, sum: 150 })
  })
  it('sin movimientos: cero', () => {
    expect(monthContributions(undefined, '2026-10')).toEqual({ count: 0, sum: 0 })
  })
})

describe('aporteHandoff', () => {
  it('lleva solo la suma, la moneda y la cantidad', () => {
    expect(aporteHandoff({ count: 2, sum: 150000 }, { currency: 'CLP' }, { rate: 950 }))
      .toEqual({ amount: 150000, ccy: 'CLP', n: 2, usd: 157.89 })
  })
  it('sin tasa no inventa los dólares', () => {
    expect(aporteHandoff({ count: 1, sum: 10 }, { currency: 'EUR' }, null)).toEqual({ amount: 10, ccy: 'EUR', n: 1, usd: null })
  })
  it('sin aportes no hay nada que pasar', () => {
    expect(aporteHandoff({ count: 0, sum: 0 }, {}, null)).toBeNull()
  })
})
