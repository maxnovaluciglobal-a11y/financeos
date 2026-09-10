// Cobertura de src/utils/financialScore.js — no existía ningún test antes de
// esta migración al modelo del brand book MOY IQ (Flujo de caja 30% / Colchón
// de emergencia 20% / Carga de deuda 20% / Progreso de metas 15% /
// Consistencia de datos 15%). Fija los 5 pesos exactos, cada escalón de cada
// factor, y los dos casos límite (score 100 y score 0) para que un cambio
// futuro de pesos o umbrales no pase desapercibido.
import { describe, it, expect } from 'vitest'
import { calcFinancialScore } from './financialScore.js'

const ACTIVE_MONTH = '2026-09'
const NOW = 1_700_000_000_000 // fijo, para que los tests de "antigüedad de sync" sean deterministas
const rawT = (key) => key // identidad: el label devuelto es la propia clave i18n

function baseInput(overrides = {}) {
  return {
    savingRate: 0,
    expenses: [],
    incomes: [],
    debts: [],
    goals: [],
    activeMonth: ACTIVE_MONTH,
    syncEnabled: false,
    lastSyncAt: null,
    now: NOW,
    ...overrides,
  }
}

describe('calcFinancialScore — estructura del modelo', () => {
  it('los 5 factores tienen exactamente los pesos del brand book (30/20/20/15/15) y suman 100', () => {
    const r = calcFinancialScore(baseInput(), rawT)
    expect(r.breakdown.map(b => b.max)).toEqual([30, 20, 20, 15, 15])
    expect(r.breakdown.reduce((s, b) => s + b.max, 0)).toBe(100)
  })

  it('cada entrada del breakdown usa la clave i18n del factor nuevo, en orden', () => {
    const r = calcFinancialScore(baseInput(), rawT)
    expect(r.breakdown.map(b => b.label)).toEqual([
      'score.cashFlow',
      'score.emergencyCushion',
      'score.debtLoad',
      'score.goalsProgress',
      'score.dataConsistency',
    ])
  })

  it('sin t explícito, cae al fallback en español (paridad con los otros 3 idiomas verificada aparte en translations.js)', () => {
    const r = calcFinancialScore(baseInput({ savingRate: 0.25 }))
    expect(r.breakdown[0].label).toBe('Flujo de caja')
    expect(r.breakdown[1].label).toBe('Colchón de emergencia')
    expect(r.breakdown[2].label).toBe('Carga de deuda')
    expect(r.breakdown[3].label).toBe('Progreso de metas')
    expect(r.breakdown[4].label).toBe('Consistencia de datos')
  })
})

describe('calcFinancialScore — casos límite', () => {
  it('score 100 cuando los 5 factores están al máximo', () => {
    const r = calcFinancialScore(baseInput({
      savingRate: 0.25, // ≥ savingsRateGood (0.20)
      expenses: [{ date: '2026-09-05', amount: 1000, category: 'Comida' }], // monthlyExpense=1000, 100% categorizado
      goals: [{ name: 'Fondo de emergencia', saved: 5000 }], // 5 meses ≥ emergencyFundMonthsGood (3), y con progreso
      debts: [],       // sin deuda personal
      incomes: [],
      syncEnabled: false, // local-only no penaliza
    }), rawT)
    expect(r.breakdown.map(b => b.pts)).toEqual([30, 20, 20, 15, 15])
    expect(r.score).toBe(100)
    expect(r.label).toBe('score.excellent')
    expect(r.color).toBe('var(--pos)')
  })

  it('score 0 cuando los 5 factores están al mínimo', () => {
    const r = calcFinancialScore(baseInput({
      savingRate: -0.3, // flujo de caja negativo
      expenses: [
        { date: '2026-09-05', amount: 100, category: 'Importado' },
        { date: '2026-09-06', amount: 100, category: 'Importado' },
      ], // 100% importado, sin categorizar
      goals: [], // sin metas → ni colchón ni progreso
      incomes: [{ date: '2026-09-01', amount: 0 }],
      debts: [{ balance: 5000 }], // ingreso $0 + deuda > 0 = ratio máximo (personalDebtRatio)
      syncEnabled: true,
      lastSyncAt: NOW - 30 * 86400000, // 30 días sin sincronizar
    }), rawT)
    expect(r.breakdown.map(b => b.pts)).toEqual([0, 0, 0, 0, 0])
    expect(r.score).toBe(0)
    expect(r.label).toBe('score.critical')
    expect(r.color).toBe('var(--red)')
  })
})

describe('calcFinancialScore — Flujo de caja (0-30)', () => {
  it.each([
    [0.25, 30], // ≥ savingsRateGood (0.20)
    [0.15, 20], // ≥ savingsRateWarn (0.10), < good
    [0.02, 10], // ≥ 0, < warn
    [0, 10],
    [-0.01, 0], // negativo
  ])('savingRate %f → %i pts', (savingRate, expected) => {
    const r = calcFinancialScore(baseInput({ savingRate }), rawT)
    expect(r.breakdown[0].pts).toBe(expected)
  })
})

describe('calcFinancialScore — Colchón de emergencia (0-20)', () => {
  const expenses = [{ date: '2026-09-05', amount: 1000, category: 'Comida' }] // monthlyExpense=1000

  it.each([
    [4000, 20], // 4 meses ≥ emergencyFundMonthsGood (3)
    [3000, 20], // exactamente 3 meses (borde inclusive)
    [1500, 10], // 1.5 meses ≥ emergencyFundMonthsWarn (1), < good
    [1000, 10], // exactamente 1 mes (borde inclusive)
    [300, 5],   // 0.3 meses, > 0 < warn
    [0, 0],     // meta existe pero sin progreso
  ])('meta "Fondo de emergencia" con saved=%i → %i pts', (saved, expected) => {
    const r = calcFinancialScore(baseInput({
      expenses, goals: [{ name: 'Fondo de emergencia', saved }],
    }), rawT)
    expect(r.breakdown[1].pts).toBe(expected)
  })

  it('sin ninguna meta → 0 pts', () => {
    const r = calcFinancialScore(baseInput({ expenses, goals: [] }), rawT)
    expect(r.breakdown[1].pts).toBe(0)
  })

  it('una meta con mucho ahorro pero que NO matchea el nombre de "emergencia" → 0 pts (no la confunde con progreso de metas)', () => {
    const r = calcFinancialScore(baseInput({
      expenses, goals: [{ name: 'Viaje a Europa', saved: 999999 }],
    }), rawT)
    expect(r.breakdown[1].pts).toBe(0)
  })

  it('detecta el nombre en inglés/portugués igual que Coach/Advisor/Goals ("emergency", "fundo")', () => {
    const en = calcFinancialScore(baseInput({ expenses, goals: [{ name: 'Emergency Fund', saved: 4000 }] }), rawT)
    const pt = calcFinancialScore(baseInput({ expenses, goals: [{ name: 'Fundo de emergência', saved: 4000 }] }), rawT)
    expect(en.breakdown[1].pts).toBe(20)
    expect(pt.breakdown[1].pts).toBe(20)
  })
})

describe('calcFinancialScore — Carga de deuda (0-20, sin cambios respecto al modelo anterior)', () => {
  const incomes = [{ date: '2026-09-01', amount: 1000 }] // monthlyIncome=1000 → annualIncome=12000

  it.each([
    [0, 20],     // sin deuda
    [1000, 15],  // ratio 0.083 < 0.20
    [3000, 10],  // ratio 0.25, entre 0.20 y 0.50
    [7000, 0],   // ratio 0.583 ≥ 0.50
  ])('balance de deuda %i (ingreso anual 12000) → %i pts', (balance, expected) => {
    const debts = balance > 0 ? [{ balance }] : []
    const r = calcFinancialScore(baseInput({ incomes, debts }), rawT)
    expect(r.breakdown[2].pts).toBe(expected)
  })
})

describe('calcFinancialScore — Progreso de metas (0-15)', () => {
  it('al menos una meta con progreso → 15 pts', () => {
    const r = calcFinancialScore(baseInput({ goals: [{ name: 'Viaje', saved: 100 }, { name: 'Auto', saved: 0 }] }), rawT)
    expect(r.breakdown[3].pts).toBe(15)
  })
  it('hay metas pero ninguna con progreso → 7 pts', () => {
    const r = calcFinancialScore(baseInput({ goals: [{ name: 'Viaje', saved: 0 }] }), rawT)
    expect(r.breakdown[3].pts).toBe(7)
  })
  it('sin metas → 0 pts', () => {
    const r = calcFinancialScore(baseInput({ goals: [] }), rawT)
    expect(r.breakdown[3].pts).toBe(0)
  })
})

describe('calcFinancialScore — Consistencia de datos (0-15): % categorizado (0-9) + antigüedad de sync (0-6)', () => {
  it('sin movimientos → ratio neutral (no castiga al usuario nuevo): 9 pts de categorización', () => {
    const r = calcFinancialScore(baseInput({ expenses: [], incomes: [], syncEnabled: false }), rawT)
    expect(r.breakdown[4].pts).toBe(9 + 6) // 100% categorizado (N/A) + sync no aplica
  })

  it.each([
    [0, 4, 9],  // 0/4 importado = 100% categorizado ≥ 0.95
    [2, 10, 6], // 2/10 importado = 80% ≥ 0.80
    [5, 10, 3], // 5/10 importado = 50% ≥ 0.50
    [6, 10, 0], // 6/10 importado = 40% < 0.50
  ])('%i de %i movimientos "Importado" → %i pts de categorización (sync desactivado, neutral)', (imported, total, expectedCatPts) => {
    const expenses = Array.from({ length: total }, (_, i) => ({
      date: '2026-09-01', amount: 10, category: i < imported ? 'Importado' : 'Comida',
    }))
    const r = calcFinancialScore(baseInput({ expenses, incomes: [], syncEnabled: false }), rawT)
    expect(r.breakdown[4].pts).toBe(expectedCatPts + 6) // sync desactivado = 6 pts neutrales
  })

  it('sync desactivado (local-only, DNA privacy-first): no se penaliza, suma el máximo (6 pts) aunque nunca haya sincronizado', () => {
    const r = calcFinancialScore(baseInput({ syncEnabled: false, lastSyncAt: null }), rawT)
    expect(r.breakdown[4].pts).toBe(9 + 6)
  })

  it('sync activado pero nunca corrió → 0 pts de esa mitad (dato realmente desactualizado)', () => {
    const r = calcFinancialScore(baseInput({ syncEnabled: true, lastSyncAt: null }), rawT)
    expect(r.breakdown[4].pts).toBe(9 + 0)
  })

  it.each([
    [12 * 3600 * 1000, 6],       // hace 12 horas
    [24 * 3600 * 1000, 6],       // exactamente 1 día (borde inclusive)
    [5 * 86400000, 3],           // hace 5 días
    [7 * 86400000, 3],           // exactamente 7 días (borde inclusive)
    [10 * 86400000, 0],          // hace 10 días
  ])('sync activado, último sync hace %i ms → %i pts de esa mitad', (ageMs, expectedSyncPts) => {
    const r = calcFinancialScore(baseInput({ syncEnabled: true, lastSyncAt: NOW - ageMs }), rawT)
    expect(r.breakdown[4].pts).toBe(9 + expectedSyncPts)
  })
})

describe('calcFinancialScore — etiqueta y color según score total', () => {
  it('score 80 (borde inclusive) → excelente', () => {
    // 30 (flujo) + 0 (colchón, sin meta) + 20 (deuda, sin deuda) + 15 (metas, con progreso) + 15 (datos, todo al día) = 80
    const r = calcFinancialScore(baseInput({
      savingRate: 0.25,
      goals: [{ name: 'Viaje', saved: 100 }],
    }), rawT)
    expect(r.score).toBe(80)
    expect(r.label).toBe('score.excellent')
    expect(r.color).toBe('var(--pos)')
  })

  it('score 60 (borde inclusive) → bueno', () => {
    // 30 (flujo) + 0 (colchón, meta de emergencia sin progreso) + 15 (deuda, ratio<0.20)
    // + 15 (metas, con progreso vía una meta NO-emergencia) + 0 (datos, <50% categorizado
    // sobre expenses+incomes combinados, y sync viejo) = 60
    const r = calcFinancialScore(baseInput({
      savingRate: 0.25,
      goals: [{ name: 'Fondo de emergencia', saved: 0 }, { name: 'Viaje', saved: 500 }],
      incomes: [{ date: '2026-09-01', amount: 1000, category: 'Importado' }],
      debts: [{ balance: 1000 }],
      expenses: [
        { date: '2026-09-01', amount: 10, category: 'Comida' },
        { date: '2026-09-02', amount: 10, category: 'Transporte' },
        { date: '2026-09-03', amount: 10, category: 'Importado' },
        { date: '2026-09-04', amount: 10, category: 'Importado' },
        { date: '2026-09-05', amount: 10, category: 'Importado' },
      ],
      syncEnabled: true,
      lastSyncAt: NOW - 10 * 86400000,
    }), rawT)
    expect(r.score).toBe(60)
    expect(r.label).toBe('score.good')
    expect(r.color).toBe('var(--pos)')
  })

  it('score 40 (borde inclusive) → regular', () => {
    // 20 (flujo, tier intermedio) + 0 (colchón) + 20 (deuda, sin deuda) + 0 (metas) + 0 (datos) = 40
    const r = calcFinancialScore(baseInput({
      savingRate: 0.15,
      goals: [],
      expenses: [
        { date: '2026-09-01', amount: 10, category: 'Importado' },
        { date: '2026-09-02', amount: 10, category: 'Importado' },
        { date: '2026-09-03', amount: 10, category: 'Comida' },
      ],
      syncEnabled: true,
      lastSyncAt: NOW - 10 * 86400000,
    }), rawT)
    expect(r.score).toBe(40)
    expect(r.label).toBe('score.fair')
    expect(r.color).toBe('var(--amb)')
  })

  it('score 38 (justo bajo el piso de "regular") → crítico', () => {
    // 10 (flujo) + 0 (colchón, sin meta que matchee) + 15 (deuda, ratio<0.20) + 7 (metas,
    // sin progreso) + 6 (datos: <50% categorizado sobre expenses+incomes combinados,
    // sync desactivado = 6 pts neutrales) = 38
    const r = calcFinancialScore(baseInput({
      savingRate: 0.02,
      goals: [{ name: 'Viaje', saved: 0 }],
      incomes: [{ date: '2026-09-01', amount: 1000 }], // sin categoría: cuenta en el denominador
      debts: [{ balance: 1000 }],
      expenses: [
        { date: '2026-09-01', amount: 10, category: 'Comida' },
        { date: '2026-09-02', amount: 10, category: 'Importado' },
        { date: '2026-09-03', amount: 10, category: 'Importado' },
        { date: '2026-09-04', amount: 10, category: 'Importado' },
      ], // 3 de 5 movimientos (4 expenses + 1 income) importados → ratio 0.4 < 0.50 → 0 pts
      syncEnabled: false,
    }), rawT)
    expect(r.score).toBe(38)
    expect(r.label).toBe('score.critical')
    expect(r.color).toBe('var(--red)')
  })
})
