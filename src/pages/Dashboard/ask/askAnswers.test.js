import { describe, it, expect } from 'vitest'
import { answerSpent, answerTop, answerCompare, answerPerDay, answerFor, ASK_QUESTIONS } from './askAnswers.js'

const kpis = {
  cur: { totalInc: 4700000, totalExp: 2160800, expCount: 42, incCount: 2, freeFlow: 1941400, leftReal: 2539200 },
  prev: { totalInc: 4600000, totalExp: 3900000, incCount: 2, expCount: 60, freeFlow: 700000 },
  prevToDate: { totalInc: 4600000, totalExp: 2500000, incCount: 2, expCount: 50, freeFlow: 2100000 },
  prevCutDay: 24,
}

describe('preguntas rápidas (reglas fijas, en el teléfono)', () => {
  it('hay cuatro preguntas y answerFor responde cada una', () => {
    expect(ASK_QUESTIONS).toEqual(['spent', 'top', 'compare', 'perDay'])
    for (const id of ASK_QUESTIONS) expect(answerFor(id, { kpis, monthExpenses: [], activeMonth: '2026-11', today: new Date(2026, 10, 24) })).not.toBe(null)
    expect(answerFor('otra', {})).toBe(null)
  })

  it('gasto del mes: las cifras del Inicio, sin recalcular', () => {
    const a = answerSpent({ kpis })
    expect(a.spent).toBe(2160800)
    expect(a.count).toBe(42)
    expect(a.share).toBeCloseTo(2160800 / 4700000)
    expect(answerSpent({ kpis: { cur: { totalExp: 10, totalInc: 0 } } }).share).toBe(null)
  })

  it('top de categorías: ordena por monto, ignora inversión y montos vacíos, cuenta las que sobran', () => {
    const ex = [
      { category: 'Comida', amount: 300 }, { category: 'Transporte', amount: 100 }, { category: 'Comida', amount: 200 },
      { category: 'Ocio', amount: 50 }, { category: 'Casa', amount: 40 }, { category: 'Salud', amount: 30 }, { category: 'Ropa', amount: 20 },
      { category: 'Acciones', amount: 9999, inv: true }, { category: 'Nada', amount: 0 }, null,
    ]
    const a = answerTop({ monthExpenses: ex })
    expect(a.total).toBe(740)
    expect(a.rows.map(r => r.category)).toEqual(['Comida', 'Transporte', 'Ocio', 'Casa', 'Salud'])
    expect(a.rows[0].share).toBeCloseTo(500 / 740)
    expect(a.more).toBe(1)
  })

  it('comparación: contra el mes anterior cortado al mismo día', () => {
    const a = answerCompare({ kpis })
    expect(a.cutDay).toBe(24)
    expect(a.hasPrev).toBe(true)
    expect(a.spent).toEqual({ cur: 2160800, prev: 2500000, diff: -339200 })
    expect(a.left.cur).toBe(2539200)
    expect(answerCompare({ kpis: { cur: {}, prev: {} } }).hasPrev).toBe(false)
  })

  it('por día: "Te queda" entre los días que faltan, hoy incluido (budgetPace)', () => {
    const a = answerPerDay({ kpis, activeMonth: '2026-11', today: new Date(2026, 10, 24) })
    expect(a.daysLeft).toBe(7)
    expect(a.perDay).toBeCloseTo(1941400 / 7)
    expect(a.closed).toBe(false)
    const past = answerPerDay({ kpis, activeMonth: '2026-10', today: new Date(2026, 10, 24) })
    expect(past.closed).toBe(true)
    const neg = answerPerDay({ kpis: { cur: { freeFlow: -500 } }, activeMonth: '2026-11', today: new Date(2026, 10, 24) })
    expect(neg.short).toBe(true)
    expect(neg.perDay).toBe(0)
  })
})
