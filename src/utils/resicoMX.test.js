// Fixtures: calculados a mano contra TRAMOS_RESICO y RETENCION_PERSONA_MORAL
// tal como están definidos en resicoMX.js (Art. 113-E y 113-J LISR, tasas
// 2026 = 2025 según el propio archivo). NO se re-verificaron esas cifras
// contra el portal del SAT en esta sesión (sin acceso a red): es cobertura
// de regresión sobre la aritmética del módulo, no una auditoría fiscal nueva.
import { describe, it, expect } from 'vitest'
import { calcResico, TOPE_ANUAL_RESICO } from './resicoMX.js'

describe('calcResico — tasa NO progresiva, aplica al 100% del ingreso del tramo', () => {
  it('tramo 1 (≤25.000, 1,00%), sin retención', () => {
    const r = calcResico(20000)
    expect(r).toMatchObject({
      tasa: 0.0100, isrCausado: 200, retencion: 0, aPagar: 200, saldoAFavor: 0,
      neto: 19800, tramoIdx: 0, fueraDeTabla: false, margenEnTramo: 5000,
      siguienteTasa: 0.0110,
    })
  })
  it('misma renta, facturando a persona moral: la retención 1,25% supera al ISR causado (1,00%) → saldo a favor', () => {
    const r = calcResico(20000, { facturaAPersonaMoral: true })
    expect(r).toMatchObject({ isrCausado: 200, retencion: 250, aPagar: 0, saldoAFavor: 50, conRetencion: true })
  })
  it('tramo 3 (50.000-83.333,33, 1,50%)', () => {
    const r = calcResico(60000)
    expect(r).toMatchObject({ tasa: 0.0150, isrCausado: 900, tramoIdx: 2 })
  })
  it('ingreso mensual que ya excede la tabla (efecto cliff sobre el tramo tope 2,50%)', () => {
    const r = calcResico(4000000)
    expect(r).toMatchObject({ tasa: 0.0250, isrCausado: 100000, fueraDeTabla: true })
    expect(r.baseTope).toBe(48000000)
    expect(r.superaTope).toBe(true)
    expect(TOPE_ANUAL_RESICO).toBe(3500000)
  })
  it('ingreso 0 o negativo devuelve null', () => {
    expect(calcResico(0)).toBeNull()
    expect(calcResico(-100)).toBeNull()
  })
})
