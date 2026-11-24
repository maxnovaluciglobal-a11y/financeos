// I-22 / UX-N1: en el demo, el veredicto del mes (utils/monthPace.js, el que
// comparten el Inicio y Panorama) acompaña al escenario. En la segunda mitad
// del mes, ya cobrado todo, el mes bueno va a buen ritmo y el difícil no; el
// veredicto nunca dice "vas bien" con "Te queda" en negativo.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildDemoState, DEMO_PERSONAS } from './demoData.js'
import { monthPlan } from '../utils/recurring.js'
import { homeMonthTotals } from '../pages/Dashboard/dashboardModel.js'
import { monthPace } from '../utils/monthPace.js'
import { currentMonth, localDateStr } from '../utils/index.js'

function verdictOf(id, scenario) {
  const st = buildDemoState(id, 'es', scenario)
  const M = currentMonth()
  const personal = (rows) => rows.filter(r => !r.inv)
  const plan = monthPlan(st.recurring || [], M, { incomes: st.incomes, expenses: st.expenses, today: localDateStr() })
  const kp = homeMonthTotals({ incomes: personal(st.incomes), expenses: personal(st.expenses), activeMonth: M, plan })
  return { v: monthPace(kp.cur, M), left: kp.cur.freeFlow }
}

describe.each(Object.keys(DEMO_PERSONAS))('demo %s: veredicto del mes', (id) => {
  afterEach(() => vi.useRealTimers())
  for (const dd of [23, 28]) {
    it(`día ${dd}: mes bueno a buen ritmo, mes difícil "te pasaste"`, () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 10, dd, 12))
      const good = verdictOf(id, 'exitoso')
      const hard = verdictOf(id, 'dificil')
      expect(good.v.level).toBe('ok')
      expect(good.left).toBeGreaterThan(0)
      expect(hard.v.level).toBe('risk')
      expect(hard.left).toBeLessThan(0)
    })
  }
})
