import { describe, it, expect } from 'vitest'
import { annualIncomeEstimate } from './annualIncome.js'

describe('annualIncomeEstimate (QA pre-tiendas I9)', () => {
  it('seis meses cargados: promedio × 12, no la suma del año', () => {
    const incomes = ['06', '07', '08', '09', '10', '11'].map(m => ({ date: `2026-${m}-15`, amount: 26863.2 / 6 }))
    const r = annualIncomeEstimate(incomes, '2026-11')
    expect(r.months).toBe(6)
    expect(r.amount).toBe(Math.round(26863.2 * 2))
  })
  it('doce meses o más: la suma de los 12 que terminan en el mes activo (cruza el año)', () => {
    const incomes = Array.from({ length: 18 }, (_, i) => { const d = new Date(2025, 5 + i, 1); return { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, amount: 1000 + i } })
    const r = annualIncomeEstimate(incomes, '2026-11')
    expect(r.months).toBe(12)
    expect(r.amount).toBe(Array.from({ length: 12 }, (_, i) => 1006 + i).reduce((a, b) => a + b, 0))
  })
  it('sin ingresos de inversión ni meses futuros', () => {
    const r = annualIncomeEstimate([{ date: '2026-11-01', amount: 100 }, { date: '2026-11-02', amount: 900, inv: true }, { date: '2026-12-01', amount: 5000 }], '2026-11')
    expect(r).toEqual({ amount: 1200, months: 1 })
  })
})
