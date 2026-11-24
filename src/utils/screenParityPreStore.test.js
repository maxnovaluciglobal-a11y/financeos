// Paridad entre pantallas — QA pre-tiendas (23-nov-2026, auditoría
// 2026-11-23-revision-pre-tiendas/30-qa-funcional.md). Cada bloque fija una
// cifra que antes salía distinta (o con otro signo) según la pantalla.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { fmtSignedMoney, setMoneyLocale } from './index.js'
import { calcNetWorth } from './netWorth.js'
import { withInvest } from './investNetWorth.js'

const src = (rel) => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8')

describe('B3: patrimonio neto con su signo y una sola cifra', () => {
  it('activos 4.520 − pasivos 27.321,95 da −22.801,95 (nunca positivo)', () => {
    setMoneyLocale('USD', 'en')
    const nw = calcNetWorth({ goals: [{ saved: 4520 }], debts: [{ id: 1, balance: 27321.95 }], incomes: [], expenses: [], settings: {} })
    expect(nw.netWorth).toBeCloseTo(-22801.95, 2)
    expect(fmtSignedMoney(nw.netWorth, '$')).toBe('−$22,801.95')
    // Con Inversiones (12.500) es −10.301,95, la cifra de la página Patrimonio.
    const all = withInvest(nw, { amount: 12500, usd: 12500 })
    expect(fmtSignedMoney(all.netWorth, '$')).toBe('−$10,301.95')
  })

  it('toda pantalla con patrimonio usa useNetWorth (no su propio calcNetWorth)', () => {
    for (const f of ['pages/NetWorth/index.jsx', 'pages/Advisor/index.jsx', 'pages/Reports/index.jsx', 'pages/Panorama/AnalysisGrid.jsx']) {
      const s = src(f)
      expect(s, f).toContain("from '../../hooks/useNetWorth.js'")
      expect(s, f).not.toMatch(/calcNetWorth\(/)
    }
  })

  it('Modo Asesor y su PDF formatean el patrimonio con signo', () => {
    expect(src('pages/Advisor/index.jsx')).toContain('fmtSignedMoney(nw.netWorth')
    expect(src('pages/Advisor/ReportePDF.jsx')).toContain('fmtSignedMoney(netWorth.netWorth')
    expect(src('pages/Reports/ReportPDF.jsx')).toMatch(/const fmt = \(n, sym = '\$'\) => fmtSignedMoney/)
  })
})

describe('I1/I2: Inversiones del demo, una sola cifra y un solo "Pusiste"', async () => {
  const { buildDemoInvestSnapshot } = await import('../demo/demoInvestSnapshot.js')
  const { createSampleMarketApi, createDemoMarketApi } = await import('../demo/demoMarketApi.js')
  const { demoInvestHoldings, demoInvestOps } = await import('../demo/demoInvestBook.js')
  const { demoOperations, demoHoldings } = await import('../demo/demoInvestHoy.js')
  const { positionRows } = await import('./investPositions.js')
  const { book } = await import('./investLedger.js')
  const { cashBook } = await import('./investCash.js')
  const { investValueForUser } = await import('./investNetWorth.js')

  // Una API "real" con precios distintos de los de ejemplo y tasa COP 3.526:
  // Panorama/Patrimonio tienen que dar lo mismo que la pantalla de Inversiones.
  const PRICES = { VOO: 612.5, AAPL: 271.3, MSFT: 402.1, 'BTC-USD': 91234 }
  const live = {
    quotes: async (l) => Object.fromEntries(l.filter(t => PRICES[t]).map(t => [t, { ticker: t, price: PRICES[t], currency: 'USD', changePct: 0.01 }])),
    crypto: async (l) => Object.fromEntries(l.filter(t => PRICES[t]).map(t => [t, { ticker: t, price: PRICES[t], currency: 'USD', changePct: 0.01 }])),
    fxLatam: async () => ({ rates: { COP: 3526, CLP: 940 }, sources: { COP: 'live', CLP: 'live' }, updatedAt: '2026-11-23T12:00:00Z' }),
  }

  it('el total de Panorama/Patrimonio = la suma de Portafolio, a precios y tasa reales', async () => {
    const api = createDemoMarketApi({ live: { ...createSampleMarketApi(), ...live }, sample: createSampleMarketApi() })
    const snap = await buildDemoInvestSnapshot({ api, now: Date.parse('2026-11-23T15:00:00Z') })
    const rows = positionRows(demoInvestHoldings(), await live.quotes(['VOO', 'AAPL', 'MSFT']).then(async q => ({ ...q, ...(await live.crypto(['BTC-USD'])) })), {})
    const sum = rows.rows ? rows.totals.value : rows.reduce((a, r) => a + (r.valueUsd || 0), 0)
    expect(snap.valueUsd).toBeCloseTo(sum, 2)
    expect(snap.valueUsd).not.toBeCloseTo(12500, 0)
    // Mismo tipo de cambio que Inversiones (3.526), no el fijo de moyiq (4.100).
    const inv = investValueForUser(snap, { currency: 'COP' }, () => null)
    expect(inv.amount).toBeCloseTo(sum * 3526, 0)
  })

  it('sin red, todo de ejemplo y rotulado (nunca mezcla)', async () => {
    const dead = { quotes: async () => ({}), crypto: async () => ({}), fxLatam: async () => null }
    const api = createDemoMarketApi({ live: { ...createSampleMarketApi(), ...dead }, sample: createSampleMarketApi() })
    const snap = await buildDemoInvestSnapshot({ api })
    expect(snap.sample).toBe(true)
    expect(snap.valueUsd).toBeCloseTo(12500, 2)
  })

  it('Resumen (Hoy) y Portafolio usan el mismo libro: mismo "Pusiste"', () => {
    const opts = { ccyOf: () => 'USD', priceOf: () => 100, toUsd: (v) => v }
    const hoy = cashBook(demoOperations(), demoHoldings(), opts)
    const port = book(demoInvestOps(), demoInvestHoldings(), opts)
    expect(hoy.contributed).toBeCloseTo(port.contributed, 6)
    expect(hoy.contributed).toBeCloseTo(12000, 6)
    expect(hoy.cash).toBeCloseTo(port.cash, 6)
  })
})

describe('I3/I4: una tasa de ahorro y un IQ Score para el mismo mes', async () => {
  const { homeMonthTotals } = await import('../pages/Dashboard/dashboardModel.js')
  const { calcCoachMetrics } = await import('../data/coachRules.js')
  const { monthSavingRate } = await import('./monthLeft.js')
  const MONTH = '2026-11'
  const d = (day) => `${MONTH}-${String(day).padStart(2, '0')}`

  it('Inicio/Panorama = Diagnóstico = Reportes/Asesor (monthSavingRate), también a mitad de mes', () => {
    let seed = 3
    const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    for (let i = 0; i < 500; i++) {
      const incomes = [{ date: d(1), amount: 1000 + Math.round(r() * 400000) / 100 }]
      const expenses = Array.from({ length: 1 + Math.floor(r() * 20) }, (_, j) => ({ date: d(1 + Math.floor(r() * 22)), amount: Math.round(r() * 30000) / 100, category: 'Ocio', id: `e${j}` }))
      // Un mes anterior completo: la proyección (FIN-2) daría otra cifra.
      expenses.push({ date: '2026-10-05', amount: 3000, category: 'Ocio', id: 'old' })
      incomes.push({ date: '2026-10-01', amount: 2500 })
      const home = homeMonthTotals({ incomes, expenses, activeMonth: MONTH, now: new Date(2026, 10, 22, 12) }).cur.savingRate
      const coach = calcCoachMetrics({ incomes, expenses, budgets: [], debts: [], goals: [], subs: [], settings: { activeMonth: MONTH } }).savingsRate
      const shared = monthSavingRate({ incomes, expenses, month: MONTH })
      expect(coach).toBeCloseTo(home, 10)
      expect(shared).toBeCloseTo(home, 10)
    }
  })

  it('Diagnóstico y Modo Asesor muestran el IQ Score (useIqScore), no un puntaje propio', () => {
    for (const f of ['pages/Coach/index.jsx', 'pages/Advisor/index.jsx', 'pages/Dashboard/useHomeData.jsx']) {
      expect(src(f), f).toContain('useIqScore()')
      expect(src(f), f).not.toMatch(/calcFinancialScore\(/)
    }
    expect(src('pages/Coach/index.jsx')).not.toMatch(/100 - warnings\.length/)
    expect(src('pages/Advisor/index.jsx')).not.toMatch(/scoreMap/)
    for (const f of ['pages/Advisor/index.jsx', 'pages/Reports/index.jsx']) expect(src(f), f).toContain('monthSavingRate(')
  })
})
