// Fixtures: calculados a mano contra ESCALOES_IRS_2026, ESCALOES_SOLIDARIEDADE
// y el mecanismo de aplicarMinimoExistencia tal como están definidos en
// irsPT.js (fuente citada en el propio archivo: CalculaPT / Forbes Portugal
// 2026). NO se re-verificaron esas cifras contra o Portal das Finanças en
// esta sesión (sin acceso a red): es cobertura de regresión sobre la
// aritmética del módulo, no una auditoría legal nueva.
import { describe, it, expect } from 'vitest'
import {
  taxaAdicionalSolidariedade, aplicarMinimoExistencia,
  calcIRSEmpregado, calcIRSRecibosVerdes, MINIMO_EXISTENCIA,
} from './irsPT.js'

describe('taxaAdicionalSolidariedade — por escalão, se suma al IRS normal', () => {
  it('solo el primer escalão (2,5% sobre el exceso de 80.000)', () => {
    expect(taxaAdicionalSolidariedade(90000)).toBeCloseTo(250, 6) // (90.000-80.000)×2,5%
  })
  it('cruza a los dos escalões (2,5% del tramo 80k-250k + 5% del resto)', () => {
    expect(taxaAdicionalSolidariedade(300000)).toBeCloseTo(6750, 6) // 170.000×2,5% + 50.000×5%
  })
  it('bajo 80.000 no aplica nada', () => {
    expect(taxaAdicionalSolidariedade(50000)).toBe(0)
  })
})

describe('calcIRSEmpregado — Categoria A, dedução específica y escalões', () => {
  it('bruto 20.000€: dedução específica es o maior (8,54×IAS) vs SS, aquí gana o fixo', () => {
    // SS = 20.000×11% = 2.200 < 4.587,09 → deducaoEspecifica = 4.587,09
    // rendimento coletável 15.412,91 → escalão 21,2% - 959,23 abater = 2.308,31
    const r = calcIRSEmpregado({ brutoAnual: 20000 })
    expect(r.deducaoEspecifica).toBe(4587)
    expect(r.deducaoPorSS).toBe(false)
    expect(r.rendimentoColetavel).toBe(15413)
    expect(r.irsAnual).toBeCloseTo(2308, 0)
    expect(r.taxaMarginal).toBe(0.212)
    expect(r.isento).toBe(false)
  })
  it('bruto 13.000€: o mínimo de existência recorta o IRS para que o líquido não caia abaixo de 12.880', () => {
    // rendimento coletável 8.412,91 → escalão 15,7% - 266,94 = 1.053,89 de IRS
    // "normal", pero o teto (bruto - MINIMO_EXISTENCIA = 120) es menor → gana el teto
    const r = calcIRSEmpregado({ brutoAnual: 13000 })
    expect(r.irsAnual).toBe(120)
    expect(r.liquidoAnualAposIRS).toBe(13000 - 120)
    expect(13000 - r.irsAnual).toBe(MINIMO_EXISTENCIA)
  })
  it('bruto 0 o negativo devuelve null', () => {
    expect(calcIRSEmpregado({ brutoAnual: 0 })).toBeNull()
  })
})

describe('calcIRSRecibosVerdes — regime simplificado, coeficiente 0,75', () => {
  it('faturação 30.000€: base tributável e dedução de SS acima do 10% franquia', () => {
    // base tributável 22.500; SS = 30.000×70%×21,4% = 4.494; franquia 10% = 3.000
    // dedução SS = 4.494-3.000 = 1.494 → rendimento coletável 21.006
    const r = calcIRSRecibosVerdes({ faturacaoAnual: 30000 })
    expect(r).toMatchObject({
      baseTributavel: 22500,
      ssAnual: 4494,
      deducaoSS: 1494,
      rendimentoColetavel: 21006,
    })
    expect(r.irsAnual).toBeCloseTo(3588, 0)
    expect(r.taxaMarginal).toBe(0.241)
  })
  it('faturação 0 devuelve null', () => {
    expect(calcIRSRecibosVerdes({ faturacaoAnual: 0 })).toBeNull()
  })
})

describe('aplicarMinimoExistencia — garantia sobre o bruto, não sobre o coletável', () => {
  it('nunca deixa o IRS empurrar o líquido abaixo do mínimo de existência', () => {
    expect(aplicarMinimoExistencia(5000, 13000)).toBe(120) // teto = 13.000-12.880
  })
  it('quando o IRS já é menor que o teto, não se altera', () => {
    expect(aplicarMinimoExistencia(100, 20000)).toBe(100)
  })
})
