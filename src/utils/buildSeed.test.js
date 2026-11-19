// "Cargar datos de ejemplo" (onboarding) y Ajustes › cargar demo: los datos
// tienen que caer en el mes actual, no en mayo de 2025 (Inicio en $0).
import { describe, it, expect } from 'vitest'
import { buildSeed, SEED_EXPENSES, SEED_INCOMES } from './index.js'

describe('buildSeed', () => {
  const now = new Date(2026, 10, 19) // 19-nov-2026
  const s = buildSeed(now)
  it('pone ingresos y gastos en el mes actual, sin fechas futuras', () => {
    for (const r of [...s.incomes, ...s.expenses]) {
      expect(r.date.startsWith('2026-11')).toBe(true)
      expect(r.date <= '2026-11-19').toBe(true)
    }
    expect(s.expenses.map(r => r.date)).toEqual(['2026-11-01', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'])
    expect(s.incomes.map(r => r.date)).toEqual(['2026-11-01', '2026-11-15', '2026-11-19'])
  })
  it('corre metas y vencimientos los mismos meses (ninguna meta vencida)', () => {
    expect(s.goals.map(g => g.targetDate)).toEqual(['2027-06-30', '2027-09-01', '2028-12-01'])
    expect(s.debts.map(d => d.dueDate)).toEqual(['2026-12-15', '2027-01-05'])
  })
  it('ids nuevos y no toca las constantes', () => {
    expect(new Set(s.expenses.map(r => r.id)).size).toBe(SEED_EXPENSES.length)
    expect(SEED_INCOMES[0].date).toBe('2025-05-01')
  })
  it('a principio de mes no deja nada en el futuro', () => {
    const e = buildSeed(new Date(2026, 0, 2))
    expect(e.expenses.every(r => r.date <= '2026-01-02')).toBe(true)
  })
})
