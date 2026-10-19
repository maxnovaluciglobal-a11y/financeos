import { describe, it, expect } from 'vitest'
import { nextPaymentAmount, applyDebtPayment, monthlyRate } from './debtPayment.js'

describe('Registrar pago (deudas)', () => {
  it('suma el interés del período antes de restar la cuota (TAE 12 % -> 0,9489 % mensual)', () => {
    const d = { id: 'd', balance: 1000, minPayment: 100, rate: 12, paidInstallments: 1 }
    expect(nextPaymentAmount(d)).toBe(100)
    const { debt, amount } = applyDebtPayment(d)
    expect(amount).toBe(100)
    expect(debt.balance).toBeCloseTo(909.49, 2)
    expect(debt.paidInstallments).toBe(2)
    expect(d.balance).toBe(1000) // no muta el original
  })
  it('la última cuota no deja saldo negativo', () => {
    const { debt, amount } = applyDebtPayment({ balance: 50, minPayment: 100, rate: 0 })
    expect(amount).toBe(50)
    expect(debt.balance).toBe(0)
  })
  it('monto distinto ("solo este mes")', () => {
    expect(applyDebtPayment({ balance: 1000, minPayment: 100, rate: 0 }, 250).debt.balance).toBe(750)
  })
  it('deuda en UF: baja el saldo en UF con la UF implícita si no hay la del día', () => {
    const d = { balance: 3_800_000, ufBalance: 100, minPayment: 380_000, rate: 0 }
    expect(applyDebtPayment(d).debt.ufBalance).toBeCloseTo(90)
    expect(applyDebtPayment(d, 380_000, { ufValue: 40_000 }).debt.ufBalance).toBeCloseTo(90.5)
  })
})

// Auditoría 360 (casos de t1.mjs), D-13: la tasa guardada es TAE.
describe('TAE e interés una vez por mes (FIN-6, FIN-7)', () => {
  it('FIN-6: 1.000.000 al 50 % TAE cobra 34.366 de interés en el mes (antes 41.667)', () => {
    const d = { balance: 1000000, rate: 50, minPayment: 100000 }
    expect(Math.round(1000000 * monthlyRate(d))).toBe(34366)
    expect(Math.round(applyDebtPayment(d, 0, { month: '2026-10' }).debt.balance)).toBe(1034366)
  })

  it('FIN-7: dos abonos de 50.000 en el mismo mes = un pago de 100.000 (antes 982.986 vs 941.667)', () => {
    const d = { balance: 1000000, rate: 50, minPayment: 100000, paidInstallments: 0 }
    const one = applyDebtPayment(d, 100000, { month: '2026-10' }).debt
    const a = applyDebtPayment(d, 50000, { month: '2026-10' }).debt
    const b = applyDebtPayment(a, 50000, { month: '2026-10' }).debt
    expect(Math.round(b.balance)).toBe(Math.round(one.balance))
    expect(Math.round(one.balance)).toBe(934366)
    expect(b.paidInstallments).toBe(0)
    expect(one.paidInstallments).toBe(1)
    expect(b.lastInterestAt).toBe('2026-10')
  })

  it('el mes siguiente vuelve a devengar un mes de interés', () => {
    const d = { balance: 1000, rate: 12, minPayment: 100, lastInterestAt: '2026-09' }
    expect(applyDebtPayment(d, 100, { month: '2026-10' }).debt.balance).toBeCloseTo(909.49, 2)
    expect(applyDebtPayment(d, 100, { month: '2026-09' }).debt.balance).toBe(900)
  })

  it('nextPaymentAmount no suma interés si ya se devengó este mes', () => {
    expect(nextPaymentAmount({ balance: 50, rate: 50, minPayment: 100, lastInterestAt: '2026-10' }, { month: '2026-10' })).toBe(50)
  })
})
