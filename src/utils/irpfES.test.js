// Fixtures: calculados a mano aplicando la escala TRAMOS_IRPF_2026, la
// cotización COTIZACION_TRABAJADOR (6,50%) y la reducción art. 20 tal como
// están definidas en irpfES.js (LIRPF arts. 19/20/63, Orden PJC/297/2026 —
// ver comentarios del propio archivo). NO se re-verificaron esas cifras
// contra el BOE en esta sesión (sin acceso a red): es cobertura de
// regresión sobre la aritmética del módulo, no una auditoría legal nueva.
// La escala usada es la agregada de referencia — el propio módulo advierte
// que varias comunidades (p.ej. Madrid) tienen tarifa propia distinta.
import { describe, it, expect } from 'vitest'
import {
  cotizacionSSTrabajador, reduccionArt20, calcIRPFEmpleado, calcIRPFAutonomo,
  BASE_MAXIMA_COTIZACION_ANUAL,
} from './irpfES.js'

describe('cotizacionSSTrabajador — 6,50% con tope de base de cotización', () => {
  it('bajo el tope: 30.000 × 6,50% = 1.950', () => {
    expect(cotizacionSSTrabajador(30000)).toBeCloseTo(1950, 6)
  })
  it('sobre el tope (61.214,40 anual) se capa la base, no crece más', () => {
    expect(cotizacionSSTrabajador(80000)).toBeCloseTo(BASE_MAXIMA_COTIZACION_ANUAL * 0.065, 6)
    expect(cotizacionSSTrabajador(80000)).toBeCloseTo(3978.936, 3)
  })
})

describe('reduccionArt20 — tres tramos decrecientes', () => {
  it('RNT ≤ 14.852 → importe máximo pleno (7.302)', () => {
    expect(reduccionArt20(14025)).toBe(7302)
  })
  it('RNT > 19.747,50 → sin reducción', () => {
    expect(reduccionArt20(28050)).toBe(0)
  })
})

describe('calcIRPFEmpleado — integración completa contra la escala 2026', () => {
  it('bruto 30.000€, sin hijos: cuota, tipo efectivo y neto mensual reconcilian', () => {
    // SS = 1.950 → RNT previo 28.050 (fuera del art.20) → base liquidable
    // 26.050 → cuota íntegra 5.980,50 sobre la escala, mínimo del
    // contribuyente (5.550) tributa a 1.054,50 → cuota final 4.926.
    const r = calcIRPFEmpleado({ brutoAnual: 30000 })
    expect(r).toMatchObject({
      cuotaAnual: 4926,
      seguridadSocial: 1950,
      baseLiquidable: 26050,
      reduccionTrabajo: 0,
      minimoPersonalFamiliar: 5550,
      cuotaIntegra: 5981, // 5.980,50 redondeado
      cuotaDelMinimo: 1055, // 1.054,50 redondeado
      retencionMensual: 411,
      netoMensual: 1927,
    })
  })
  it('bruto 15.000€: la reducción art.20 plena deja la cuota en 0 (exento)', () => {
    // SS 975 → RNT previo 14.025 (≤14.852 → reducción plena 7.302) → base
    // liquidable 4.723 → cuota íntegra 897,37 < cuota del mínimo (1.054,50)
    const r = calcIRPFEmpleado({ brutoAnual: 15000 })
    expect(r).toMatchObject({ cuotaAnual: 0, reduccionTrabajo: 7302, baseLiquidable: 4723 })
    expect(r.retencionMensual).toBe(0)
  })
  it('más hijos reduce la cuota final (no cambia la escala, sube el mínimo exento)', () => {
    const sinHijos = calcIRPFEmpleado({ brutoAnual: 40000, numHijos: 0 })
    const conDosHijos = calcIRPFEmpleado({ brutoAnual: 40000, numHijos: 2 })
    expect(conDosHijos.minimoPersonalFamiliar).toBe(5550 + 2400 + 2700)
    expect(conDosHijos.cuotaAnual).toBeLessThan(sinHijos.cuotaAnual)
  })
  it('bruto 0 o negativo devuelve null', () => {
    expect(calcIRPFEmpleado({ brutoAnual: 0 })).toBeNull()
  })
})

describe('calcIRPFAutonomo — Modelo 130, tasa fija 20%', () => {
  it('ingresos 20.000 / gastos 5.000: gastos de difícil justificación topados al 5% del RN', () => {
    // RN 15.000 → 5% = 750, pero el tope trimestral es 2.000/4 = 500 → gana el tope
    const r = calcIRPFAutonomo({ ingresosTrimestre: 20000, gastosTrimestre: 5000 })
    expect(r).toMatchObject({
      rendimientoNeto: 15000,
      gastosDificilJust: 500,
      pagoFraccionado: 2900, // (15.000 - 500) × 20%
      tasa: 0.20,
    })
  })
  it('rendimiento neto negativo (gastos > ingresos) se clampea a 0, no da pago negativo', () => {
    const r = calcIRPFAutonomo({ ingresosTrimestre: 2000, gastosTrimestre: 5000 })
    expect(r).toMatchObject({ rendimientoNeto: 0, pagoFraccionado: 0 })
  })
})
