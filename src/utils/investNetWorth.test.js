import { describe, it, expect } from 'vitest'
import { aporteHandoff, fmtUsd, investValueForUser, monthContributions, resolveUserRate, withInvest } from './investNetWorth.js'
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
  it('un apartado que llega en las dos listas cuenta una vez', () => {
    const inv = { id: 'sa1', kind: 'setAside', dest: 'invest', date: '2026-11-03', amount: 100 }
    expect(monthContributions([inv], '2026-11', [inv])).toEqual({ count: 1, sum: 100 })
    expect(monthContributions([inv], '2026-11')).toEqual({ count: 1, sum: 100 })
    expect(monthContributions([], '2026-11', [inv])).toEqual({ count: 1, sum: 100 })
  })
  it('un apartado a una meta no es aporte a Inversiones', () => {
    const goal = { id: 'sa2', kind: 'setAside', dest: 'goal', date: '2026-11-03', amount: 80 }
    expect(monthContributions([goal], '2026-11', [goal])).toEqual({ count: 0, sum: 0 })
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

describe('fmtUsd', () => {
  it('junto a otra moneda siempre dice US$, también en inglés', () => {
    expect(fmtUsd(12.5, 'COP')).toMatch(/^US\$12[.,]50$/)
    expect(fmtUsd(-3, 'CLP')).toMatch(/^US\$3/)
  })
})

// I-17 (benchmark/05-coherencia-360): metas y portafolio suman al mismo
// patrimonio; mientras no haya metas vinculadas (F9) se avisa.
import { portfolioInNetWorth, netWorthOverlapNote } from './investNetWorth.js'
import { demoInvestSnapshot } from '../demo/demoInvest.js'
import { buildDemoState } from '../demo/demoData.js'

describe('aviso de doble conteo metas + Inversiones (I-17)', () => {
  it('módulo apagado o sin acceso (inv null): no hay aviso', () => {
    expect(portfolioInNetWorth(null)).toBe(false)
    expect(portfolioInNetWorth(undefined)).toBe(false)
    expect(netWorthOverlapNote({ savedInGoals: 500 }, null)).toBe(false)
  })
  it('sin tasa con fecha el portafolio no suma al total: no hay aviso', () => {
    const inv = investValueForUser(snap, { currency: 'ARS' }, none)
    expect(inv.amount).toBeNull()
    expect(withInvest(calcNetWorth({ goals: [{ saved: 100 }] }), inv).investInTotal).toBe(false)
    expect(portfolioInNetWorth(inv)).toBe(false)
  })
  it('con el portafolio sumado al patrimonio: aviso en Metas y, si hay ahorro en metas, en Patrimonio', () => {
    const inv = investValueForUser(snap, { currency: 'CLP' }, none)
    expect(portfolioInNetWorth(inv)).toBe(true)
    const nw = withInvest(calcNetWorth({ goals: [{ saved: 100 }] }), inv)
    expect(nw.investInTotal).toBe(true)
    expect(netWorthOverlapNote(nw, inv)).toBe(true)
    expect(netWorthOverlapNote(withInvest(calcNetWorth({ goals: [] }), inv), inv)).toBe(false)
  })
  it('el aviso coincide con investInTotal de withInvest', () => {
    for (const settings of [{ currency: 'USD' }, { currency: 'CLP' }, { currency: 'ARS' }, { currency: '' }]) {
      const inv = investValueForUser(snap, settings, none)
      expect(portfolioInNetWorth(inv), JSON.stringify(settings)).toBe(withInvest(calcNetWorth({}), inv).investInTotal)
    }
  })
  it('demo US: la meta "Roth IRA" y el portafolio de ejemplo suman juntos, así que el aviso se ve', () => {
    const st = buildDemoState('us', 'en')
    const inv = investValueForUser(demoInvestSnapshot(), st.settings, none)
    const nw = withInvest(calcNetWorth({ goals: st.goals }), inv)
    expect(st.goals.some(g => /Roth IRA/.test(g.name) && g.saved > 0)).toBe(true)
    expect(netWorthOverlapNote(nw, inv)).toBe(true)
  })
})
