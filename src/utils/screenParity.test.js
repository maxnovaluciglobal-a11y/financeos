// Paridad entre pantallas (auditoría 360, G2-N1): la misma entrada da la misma
// cifra y el mismo veredicto en Inicio, Panorama, Presupuestos, Reportes, el
// Asesor y el IQ Score. Llama a las funciones reales que usa cada pantalla (no
// copias de la fórmula), con un generador con semilla para que sea
// reproducible. Si alguien vuelve a calcular una cifra por su cuenta en una
// pantalla, este archivo es la red que lo detecta.
import { describe, it, expect } from 'vitest'
import { homeMonthTotals, budgetRows } from '../pages/Dashboard/dashboardModel.js'
import { dailyAvailable, paceToday } from './dailyAvailable.js'
import { paceConclusion, paceReference, paceSeries } from './monthReading.js'
import { budgetStatus, budgetUsage, countBudgetsExceeded, effectiveBudgetLimits } from './budgets.js'
import { projectEndOfMonth } from './projection.js'
import { cumulativeByDay } from './chartSeries.js'
import { calcFinancialScore } from './financialScore.js'
import { monthDebtLoad } from './personal.js'
import { reportOverBudget } from '../pages/Reports/reportsModel.js'
import { COACH_CONFIG } from '../data/coachRules.js'

function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
const MONTH = '2026-11'
const d = (day) => `${MONTH}-${String(day).padStart(2, '0')}`
const cents = (r, max) => Math.round(r() * max * 100) / 100
const CATS = ['Alimentación', 'Transporte', 'Ocio', 'Salud']
const CASES = 2000

describe('paridad entre pantallas: cifras clave del mes', () => {
  it('excedidos: Inicio = Presupuestos = Asesor = Reportes = tarjeta del Inicio (también con el límite exacto)', () => {
    const r = rng(1)
    for (let i = 0; i < CASES; i++) {
      const budgets = CATS.map(c => ({ id: c, category: c, limit: 0 }))
      const expenses = []
      for (const b of budgets) {
        const k = 1 + Math.floor(r() * 4); let sum = 0
        for (let j = 0; j < k; j++) { const a = cents(r, 120); sum += a; expenses.push({ date: d(1 + j), category: b.category, amount: a }) }
        b.limit = r() < 0.5 ? Math.round(sum * 100) / 100 : cents(r, 300)   // la mitad, límite EXACTO
      }
      const limits = effectiveBudgetLimits({ budgets, expenses, activeMonth: MONTH, settings: {} })
      const expByCat = {}
      for (const e of expenses) expByCat[e.category] = (expByCat[e.category] || 0) + e.amount
      const inicio = budgetRows({ budgets, monthExpenses: expenses, limits }).filter(x => x.state === 'over').length
      const presupuestos = budgets.filter(b => budgetStatus(expByCat[b.category] || 0, limits[b.category]).over).length
      const asesor = countBudgetsExceeded({ budgets, expenses, activeMonth: MONTH, settings: {} })
      const reportes = reportOverBudget({ budgets, expByCat, limits }).length
      const tarjeta = budgetUsage({ budgets, expenses, activeMonth: MONTH, settings: {} }).overCount
      expect([inicio, asesor, reportes, tarjeta]).toEqual([presupuestos, presupuestos, presupuestos, presupuestos])
    }
  })

  it('% de presupuesto usado: tarjeta del Inicio = anillo de Presupuestos (Σ gastado / Σ límites efectivos)', () => {
    const r = rng(5)
    for (let i = 0; i < CASES; i++) {
      const budgets = CATS.slice(0, 1 + Math.floor(r() * 4)).map(c => ({ category: c, limit: 50 + cents(r, 300) }))
      const expenses = CATS.flatMap(c => Array.from({ length: Math.floor(r() * 4) }, (_, j) => ({ date: d(1 + j), category: c, amount: cents(r, 150) })))
      const limits = effectiveBudgetLimits({ budgets, expenses, activeMonth: MONTH, settings: {} })
      const budgeted = new Set(budgets.map(b => b.category))
      const ringPct = expenses.filter(e => budgeted.has(e.category)).reduce((s, e) => s + e.amount, 0) / budgets.reduce((s, b) => s + limits[b.category], 0)
      const u = budgetUsage({ budgets, expenses, activeMonth: MONTH, settings: {} })
      expect(u.pct).toBeCloseTo(ringPct, 6)
      if (u.overCount > 0) expect(u.level).toBe('risk')
    }
  })

  it('ritmo: la píldora de la Lupa y Panorama dan el mismo veredicto (con gastos de fecha futura)', () => {
    const r = rng(2)
    for (let i = 0; i < CASES; i++) {
      const today = 4 + Math.floor(r() * 24)
      const now = new Date(2026, 10, today, 12)
      const income = 1000 + cents(r, 4000)
      const incomes = [{ date: d(1), amount: income }]
      const k = 3 + Math.floor(r() * 25)
      const expenses = Array.from({ length: k }, (_, j) => ({ date: d(1 + Math.floor(r() * today)), amount: cents(r, income * 1.6 / k), category: CATS[j % 4] }))
      if (r() < 0.3) expenses.push({ date: d(Math.min(30, today + 1 + Math.floor(r() * 5))), amount: cents(r, income * 0.2), category: 'Salud' })
      const kp = homeMonthTotals({ incomes, expenses, activeMonth: MONTH, now })
      const lupa = paceToday(dailyAvailable({ incomes, expenses, activeMonth: MONTH, now, income: kp.cur.totalInc }))
      const ref = paceReference({ income: kp.cur.totalInc, prevExpenses: kp.prev.totalExp })
      const pano = paceConclusion(paceSeries(cumulativeByDay(expenses, MONTH, now, { futureToToday: true }), ref.value))
      expect(pano.key === 'reading.title.pace.even').toBe(lupa.even)
      expect(pano.key !== 'reading.title.pace.over').toBe(lupa.level === 'ok')
    }
  })

  it('"Te queda" es la misma cifra que el disponible de la Lupa y un mes cuadrado al centavo da 0', () => {
    const r = rng(9)
    for (let i = 0; i < CASES; i++) {
      const parts = Array.from({ length: 2 + Math.floor(r() * 6) }, () => cents(r, 90))
      const tot = Math.round(parts.reduce((s, x) => s + x, 0) * 100) / 100
      const now = new Date(2026, 10, 10, 12)
      const incomes = [{ date: d(1), amount: tot }]
      const expenses = parts.map((a, j) => ({ date: d(2 + (j % 7)), amount: a }))
      const kp = homeMonthTotals({ incomes, expenses, activeMonth: MONTH, now })
      const sr = dailyAvailable({ incomes, expenses, activeMonth: MONTH, now, income: kp.cur.totalInc })
      expect(kp.cur.freeFlow).toBe(0)
      expect(sr.avail[sr.lastDay]).toBe(kp.cur.freeFlow)
    }
  })

  it('proyección: la Lupa dibuja la misma cifra que la tarjeta Proyección', () => {
    const r = rng(10)
    for (let i = 0; i < 500; i++) {
      const today = 1 + Math.floor(r() * 28)
      const now = new Date(2026, 10, today, 12)
      const incomes = [{ date: d(1), amount: 2000 }]
      const expenses = [{ date: d(1), amount: cents(r, 1200), recurringId: 'r-rent' },
        ...Array.from({ length: Math.floor(r() * 20) }, () => ({ date: d(1 + Math.floor(r() * today)), amount: cents(r, 80) }))]
      const pending = { income: 0, expense: cents(r, 300), count: 1 }
      const sr = dailyAvailable({ incomes, expenses, activeMonth: MONTH, now, income: 2000, pending })
      const p = projectEndOfMonth({ incomes, expenses, activeMonth: MONTH, now, pending })
      if (sr.projEnd != null) expect(sr.projEnd).toBe(Math.max(sr.spentCum[sr.lastDay], p.projExp))
    }
  })

  it('carga de deuda: el Asesor y el IQ Score usan la misma base (también antes del cobro)', () => {
    const now = new Date(2026, 10, 3, 12).getTime()
    const r = rng(7)
    const { debtLoadWarn, debtLoadHigh } = COACH_CONFIG.thresholds
    for (let i = 0; i < 300; i++) {
      const incomes = r() < 0.5 ? [] : [{ date: d(1), amount: 500 + cents(r, 3000) }]
      const expenses = [{ date: d(2), amount: cents(r, 400) }]
      const debts = [{ id: 1, balance: 5000, minPayment: 50 + cents(r, 600), rate: 20 }]
      const pending = { count: 1, income: r() < 0.7 ? 2500 : 0, expense: 300 }
      const score = calcFinancialScore({ savingRate: 0, expenses, debts, goals: [], incomes, activeMonth: MONTH, syncEnabled: false, now, pending })
      const asesor = monthDebtLoad({ debts, incomes, expenses, activeMonth: MONTH, pending, now })
      const pts = asesor.totalDebt === 0 ? 20 : asesor.ratio <= debtLoadWarn ? 15 : asesor.ratio <= debtLoadHigh ? 10 : 0
      expect(score.breakdown.find(b => b.key === 'debtLoad').pts).toBe(pts)
    }
  })

  it('G2-N5: el día 3, con el sueldo previsto, el Asesor no marca la carga al 100 %', () => {
    const now = new Date(2026, 10, 3, 12).getTime()
    const debts = [{ id: 1, balance: 5000, minPayment: 300, rate: 20 }]
    const load = monthDebtLoad({ debts, incomes: [], expenses: [{ date: d(2), amount: 100 }], activeMonth: MONTH, pending: { count: 1, income: 2500, expense: 300 }, now })
    expect(load.ratio).toBeCloseTo(0.12, 6)
  })
})
