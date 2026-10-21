// Formato único de cifras (investigación UI oct-2026, ola 1): porcentajes con
// Intl en el locale del dinero, U+202F antes de "%", U+2212 para negativos y
// fechas cortas de fila con Intl (UI-Q2, UI-Q3, UI-Q7).
import { describe, it, expect, afterEach } from 'vitest'
import { fmtPct, fmtDayMonth, fmtSignedMoney, setMoneyLocale, setDateLocale, MINUS, NNBSP } from './index.js'

describe('fmtPct (UI-Q2)', () => {
  afterEach(() => setMoneyLocale('CLP', 'es'))
  it('coma decimal en es/pt/de y espacio fino antes de %', () => {
    expect(fmtPct(0.54)).toBe(`54,0${NNBSP}%`)
    expect(fmtPct(0.952, { locale: 'de-DE' })).toBe(`95,2${NNBSP}%`)
    expect(fmtPct(0.201, { locale: 'pt-BR' })).toBe(`20,1${NNBSP}%`)
  })
  it('sigue al locale del dinero activo (en: punto decimal)', () => {
    setMoneyLocale('USD', 'en')
    expect(fmtPct(0.54)).toBe(`54.0${NNBSP}%`)
  })
  it('negativos con U+2212, nunca guion; "+" solo si se pide', () => {
    expect(fmtPct(-0.062)).toBe(`${MINUS}6,2${NNBSP}%`)
    expect(fmtPct(-0.062)).not.toContain('-')
    expect(fmtPct(0.124, { signed: true, decimals: 0 })).toBe(`+12${NNBSP}%`)
  })
  it('un valor que redondea a cero no lleva signo; null/NaN = 0', () => {
    expect(fmtPct(-0.00001)).toBe(`0,0${NNBSP}%`)
    expect(fmtPct(null)).toBe(`0,0${NNBSP}%`)
    expect(fmtPct(Number.NaN, { decimals: 0 })).toBe(`0${NNBSP}%`)
  })
  it('miles con separador del locale (1 234,5 %)', () => {
    expect(fmtPct(12.345)).toBe(`1.234,5${NNBSP}%`)
  })
})

describe('signo menos en montos (UI-Q3)', () => {
  it('fmtSignedMoney usa U+2212', () => {
    expect(fmtSignedMoney(-1250, '$')).toBe(`${MINUS}$1.250`)
    expect(fmtSignedMoney(-1250, '$')).not.toMatch(/^-/)
  })
})

describe('fmtDayMonth (UI-Q7)', () => {
  afterEach(() => setDateLocale('es'))
  it('"15 oct" en español, sin el ISO recortado', () => {
    setDateLocale('es')
    expect(fmtDayMonth('2026-10-15')).toBe('15 oct')
  })
  it('respeta el idioma de la interfaz', () => {
    setDateLocale('en')
    expect(fmtDayMonth('2026-10-15')).toBe('Oct 15')
    setDateLocale('de')
    expect(fmtDayMonth('2026-10-15')).toBe('15. Okt.')
  })
  it('vacío o inválido no rompe', () => {
    expect(fmtDayMonth('')).toBe('')
    expect(fmtDayMonth('xx')).toBe('xx')
  })
})

import { fmtPctPoints, fmtDecimal } from './index.js'
describe('fmtPctPoints y fmtDecimal (UI-Q6, ola 2)', () => {
  it('porcentaje en puntos con el formato de fmtPct', () => {
    expect(fmtPctPoints(25, undefined)).toMatch(/^25\u202f%$/)
    expect(fmtPctPoints(1.16)).toMatch(/^1[,.]16\u202f%$/)
    expect(fmtPctPoints(0.6)).toMatch(/^0[,.]6\u202f%$/)
    expect(fmtPctPoints(12.345, 1)).toMatch(/^12[,.]3\u202f%$/)
  })
  it('decimal en el idioma del dinero, con signo menos tipográfico', () => {
    expect(fmtDecimal(0.4)).toMatch(/^0[,.]4$/)
    expect(fmtDecimal(-1.25, 2)).toMatch(/^−1[,.]25$/)
  })
})
