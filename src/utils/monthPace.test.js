// I-22 (benchmark/05-coherencia-360; UX-N1): un solo veredicto del mes,
// contra el ingreso y con la misma cuenta que "Te queda".
import { describe, it, expect } from 'vitest'
import { paceVerdict, monthPace, paceDays, PACE_OK } from './monthPace.js'
import { monthLeft } from './monthLeft.js'
import { monthPlan } from './recurring.js'
import { homeMonthTotals } from '../pages/Dashboard/dashboardModel.js'
import { dailyAvailable, paceToday } from './dailyAvailable.js'
import { monthReading } from './monthReading.js'

const M = '2026-11'
const NOW = new Date(2026, 10, 10, 12)   // día 10 de 30: un tercio del mes
const at = (v) => paceVerdict({ today: 10, days: 30, ...v })

describe('paceVerdict', () => {
  it('sin fijos ni apartado es la cuenta de siempre: gastado/ingreso contra día/días', () => {
    const v = at({ income: 3000, spent: 1000 })
    expect(v.pool).toBe(3000)
    expect(v.over).toBeCloseTo(0, 6)
    expect(v.level).toBe('ok')
    expect(v.even).toBe(true)
    expect(at({ income: 3000, spent: 1100 }).level).toBe('attention')   // +3,3 puntos
    expect(at({ income: 3000, spent: 1400 }).level).toBe('risk')        // +13,3 puntos
  })
  it('el arriendo pagado el día 1 no es "gasto rápido": los fijos se reservan enteros', () => {
    // Ingreso 3.000; arriendo 1.200 pagado; 600 variables al día 10.
    const v = at({ income: 3000, spent: 1800, fixedPaid: 1200 })
    expect(v.pool).toBe(1800)
    expect(v.used).toBe(600)
    expect(v.level).toBe('ok')
    // Antes (gastado/ingreso) daba 60 % contra 33 %: "muy rápido".
    expect(1800 / 3000 - 10 / 30).toBeGreaterThan(0.10)
  })
  it('los fijos por pagar y lo apartado achican lo disponible', () => {
    expect(at({ income: 3000, spent: 600 }).level).toBe('ok')
    expect(at({ income: 3000, spent: 600, pendingFixed: 900, setAside: 300 }).level).toBe('ok')   // 600/1800 = 33,3 %: justo al ritmo
    const v = at({ income: 3000, spent: 700, pendingFixed: 900, setAside: 300 })
    expect(v.pool).toBe(1800)
    expect(v.level).toBe('attention')   // 38,9 % contra 33,3 %
  })
  it('"te queda" en negativo es siempre "te pasaste", aunque sea por los fijos que faltan', () => {
    const v = at({ income: 1000, spent: 100, pendingFixed: 950 })
    expect(v.left).toBe(-50)
    expect(v.level).toBe('risk')
    expect(v.even).toBe(false)
  })
  it('sin ingreso y con gasto: te pasaste; sin nada: no hay veredicto; mes futuro: tampoco', () => {
    expect(at({ income: 0, spent: 50 }).level).toBe('risk')
    expect(at({})).toBeNull()
    expect(paceVerdict({ income: 10, spent: 1, today: 0, days: 30, mode: 'future' })).toBeNull()
  })
  it('gap = lo que se podía gastar a hoy − lo gastado fuera de los fijos', () => {
    expect(at({ income: 3000, spent: 1800, fixedPaid: 1200 }).gap).toBe(0)
    expect(at({ income: 3000, spent: 500 }).gap).toBe(500)
  })
  it('tolerancia de "parejo": 2 puntos', () => {
    expect(PACE_OK).toBe(0.02)
    expect(at({ income: 3000, spent: 1059 }).level).toBe('ok')         // +1,97
    expect(at({ income: 3000, spent: 1061 }).level).toBe('attention')  // +2,03
  })
})

describe('monthPace usa los totales de "Te queda"', () => {
  const rule = (id, day, amount) => ({ id, kind: 'expense', source: 'manual', description: id, category: 'Vivienda', amountMode: 'fixed',
    amounts: [{ from: '2026-01', amount }], schedule: { freq: 'monthly', day, anchorDate: `2026-01-${String(day).padStart(2, '0')}` },
    startDate: '2026-01-01', autoConfirm: false, paused: false, skipped: [] })
  const rules = [rule('r-rent', 1, 1200), rule('r-gym', 28, 60)]
  const incomes = [{ id: 'i', date: '2026-11-01', amount: 3000 }]
  const expenses = [
    { id: 'rent', date: '2026-11-01', amount: 1200, category: 'Vivienda', recurringId: 'r-rent', occurrenceDate: '2026-11-01' },
    { id: 'a', date: '2026-11-04', amount: 250, category: 'Ocio' },
    { id: 'b', date: '2026-11-09', amount: 300, category: 'Alimentación' },
  ]
  const setAsides = [{ id: 's', kind: 'setAside', dest: 'goal', amount: 200, date: '2026-11-05' }]
  const plan = monthPlan(rules, M, { incomes, expenses, today: '2026-11-10' })
  const kp = homeMonthTotals({ incomes, expenses, setAsides, activeMonth: M, now: NOW, plan })

  it('monthLeft separa los fijos ya pagados (vinculados) de los que faltan', () => {
    const m = monthLeft({ incomes, expenses, setAsides, month: M, plan, today: '2026-11-10' })
    expect(m.fixedPaid).toBe(1200)
    expect(m.pendingFixed).toBe(60)
    expect(kp.cur.fixedPaid).toBe(1200)
  })
  it('el "te queda" del veredicto es el del héroe, al centavo', () => {
    const v = monthPace(kp.cur, M, NOW)
    expect(v.left).toBe(kp.cur.freeFlow)
    expect(v.pool).toBe(3000 - 200 - 1200 - 60)
    expect(v.used).toBe(550)
  })
  it('Inicio (anillo y Lupa) y Panorama (frase del mes) dicen lo mismo', () => {
    const v = monthPace(kp.cur, M, NOW)
    const lupa = paceToday(dailyAvailable({ incomes, expenses, setAsides, activeMonth: M, now: NOW, income: kp.cur.totalInc, plan, pendingFixed: kp.cur.pendingFixed, fixedPaid: kp.cur.fixedPaid }))
    expect(lupa.level).toBe(v.level)
    expect(lupa.gap).toBe(v.gap)
    const reading = monthReading({ activeMonth: M, now: NOW, totals: { ...kp, cur: kp.cur }, expenses, rows: [] })
    const keys = reading.facts.map(f => f.key)
    expect(v.level).toBe('attention')    // 550/1540 = 35,7 % contra 33,3 %
    expect(keys).toContain('reading.pace.high')
    expect(keys).not.toContain('reading.pace.ok')
  })
  it('mes pasado: cuenta entero, sin fijos por pagar', () => {
    const pos = paceDays('2026-10', NOW)
    expect(pos).toEqual({ mode: 'past', today: 31, days: 31 })
    expect(monthPace({ totalInc: 100, totalExp: 90, setAside: 0, pendingFixed: 0, fixedPaid: 0 }, '2026-10', NOW).level).toBe('ok')
  })
})

// Presupuestos tiene su propio ritmo (gasto contra TUS presupuestos): su texto
// lo dice, para que no se lea como otro veredicto del mes (I-22).
import { es } from '../i18n/es.js'
import { en } from '../i18n/en.js'
import { pt } from '../i18n/pt.js'
import { de } from '../i18n/de.js'
describe('el ritmo de Presupuestos nombra su referencia', () => {
  const WORD = { es: /presupuesto/i, en: /budget/i, pt: /orçamento/i, de: /budget/i }
  for (const [lang, d] of Object.entries({ es, en, pt, de })) {
    it(lang, () => {
      for (const k of ['budgets.pace.ok', 'budgets.pace.fast', 'budgets.pace.perDay', 'budgets.pace.line', 'budgets.pace.lineClosed']) {
        expect(d[k], `${lang}:${k}`).toMatch(WORD[lang])
      }
    })
  }
})
