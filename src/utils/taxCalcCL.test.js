// Fixtures: valores obtenidos corriendo las funciones reales contra FALLBACK
// (UTM $71.649 / UF $40.854 / comisión AFP 1,11% de indicadores.js, Superintendencia de Pensiones, oct-2026),
// no calculados a mano — mismo criterio que taxIdValidation.test.js para RIF.
// Las fórmulas en sí ya fueron verificadas contra spensiones.cl/SII en la
// auditoría 2026-08-16 (ver financeos-app/CLAUDE.md); esto es cobertura de
// regresión, no una re-verificación de la ley tributaria.
import { describe, it, expect } from 'vitest'
import {
  calcDescuentos, calcImpuestoMensual, calcImpuestoAnual,
  calcBrutoDesdeLiquido, calcBeneficioAPV, calcGapTramo, calcArbitraje,
  getParametrosCL,
} from './taxCalcCL.js'

describe('getParametrosCL — FALLBACK por defecto', () => {
  it('usa UTM/UF de indicadores.js si nadie llamó setIndicadores', () => {
    const p = getParametrosCL(2026)
    expect(p.utmMes).toBe(71649)
    expect(p.uf).toBe(40854)
    expect(p.utaEsAproximada).toBe(true)
    expect(p.anioTributario).toBe(2027)
  })
})

describe('calcDescuentos — previsional mensual', () => {
  it('bajo los topes: AFP 10% / salud 7% / cesantía 0,6% / comisión 1,11%', () => {
    const d = calcDescuentos(1200000)
    expect(d).toMatchObject({ afp: 120000, salud: 84000, cesantia: 7200, comision: 13320 })
    expect(d.total).toBe(d.totalDeducible + d.comision)
    expect(d.liquido).toBe(1200000 - d.total)
  })
  it('sobre el tope AFP/salud (90 UF) pero bajo el de cesantía (135,2 UF)', () => {
    const d = calcDescuentos(5000000)
    expect(d).toMatchObject({ afp: 367686, salud: 257380, cesantia: 30000, comision: 40813 })
  })
  it('la comisión de la AFP no rebaja la base imponible (totalDeducible la excluye)', () => {
    const d = calcDescuentos(1200000)
    expect(d.totalDeducible).toBe(d.afp + d.salud + d.cesantia)
    expect(d.total).toBe(d.totalDeducible + d.comision)
  })
})

describe('calcImpuestoMensual — impuesto único 2ª categoría', () => {
  it('renta 0 no tributa', () => { expect(calcImpuestoMensual(0)).toBe(0) })
  it('tramo 2 (13,5–30 UTM)', () => { expect(calcImpuestoMensual(1200000)).toBe(9310) })
  it('tramo 3 (30–50 UTM)', () => { expect(calcImpuestoMensual(3000000)).toBe(115331) })
  it('es monótono creciente en el bruto', () => {
    expect(calcImpuestoMensual(2000000)).toBeLessThan(calcImpuestoMensual(4000000))
  })
})

describe('calcImpuestoAnual — Impuesto Global Complementario', () => {
  it('renta 0 no tributa', () => {
    expect(calcImpuestoAnual(0, 860000)).toMatchObject({ impuesto: 0, tramo: 1, tasaMarginal: 0 })
  })
  it('tramo 2 con UTA explícita', () => {
    expect(calcImpuestoAnual(20000000, 860000)).toMatchObject({ impuesto: 335600, tramo: 2, tasaMarginal: 0.04 })
  })
})

describe('calcBrutoDesdeLiquido — bisección, debe invertir a calcDescuentos+calcImpuestoMensual', () => {
  it('el líquido resultante del bruto encontrado coincide con el objetivo', () => {
    const bruto = calcBrutoDesdeLiquido(1000000)
    const desc = calcDescuentos(bruto)
    const base = Math.max(0, bruto - desc.totalDeducible)
    const netoReal = bruto - desc.total - calcImpuestoMensual(base)
    expect(netoReal).toBe(1000000)
  })
  it('líquido 0 o negativo devuelve 0 sin iterar', () => {
    expect(calcBrutoDesdeLiquido(0)).toBe(0)
    expect(calcBrutoDesdeLiquido(-100)).toBe(0)
  })
})

describe('calcBeneficioAPV — Régimen A (bono estatal) vs B (rebaja de base)', () => {
  it('Régimen A: el impuesto NO cambia, el beneficio es el bono estatal 15%', () => {
    const r = calcBeneficioAPV({ sueldoBrutoMensual: 1500000, apvMensual: 100000, utaAnual: 860000 })
    expect(r.impuestoConRegA).toBe(r.impuestoSinAPV)
    expect(r.ahorroTributarioRegA).toBe(0)
    expect(r.bonoEstatalRegA).toBe(180000) // 15% de 1.200.000 anual, bien bajo el tope de 6 UTM
    expect(r.bonoLimitadoPor10x).toBe(false)
  })
  it('Régimen B: rebaja la base imponible y por eso el impuesto', () => {
    const r = calcBeneficioAPV({ sueldoBrutoMensual: 1500000, apvMensual: 100000, utaAnual: 860000 })
    expect(r.impuestoConRegB).toBeLessThan(r.impuestoSinAPV)
    expect(r.ahorroRegB).toBe(48000)
  })
  it('sin sueldo o sin aporte devuelve null en vez de dividir por cero', () => {
    expect(calcBeneficioAPV({ sueldoBrutoMensual: 0, apvMensual: 100000 })).toBeNull()
    expect(calcBeneficioAPV({ sueldoBrutoMensual: 1000000, apvMensual: 0 })).toBeNull()
  })
})

describe('calcGapTramo — cuánto falta para bajar de tramo', () => {
  it('calcula el gap hasta el umbral inferior del tramo actual', () => {
    const g = calcGapTramo(15000000, 860000)
    expect(g).toMatchObject({ gap: 3390000, tramoActual: 2, tramoObjetivo: 1, dentroDelTope: true })
  })
  it('ya en el tramo exento no hay gap hacia abajo (devuelve null)', () => {
    expect(calcGapTramo(1000000, 860000)).toBeNull()
  })
})

describe('calcArbitraje — brecha entre tasa marginal de hoy y tasa de retiro estimada', () => {
  it('tramo más alto (35%) vs retiro estimado 4%', () => {
    expect(calcArbitraje(0.35)).toMatchObject({ tasaRetiroEst: 0.04, arbitrajePorPeso: 0.31, centavosPorPeso: 31 })
  })
  it('nunca es negativo aunque la tasa marginal sea baja', () => {
    expect(calcArbitraje(0).arbitrajePorPeso).toBeGreaterThanOrEqual(0)
  })
})
