// APP-CO-336: la herramienta de AFC de Colombia aplica el límite global del Art. 336 ET
// (40 % del ingreso neto, máx. 1.340 UVT, compartido con la renta exenta del 25 %).
import { describe, it, expect } from 'vitest'
import co, { UVT, rentaGravableCO } from './co.js'

describe('aporte CO (AFC / pensión voluntaria)', () => {
  it('UVT 2026 de la DIAN', () => {
    expect(UVT).toBe(52374)
  })

  // Ejemplo de la guía de la landing (blog/afc-pension-voluntaria-renta-exenta-colombia):
  // ingreso $120M, ingreso neto $108M (aportes obligatorios $12M), AFC $24M.
  it('ejemplo de la guía: aportar $24M baja la renta gravable solo $16,2M', () => {
    const r = co.calcular({ ingresoAnual: 120_000_000, aporteAnual: 24_000_000, aportesObligatorios: 12_000_000 })
    expect(r.gravableSin).toBe(81_000_000)        // 108M − 25 % (27M)
    expect(r.gravableCon).toBe(64_800_000)        // 108M − tope global 43,2M
    expect(r.deducible).toBe(16_200_000)
    expect(r.ahorro).toBe(3_078_000)              // $4.543.345 − $1.465.345
    expect(r.nota).toMatch(/16\.200\.000/)
  })

  it('el tope útil es el aporte que llena el 40 %: más allá no baja la renta gravable', () => {
    const r = co.calcular({ ingresoAnual: 120_000_000, aporteAnual: 24_000_000, aportesObligatorios: 12_000_000 })
    // 0,75 × AFC + 27M = 43,2M → AFC = 21,6M
    expect(Math.abs(r.tope - 21_600_000)).toBeLessThanOrEqual(2)
    expect(r.faltaParaTope).toBe(0)
    expect(r.topePct).toBe(100)
    const menos = co.calcular({ ingresoAnual: 120_000_000, aporteAnual: 21_600_000, aportesObligatorios: 12_000_000 })
    expect(menos.deducible).toBe(16_200_000)
  })

  it('debajo del tope global, el aporte suma 75 % (el 25 % se recalcula sobre el resto)', () => {
    const r = co.calcular({ ingresoAnual: 120_000_000, aporteAnual: 10_000_000, aportesObligatorios: 12_000_000 })
    expect(r.deducible).toBe(7_500_000)
    expect(r.faltaParaTope).toBeGreaterThan(0)
  })

  it('el tope global nunca pasa de 1.340 UVT, aunque el 40 % sea mayor', () => {
    const ingresoNeto = 500_000_000
    const g = rentaGravableCO({ ingresoNeto, afc: 150_000_000, otras: 0 })
    expect(g).toBeCloseTo(ingresoNeto - 1340 * UVT, 0)
  })

  it('la renta exenta del 25 % se limita a 790 UVT', () => {
    // Sin AFC ni otras deducciones, con 40 % holgado: solo el 25 % con su tope.
    const ingresoNeto = 200_000_000                 // 25 % = 50M > 790 UVT (41,4M); 40 % = 80M > 1.340 UVT (70,2M)
    expect(rentaGravableCO({ ingresoNeto, afc: 0, otras: 0 })).toBeCloseTo(ingresoNeto - 790 * UVT, 0)
  })

  it('sin aportes obligatorios informados estima 8 % del ingreso', () => {
    const a = co.calcular({ ingresoAnual: 100_000_000, aporteAnual: 5_000_000 })
    const b = co.calcular({ ingresoAnual: 100_000_000, aporteAnual: 5_000_000, aportesObligatorios: 8_000_000 })
    expect(a).toEqual(b)
  })

  it('si el 25 % y otras deducciones ya llenan el 40 %, el aporte no ahorra nada', () => {
    const r = co.calcular({ ingresoAnual: 120_000_000, aporteAnual: 5_000_000, aportesObligatorios: 12_000_000, otrasDeducciones: 30_000_000 })
    expect(r.deducible).toBe(0)
    expect(r.ahorro).toBe(0)
    expect(r.tope).toBe(0)
    expect(r.topePct).toBe(100)
  })

  it('respeta el 30 % del ingreso como tope del aporte exento', () => {
    // Ingreso chico, sin aportes obligatorios: el 30 % (6M) manda antes que el 40 %.
    const r = co.calcular({ ingresoAnual: 20_000_000, aporteAnual: 9_000_000, aportesObligatorios: 0 })
    expect(r.tope).toBeLessThanOrEqual(6_000_000)
  })

  it('sin ingreso ni aporte no rompe', () => {
    const r = co.calcular({})
    expect(r.ahorro).toBe(0)
    expect(r.deducible).toBe(0)
    expect(r.nota).toBeNull()
  })
})
