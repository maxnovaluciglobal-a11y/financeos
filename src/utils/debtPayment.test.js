import { describe, it, expect } from 'vitest'
import { nextPaymentAmount, applyDebtPayment } from './debtPayment.js'

describe('Registrar pago (deudas)', () => {
  it('suma el interés del período antes de restar la cuota', () => {
    const d = { id: 'd', balance: 1000, minPayment: 100, rate: 12, paidInstallments: 1 }
    expect(nextPaymentAmount(d)).toBe(100)
    const { debt, amount } = applyDebtPayment(d)
    expect(amount).toBe(100)
    expect(debt.balance).toBeCloseTo(910)
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
