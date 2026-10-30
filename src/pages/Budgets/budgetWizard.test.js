import { describe, it, expect } from 'vitest'
import {
  parseAmountInput, suggestWizardIncome, initialSavingsPct, topExpenseCategories, split503020,
  suggestWizardRows, wizardTotals, validateIncome, validateRows, planWizardWrites, maskedInputValue, unmaskTyped,
  WIZARD_DEFAULT_SAVINGS_PCT, DEFAULT_MODEL,
} from './budgetWizard.js'

const ex = (date, category, amount, extra = {}) => ({ id: `${date}-${category}-${amount}`, date, category, amount, ...extra })

describe('parseAmountInput', () => {
  it('acepta enteros, decimales y separadores de miles de cada región', () => {
    expect(parseAmountInput('1500')).toBe(1500)
    expect(parseAmountInput('1500.5')).toBe(1500.5)
    expect(parseAmountInput('1500,5')).toBe(1500.5)
    expect(parseAmountInput('1.500')).toBe(1500)
    expect(parseAmountInput('1.500.000')).toBe(1500000)
    expect(parseAmountInput('1.500,50')).toBe(1500.5)
    expect(parseAmountInput('1,500.50')).toBe(1500.5)
    expect(parseAmountInput('1,500')).toBe(1500)
    expect(parseAmountInput('1 500')).toBe(1500)
    expect(parseAmountInput('$ 2.000')).toBe(2000)
  })
  it('vacío o sin dígitos es NaN', () => {
    expect(parseAmountInput('')).toBeNaN()
    expect(parseAmountInput(null)).toBeNaN()
    expect(parseAmountInput('abc')).toBeNaN()
  })
})

describe('suggestWizardIncome', () => {
  it('prefiere el mes en curso (real + previsto por fijos)', () => {
    expect(suggestWizardIncome({ monthReal: 800, monthPending: 400.4, prevReal: 2000 })).toEqual({ amount: 1200, source: 'month' })
  })
  it('sin ingresos del mes: mes anterior, fijos, estimado, nada', () => {
    expect(suggestWizardIncome({ prevReal: 1900, recurringMonthly: 1500 })).toEqual({ amount: 1900, source: 'prev' })
    expect(suggestWizardIncome({ recurringMonthly: 1500, estimated: 900 })).toEqual({ amount: 1500, source: 'recurring' })
    expect(suggestWizardIncome({ estimated: 900 })).toEqual({ amount: 900, source: 'estimated' })
    expect(suggestWizardIncome({})).toEqual({ amount: 0, source: 'none' })
  })
})

describe('initialSavingsPct', () => {
  it('usa el ahorro objetivo guardado o 10 %', () => {
    expect(initialSavingsPct({})).toBe(WIZARD_DEFAULT_SAVINGS_PCT)
    expect(initialSavingsPct({ savingsTargetPct: 0 })).toBe(0)
    expect(initialSavingsPct({ savingsTargetPct: 25 })).toBe(25)
    expect(initialSavingsPct({ savingsTargetPct: 140 })).toBe(90)
  })
})

describe('topExpenseCategories', () => {
  it('suma por categoría en los meses dados, sin inversión, de mayor a menor', () => {
    const list = [
      ex('2026-09-02', 'Vivienda', 500), ex('2026-08-02', 'Vivienda', 500),
      ex('2026-09-03', 'Ropa', 80), ex('2026-09-04', 'Ropa', 40, { inv: true }),
      ex('2026-10-01', 'Viajes', 9999), ex('2026-07-01', 'Salud', 60),
    ]
    expect(topExpenseCategories(list, ['2026-09', '2026-08', '2026-07'])).toEqual([
      { category: 'Vivienda', total: 1000 }, { category: 'Ropa', total: 80 }, { category: 'Salud', total: 60 },
    ])
  })
})

describe('split503020', () => {
  it('reparte lo que queda tras el ahorro: 50 a necesidades y 30 a gustos', () => {
    const rows = split503020({ income: 1000, savingsPct: 20, weighted: [
      { category: 'Vivienda', w: 3, need: true }, { category: 'Alimentación', w: 1, need: true },
      { category: 'Entretención', w: 1, need: false },
    ] })
    // Para gastar 800 → necesidades 500 (375 + 125), gustos 300.
    expect(rows).toEqual([
      { category: 'Vivienda', limit: 375 }, { category: 'Alimentación', limit: 125 }, { category: 'Entretención', limit: 300 },
    ])
  })
  it('sin ingreso, límites en 0', () => {
    expect(split503020({ income: 0, savingsPct: 10, weighted: DEFAULT_MODEL }).every(r => r.limit === 0)).toBe(true)
  })
})

describe('suggestWizardRows', () => {
  const activeMonth = '2026-10'
  it('1) copia lo gastado el mes anterior si lo hay', () => {
    const r = suggestWizardRows({ activeMonth, income: 1000, expenses: [ex('2026-09-10', 'Alimentación', 210.2), ex('2026-09-11', 'Vivienda', 400)] })
    expect(r.source).toBe('copy')
    expect(r.rows).toEqual([{ category: 'Vivienda', limit: 400 }, { category: 'Alimentación', limit: 211 }])
  })
  it('2) sin mes anterior: plantilla de perfil (% del ingreso)', () => {
    const r = suggestWizardRows({ activeMonth, income: 2000, settings: { activeTemplateId: 'personal' }, expenses: [] })
    expect(r.source).toBe('template')
    expect(r.rows[0]).toEqual({ category: 'Vivienda', limit: 600 })
    expect(r.rows.length).toBe(5)
  })
  it('2) la plantilla guardada en ajustes manda sobre el id', () => {
    const r = suggestWizardRows({ activeMonth, income: 1000, settings: { activeTemplateId: 'personal', templateSuggestedBudgets: [{ category: 'Mascotas', pct: 4 }] } })
    expect(r.rows).toEqual([{ category: 'Mascotas', limit: 40 }])
  })
  it('3) sin plantilla: 50/30/20 sobre lo más gastado de los últimos 3 meses', () => {
    const r = suggestWizardRows({ activeMonth, income: 1000, savingsPct: 20, settings: {}, expenses: [
      ex('2026-08-01', 'Vivienda', 600), ex('2026-07-01', 'Alimentación', 200), ex('2026-08-05', 'Viajes', 100),
      ex('2026-06-01', 'Ropa', 999), // fuera de la ventana
    ] })
    expect(r.source).toBe('history')
    expect(r.rows).toEqual([{ category: 'Vivienda', limit: 375 }, { category: 'Alimentación', limit: 125 }, { category: 'Viajes', limit: 300 }])
  })
  it('4) sin datos: el modelo por defecto', () => {
    const r = suggestWizardRows({ activeMonth, income: 1000, savingsPct: 10, settings: {} })
    expect(r.source).toBe('model')
    expect(r.rows.map(x => x.category)).toEqual(DEFAULT_MODEL.map(x => x.category))
    const total = r.rows.reduce((s, x) => s + x.limit, 0)
    expect(Math.abs(total - 900)).toBeLessThanOrEqual(4)
  })
})

describe('wizardTotals', () => {
  const budgets = [{ id: 'b1', category: 'Vivienda', limit: 500 }, { id: 'b2', category: 'Salud', limit: 50 }]
  it('suma las filas, los presupuestos que no están en la lista y aparta el ahorro', () => {
    const t = wizardTotals({ income: 1000, savingsPct: 10, budgets, rows: [{ category: 'Ropa', amount: '100' }, { category: 'Viajes', amount: 'x' }] })
    expect(t.planned).toBe(100)
    expect(t.others).toBe(550)
    expect(t.savings).toBe(100)
    expect(t.free).toBe(250)
    expect(t.over).toBe(0)
  })
  it('una categoría existente cuenta con su límite actual salvo que se actualice', () => {
    const rows = [{ category: 'Vivienda', amount: '700' }]
    expect(wizardTotals({ income: 1000, budgets, rows }).budgeted).toBe(550)
    expect(wizardTotals({ income: 1000, budgets, rows, updateExisting: true }).budgeted).toBe(750)
  })
  it('marca el exceso cuando presupuesto + ahorro superan el ingreso', () => {
    const t = wizardTotals({ income: 500, savingsPct: 20, rows: [{ category: 'Ropa', amount: '450' }] })
    expect(t.over).toBe(50)
    expect(t.free).toBe(0)
  })
})

describe('validación', () => {
  it('el ingreso debe ser mayor que cero', () => {
    expect(validateIncome('1.200')).toBeNull()
    expect(validateIncome('0')).toBe('income')
    expect(validateIncome('')).toBe('income')
  })
  it('cada fila nueva necesita un límite > 0; sin filas no se puede crear', () => {
    expect(validateRows([])).toEqual({ ok: false, empty: true, errors: {} })
    const v = validateRows([{ category: 'Ropa', amount: '0' }, { category: 'Salud', amount: '20' }])
    expect(v.ok).toBe(false)
    expect(v.errors).toEqual({ Ropa: 'limit' })
  })
  it('una fila existente que no se actualiza no se valida; duplicados fallan', () => {
    const budgets = [{ category: 'Ropa', limit: 10 }]
    expect(validateRows([{ category: 'Ropa', amount: '' }], { budgets }).ok).toBe(true)
    expect(validateRows([{ category: 'Ropa', amount: '' }], { budgets, updateExisting: true }).errors).toEqual({ Ropa: 'limit' })
    expect(validateRows([{ category: 'A', amount: '1' }, { category: 'A', amount: '2' }]).errors).toEqual({ A: 'dup' })
  })
})

describe('planWizardWrites', () => {
  const budgets = [{ id: 'b1', category: 'Vivienda', limit: 500, createdAt: '2026-01-01' }, { id: 'b2', category: 'Salud', limit: 50 }]
  const rows = [{ category: 'Vivienda', amount: '600' }, { category: 'Salud', amount: '50' }, { category: 'Ropa', amount: '80,5' }, { category: 'Viajes', amount: '' }]
  it('crea las nuevas y deja las existentes si no se pide actualizar', () => {
    expect(planWizardWrites({ rows, budgets })).toEqual({
      create: [{ category: 'Ropa', limit: 80.5 }], update: [], keep: ['Vivienda', 'Salud'],
    })
  })
  it('actualiza solo las existentes cuyo límite cambia, conservando id y fecha', () => {
    const w = planWizardWrites({ rows, budgets, updateExisting: true })
    expect(w.update).toEqual([{ id: 'b1', category: 'Vivienda', limit: 600, createdAt: '2026-01-01' }])
    expect(w.keep).toEqual(['Salud'])
  })
})

describe('ocultar montos en los campos (T13)', () => {
  it('con el modo activo y sin edición, el campo nunca muestra dígitos', () => {
    expect(maskedInputValue(true, false, '125000', '•••')).toBe('•••')
    expect(maskedInputValue(true, false, '', '•••')).toBe('')
    expect(maskedInputValue(true, false, undefined, '•••')).toBe('')
  })
  it('mientras se edita (o sin el modo) se ve lo que se teclea', () => {
    expect(maskedInputValue(true, true, '12', '•••')).toBe('12')
    expect(maskedInputValue(false, false, '125000', '•••')).toBe('125000')
  })
  it('teclear sobre la máscara deja solo lo nuevo; borrarla deja vacío', () => {
    expect(unmaskTyped('•••5', '•••')).toBe('5')
    expect(unmaskTyped('••', '•••')).toBe('')
    expect(unmaskTyped('7', '•••')).toBe('7')
  })
})
