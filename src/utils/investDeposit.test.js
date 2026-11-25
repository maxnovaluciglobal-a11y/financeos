// "Depositado frente a ganancia" (Inversiones v2): qué se compara con qué, y
// que nunca se llame depósito a un costo.
import { describe, it, expect } from 'vitest'
import { depositGain, costResult } from './investDeposit.js'

const totals = (o = {}) => ({ value: 11000, cost: 10000, total: 1000, day: 55, dayPct: 0.005, priced: 3, excluded: 0, ...o })
const ledger = (o = {}) => ({
  complete: true, deposits: 12000, withdrawals: 500, implicit: 0, opening: 0, openingCount: 0,
  contributed: 11500, value: 12650, gain: 1150, cash: 1650, dividends: 0, ...o,
})

describe('depositGain', () => {
  it('con depósitos y libro completo: depositado = aportado, ganancia = valor − aportado, % sobre lo depositado', () => {
    const d = depositGain({ ledger: ledger(), totals: totals() })
    expect(d).toMatchObject({ basis: 'deposits', hint: null, value: 12650, deposited: 11500, gain: 1150, withdrawals: 500, cash: 1650 })
    expect(d.pct).toBeCloseTo(0.1)
    expect(d.day).toBe(55)
    expect(d.dayPct).toBe(0.005)
  })
  it('una pérdida queda negativa, con su %', () => {
    const d = depositGain({ ledger: ledger({ value: 10350, gain: -1150 }), totals: totals() })
    expect(d.gain).toBe(-1150)
    expect(d.pct).toBeCloseTo(-0.1)
  })
  it('cuenta las posiciones que entraron a su costo sin operaciones', () => {
    expect(depositGain({ ledger: ledger({ openingCount: 2 }), totals: totals() }).atCost).toBe(2)
  })
  it('sin depósitos pero con compras de afuera: "puesto en compras", y avisa que faltan los depósitos', () => {
    const d = depositGain({ ledger: ledger({ deposits: 0, withdrawals: 0, implicit: 9000, contributed: 9000, value: 9900, gain: 900, cash: 0 }), totals: totals() })
    expect(d).toMatchObject({ basis: 'purchases', hint: 'noDeposits', deposited: 9000, gain: 900 })
    expect(d.pct).toBeCloseTo(0.1)
  })
  it('sin libro: compara con el costo y lo dice (noDeposits)', () => {
    const d = depositGain({ ledger: null, totals: totals() })
    expect(d).toMatchObject({ basis: 'cost', hint: 'noDeposits', value: 11000, deposited: 10000, gain: 1000 })
    expect(d.pct).toBeCloseTo(0.1)
  })
  it('libro con depósitos pero incompleto (sin tipo de cambio): cae al costo con hint "incomplete"', () => {
    const d = depositGain({ ledger: ledger({ complete: false, gain: null }), totals: totals() })
    expect(d).toMatchObject({ basis: 'cost', hint: 'incomplete' })
  })
  it('movimientos no disponibles: hint "opsUnavailable"', () => {
    expect(depositGain({ ledger: null, totals: totals(), opsMissing: true }).hint).toBe('opsUnavailable')
  })
  it('sin precios no inventa la variación de hoy; con montos fuera, marca partial', () => {
    const d = depositGain({ totals: totals({ priced: 0, excluded: 1 }) })
    expect(d.day).toBeNull()
    expect(d.dayPct).toBeNull()
    expect(d.partial).toBe(true)
  })
  it('sin costo ni libro: null (nada que comparar)', () => {
    expect(depositGain({ totals: totals({ cost: 0 }) })).toBeNull()
    expect(depositGain()).toBeNull()
  })
})

describe('costResult', () => {
  it('solo cuando la comparación no es el costo', () => {
    const t = totals()
    expect(costResult(t, depositGain({ totals: t }))).toBeNull()
    const r = costResult(t, depositGain({ ledger: ledger(), totals: t }))
    expect(r.abs).toBe(1000)
    expect(r.pct).toBeCloseTo(0.1)
    expect(costResult(totals({ cost: 0 }), { basis: 'deposits' })).toBeNull()
  })
})
