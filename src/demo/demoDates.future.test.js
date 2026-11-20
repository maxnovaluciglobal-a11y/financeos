import { describe, it, expect } from 'vitest'
import { onlyUntilToday, buildDemoState } from './demoData.js'

describe('demo sin movimientos futuros', () => {
  it('descarta filas con fecha posterior a hoy', () => {
    const today = new Date(2026, 10, 19)
    const rows = [{ date: '2026-11-19' }, { date: '2026-11-20' }, { date: '2026-10-30' }]
    expect(onlyUntilToday(rows, today).map(r => r.date)).toEqual(['2026-11-19', '2026-10-30'])
  })
  it('ninguna persona trae gastos o ingresos después de hoy', () => {
    const pad = (n) => String(n).padStart(2, '0')
    const t = new Date()
    const iso = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`
    for (const id of ['sofia', 'us', 'de', 've']) {
      const s = buildDemoState(id, 'es')
      for (const r of [...s.incomes, ...s.expenses]) expect(String(r.date).slice(0, 10) <= iso).toBe(true)
    }
  })
})

describe('FN-UX-1: cambiar de escenario no trae ingresos futuros', () => {
  it('scenarioIncomes filtra por hoy en los dos escenarios', async () => {
    const { scenarioIncomes, DEMO_PERSONAS } = await import('./demoData.js')
    const pad = (n) => String(n).padStart(2, '0')
    const t = new Date()
    const iso = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`
    for (const id of Object.keys(DEMO_PERSONAS)) {
      for (const sc of ['exitoso', 'dificil']) {
        for (const r of scenarioIncomes(id, sc)) expect(String(r.date).slice(0, 10) <= iso).toBe(true)
      }
    }
  })
  it('el reducer del demo (SET_SCENARIO) no deja ingresos posteriores a hoy', async () => {
    const { demoReducer } = await import('./DemoContext.jsx')
    const pad = (n) => String(n).padStart(2, '0')
    const t = new Date()
    const iso = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`
    for (const id of ['sofia', 'us', 'de', 've']) {
      let s = buildDemoState(id, 'es', 'exitoso')
      s = demoReducer(s, { type: 'SET_SCENARIO', scenario: 'dificil' })
      s = demoReducer(s, { type: 'SET_SCENARIO', scenario: 'exitoso' })
      for (const r of s.incomes) expect(String(r.date).slice(0, 10) <= iso).toBe(true)
    }
  })
  it('con una fecha fija, un ingreso del día 20 no aparece el 19', async () => {
    const { scenarioIncomes, DEMO_PERSONAS } = await import('./demoData.js')
    const today = new Date(2026, 10, 19)
    const all = DEMO_PERSONAS.us.incomesGood
    const kept = scenarioIncomes('us', 'exitoso', today)
    expect(kept.every(r => String(r.date).slice(0, 10) <= '2026-11-19')).toBe(true)
    expect(kept.length).toBeLessThanOrEqual(all.length)
  })
})
