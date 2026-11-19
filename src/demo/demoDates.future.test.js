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
