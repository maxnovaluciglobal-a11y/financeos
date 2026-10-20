import { describe, it, expect } from 'vitest'
import { extraCsvRows } from './csvExtraRows.js'
import { toCsv } from './csvSafe.js'

const tr = k => k

describe('extraCsvRows (DAT-15)', () => {
  const state = {
    budgets: [{ category: 'Comida', limit: 100000 }],
    debts: [{ creditor: 'Banco', debtType: 'Tarjeta', balance: 500, rate: 2.5, minPayment: 40, dueDate: '2026-11-05' }],
    goals: [{ name: 'Viaje', target: 3000, saved: 700, targetDate: '2027-01' }],
    subscriptions: [{ name: 'Netflix', category: 'Streaming', amount: 9.99, frequency: 'monthly', nextPaymentDate: '2026-11-01' }],
    recurring: [
      { description: 'Arriendo', kind: 'expense', category: 'Vivienda', amounts: [{ from: '2026-01', amount: 400 }, { from: '2026-06', amount: 420 }], schedule: { freq: 'monthly' }, startDate: '2026-01-05' },
      { description: 'Sueldo', kind: 'income', category: 'Salario', amounts: [{ from: '2026-01', amount: 1000 }], schedule: { freq: 'monthly' }, paused: true },
    ],
  }
  const rows = extraCsvRows(state, tr)

  it('una fila por registro, todas con 8 columnas', () => {
    expect(rows).toHaveLength(6)
    expect(rows.every(r => r.length === 8)).toBe(true)
  })
  it('montos con signo: gastos y deudas negativos, ingresos fijos positivos, el fijo toma el último monto', () => {
    const byType = Object.fromEntries(rows.map(r => [r[2], r[4]]))
    expect(byType).toMatchObject({ Banco: -500, Netflix: -9.99, Arriendo: -420, Sueldo: 1000, Viaje: 3000, Comida: 100000 })
  })
  it('registros vacíos o ausentes no rompen', () => {
    expect(extraCsvRows({}, tr)).toEqual([])
    expect(extraCsvRows({ debts: [{}], recurring: [{}] }, tr)).toHaveLength(2)
  })
  it('un nombre que empieza con = sale neutralizado en el CSV', () => {
    const csv = toCsv(extraCsvRows({ goals: [{ name: '=HYPERLINK("x")', target: 1 }] }, tr))
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
  })
})
