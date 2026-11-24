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
  it('fijos + apartado se llevan todo el ingreso, sin gasto variable: causa "fijos", sin ritmo (revisión, caso 1)', () => {
    // Ingreso 1.000; arriendo 800 pagado; 300 de fijos por pagar; día 10.
    const v = at({ income: 1000, spent: 800, fixedPaid: 800, pendingFixed: 300 })
    expect(v.pool).toBe(-100)
    expect(v.used).toBe(0)
    expect(v.fixedExceed).toBe(true)
    expect(v.ratio).toBe(Infinity)
    expect(v.cause).toBe('fixed')
    expect(v.level).toBe('attention')
  })
  it('fijos por pagar mayores que lo libre, gasto variable chico: "fijos", no "gasto muy rápido" (caso 2)', () => {
    const v = paceVerdict({ income: 1000, spent: 30, pendingFixed: 1100, today: 28, days: 30 })
    expect(v.left).toBe(-130)
    expect(v.cause).toBe('fixed')
    expect(v.level).toBe('attention')
  })
  it('si el gasto variable no cabía ni antes de los fijos por pagar, es gasto: "te pasaste"', () => {
    // Fijos 900 pagados + 300 por pagar; 200 variables, y antes de los por pagar solo quedaban 100 libres.
    const v = at({ income: 1000, spent: 1100, fixedPaid: 900, pendingFixed: 300 })
    expect(v.fixedExceed).toBe(true)
    expect(v.cause).toBe('spending')
    expect(v.level).toBe('risk')
    // Con disponible > 0 y "te queda" < 0, también es gasto.
    expect(at({ income: 1000, spent: 600, pendingFixed: 500 })).toMatchObject({ cause: 'spending', level: 'risk' })
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

describe('caso "fijos" igual en anillo, Lupa y frase del mes (Inicio y Panorama)', () => {
  const tOf = (d) => (k, vars = {}) => String(d[k] ?? k).replace(/\{(\w+)\}/g, (_, n) => vars[n] ?? '')
  const fmt = { money: (n) => `$${n}`, usd: (n) => `US$${n}`, pct: (n) => `${Math.round(n * 100)} %`, cat: (c) => c, month: (m) => m }
  const rule = (id, day, amount) => ({ id, kind: 'expense', source: 'manual', description: id, category: 'Vivienda', amountMode: 'fixed',
    amounts: [{ from: '2026-01', amount }], schedule: { freq: 'monthly', day, anchorDate: `2026-01-${String(day).padStart(2, '0')}` },
    startDate: '2026-01-01', autoConfirm: false, paused: false, skipped: [] })
  // Caso 1 de la revisión: ingreso 1.000, arriendo 800 pagado y vinculado, 300 por pagar, día 10.
  const incomes = [{ id: 'i', date: '2026-11-01', amount: 1000 }]
  const expenses = [
    { id: 'rent', date: '2026-11-01', amount: 800, category: 'Vivienda', recurringId: 'r-rent', occurrenceDate: '2026-11-01' },
  ]
  const plan = monthPlan([rule('r-rent', 1, 800), rule('r-gym', 28, 300)], M, { incomes, expenses, today: '2026-11-10' })
  const kp = homeMonthTotals({ incomes, expenses, activeMonth: M, now: NOW, plan })
  it('el anillo, la Lupa y la frase dicen "fijos", nunca "se gastó el 0 %" ni "$0 por día"', async () => {
    const { renderReading } = await import('./monthReading.js')
    const { paceLine } = await import('../pages/Dashboard/lupa/lupaText.js')
    const v = monthPace(kp.cur, M, NOW)
    expect(v.cause).toBe('fixed')
    const lupa = paceToday(dailyAvailable({ incomes, expenses, activeMonth: M, now: NOW, income: kp.cur.totalInc, plan, pendingFixed: kp.cur.pendingFixed, fixedPaid: kp.cur.fixedPaid }))
    expect(lupa).toMatchObject({ cause: 'fixed', level: 'attention' })
    expect(paceLine(lupa, { t: tOf(es), fmt: (n) => `$${n}` })).toEqual({ kind: 'fixed', text: 'Los fijos y lo apartado superan tu ingreso' })
    for (const country of ['CL', 'VE']) {
      const r = monthReading({ activeMonth: M, now: NOW, totals: kp, expenses, rows: [], country })
      const keys = r.facts.map(f => f.key)
      expect(keys).toContain('reading.fixedExceed')
      expect(keys).not.toContain('reading.pace.high')
      expect(keys).not.toContain('reading.pace.highAmount')
      expect(keys).not.toContain('reading.perDay')
      expect(r.facts.map(f => renderReading(f, { t: tOf(es), fmt })).join(' ')).not.toMatch(/ 0 %|\$0 por día/)
    }
  })
  it('los textos nuevos existen en los 4 idiomas, con la misma variable en el aria', () => {
    for (const d of [es, en, pt, de]) {
      for (const k of ['reading.fixedExceed', 'pulse.fixed', 'pulse.ariaFixed']) expect(typeof d[k], k).toBe('string')
      expect(d['pulse.ariaFixed']).toContain('{elapsed}')
      expect(d['pulse.ariaFixed']).not.toContain('{spent}')
    }
    expect(es['reading.fixedExceed']).toBe('Los fijos y lo apartado se llevan todo tu ingreso de este mes.')
  })
})
