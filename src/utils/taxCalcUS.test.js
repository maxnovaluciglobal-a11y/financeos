// Fixtures: calculados a mano contra los tramos/topes que el propio módulo
// declara (Rev. Proc. 2025-32 para tramos/standard deduction, IRS Notice
// 2025-67 para 401k/IRA, Rev. Proc. 2025-19 para HSA — ver comentarios al
// inicio de taxCalcUS.js). NO se re-verificaron esas cifras contra el
// documento IRS original en esta sesión (sin acceso a red) — se confía en
// que ya estaban correctas en el código de producción, igual que el criterio
// de taxCalcCL.test.js/taxCalcDE.test.js: esto es cobertura de regresión
// sobre la aritmética del módulo, no una auditoría de la ley tributaria.
import { describe, it, expect } from 'vitest'
import {
  taxableIncome, tasaMarginal, tasaMarginalDesdeBruto,
  limite401k, limiteIRA, limiteHSA, valorFuturoSerie, LIMITES_2026,
} from './taxCalcUS.js'

describe('taxableIncome — resta la standard deduction', () => {
  it('single: 60.000 bruto - 16.100 SD = 43.900', () => {
    expect(taxableIncome(60000, 'single')).toBe(43900)
  })
  it('nunca negativo aunque el bruto sea menor a la SD', () => {
    expect(taxableIncome(10000, 'single')).toBe(0)
  })
})

describe('tasaMarginal — límites exactos de tramo (single y mfj)', () => {
  it('single: justo en el límite del tramo 12% (50.400) sigue en 12%', () => {
    expect(tasaMarginal(50400, 'single')).toBe(0.12)
  })
  it('single: un dólar más ya cae en el tramo 22%', () => {
    expect(tasaMarginal(50401, 'single')).toBe(0.22)
  })
  it('mfj: en el límite del tramo 12% (100.800) sigue en 12%, encima ya es 22%', () => {
    expect(tasaMarginal(100800, 'mfj')).toBe(0.12)
    expect(tasaMarginal(100801, 'mfj')).toBe(0.22)
  })
  it('tasaMarginalDesdeBruto encadena taxableIncome + tasaMarginal', () => {
    expect(tasaMarginalDesdeBruto(60000, 'single')).toBe(0.12)
  })
})

describe('limite401k — catch-up por tramo de edad', () => {
  it('sin catch-up bajo 50', () => {
    expect(limite401k(35)).toMatchObject({ base: 24500, catchUp: 0, total: 24500 })
  })
  it('catch-up estándar 50-59', () => {
    expect(limite401k(55)).toMatchObject({ base: 24500, catchUp: 8000, total: 32500 })
  })
  it('catch-up "super" SECURE 2.0 en la ventana 60-63', () => {
    expect(limite401k(61)).toMatchObject({ base: 24500, catchUp: 11250, total: 35750 })
  })
  it('a los 64 vuelve al catch-up estándar, no al super', () => {
    expect(limite401k(64)).toMatchObject({ catchUp: 8000, total: 32500 })
  })
})

describe('limiteIRA y limiteHSA', () => {
  it('IRA con catch-up desde 50', () => {
    expect(limiteIRA(50)).toMatchObject({ base: 7500, catchUp: 1100, total: 8600 })
    expect(limiteIRA(49)).toMatchObject({ catchUp: 0, total: 7500 })
  })
  it('HSA family con catch-up 55+', () => {
    expect(limiteHSA('family', 55)).toMatchObject({ base: 8750, catchUp: 1000, total: 9750 })
  })
  it('HSA self-only sin catch-up', () => {
    expect(limiteHSA('self', 40)).toMatchObject({ base: 4400, catchUp: 0, total: 4400 })
  })
})

describe('valorFuturoSerie — anualidad ordinaria', () => {
  it('tasa 0% es simplemente aporte × años', () => {
    expect(valorFuturoSerie(1000, 0, 10)).toBe(10000)
  })
  it('7% anual, 10 años: FV = 1000 × ((1.07^10 - 1) / 0.07) ≈ 13.816,45', () => {
    expect(valorFuturoSerie(1000, 0.07, 10)).toBeCloseTo(13816.45, 1)
  })
})

describe('LIMITES_2026 — sanity de las constantes citadas en el header', () => {
  it('no cambiaron silenciosamente', () => {
    expect(LIMITES_2026.contribucion401k).toBe(24500)
    expect(LIMITES_2026.hsaFamily).toBe(8750)
  })
})
