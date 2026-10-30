import { describe, it, expect } from 'vitest'
import { evalAmount, parseNumberToken, isExpression, convertAmount, roundDecimals, gapPct, veGap, toFieldText, usesDecimalComma } from './converter.js'

describe('parseNumberToken: separadores según el locale', () => {
  it('coma decimal (es-VE, de, pt)', () => {
    expect(parseNumberToken('1.234,5', true)).toBe(1234.5)
    expect(parseNumberToken('1.234', true)).toBe(1234)
    expect(parseNumberToken('1.234.567', true)).toBe(1234567)
    expect(parseNumberToken('2,5', true)).toBe(2.5)
    expect(parseNumberToken('2.5', true)).toBe(2.5) // punto suelto sin grupos de miles: decimal
    expect(parseNumberToken(',5', true)).toBe(0.5)
    expect(parseNumberToken('12,', true)).toBe(12)
  })
  it('punto decimal (en-US)', () => {
    expect(parseNumberToken('1,234.5', false)).toBe(1234.5)
    expect(parseNumberToken('1,234', false)).toBe(1234)
    expect(parseNumberToken('2.5', false)).toBe(2.5)
    expect(parseNumberToken('2,5', false)).toBe(2.5)
  })
  it('formas inválidas', () => {
    expect(parseNumberToken('1,2,3', true)).toBe(null)
    expect(parseNumberToken('1.23.4', true)).toBe(null)
    expect(parseNumberToken('12.34,5.6', true)).toBe(null)
    expect(parseNumberToken('.', true)).toBe(null)
    expect(parseNumberToken('abc', true)).toBe(null)
  })
})

describe('evalAmount: operaciones básicas sin eval', () => {
  const ev = (s, dc = true) => evalAmount(s, { decimalComma: dc })
  it('número suelto y cuentas', () => {
    expect(ev('100')).toBe(100)
    expect(ev('25*3')).toBe(75)
    expect(ev('25×3')).toBe(75)
    expect(ev('25x3')).toBe(75)
    expect(ev('100+50')).toBe(150)
    expect(ev('100 − 30')).toBe(70)
    expect(ev('90÷4')).toBe(22.5)
    expect(ev('90/4')).toBe(22.5)
  })
  it('precedencia, paréntesis y signo', () => {
    expect(ev('2+3*4')).toBe(14)
    expect(ev('(2+3)*4')).toBe(20)
    expect(ev('-5+10')).toBe(5)
    expect(ev('2*-3')).toBe(-6)
  })
  it('coma decimal y miles en la cuenta', () => {
    expect(ev('1.234,50+0,50')).toBe(1235)
    expect(ev('12,5*2')).toBe(25)
    expect(ev('12.5*2', false)).toBe(25)
    expect(ev('1,000+1', false)).toBe(1001)
  })
  it('un operador al final (a mitad de escribir) se ignora', () => {
    expect(ev('25*')).toBe(25)
    expect(ev('25 + ')).toBe(25)
  })
  it('vacío, texto, división por cero y paréntesis sin cerrar devuelven null', () => {
    expect(ev('')).toBe(null)
    expect(ev('   ')).toBe(null)
    expect(ev('abc')).toBe(null)
    expect(ev('5/0')).toBe(null)
    expect(ev('(2+3')).toBe(null)
    expect(ev('2+3)')).toBe(null)
    expect(ev('2**3')).toBe(null)
  })
  it('no ejecuta código: nada fuera de dígitos, separadores y + − × ÷ ( )', () => {
    expect(ev('alert(1)')).toBe(null)
    expect(ev('constructor')).toBe(null)
    expect(ev('1;2')).toBe(null)
    expect(ev('1e3')).toBe(null)
  })
})

describe('isExpression', () => {
  it('distingue una cuenta de un número', () => {
    expect(isExpression('25*3')).toBe(true)
    expect(isExpression('100 + 50')).toBe(true)
    expect(isExpression('(2)')).toBe(false)
    expect(isExpression('1.234,5')).toBe(false)
    expect(isExpression('-5')).toBe(false)
    expect(isExpression('')).toBe(false)
  })
})

describe('convertAmount: redondeo a los decimales de la moneda destino', () => {
  it('principal → US$ con 2 decimales', () => {
    expect(convertAmount({ amount: 10000, rate: 885.4, dir: 'toRef' })).toBe(11.29)
  })
  it('US$ → principal con los decimales de la moneda (VES 2, COP 0)', () => {
    expect(convertAmount({ amount: 100, rate: 885.4, dir: 'toLocal', localDecimals: 2 })).toBe(88540)
    expect(convertAmount({ amount: 12.5, rate: 4012.37, dir: 'toLocal', localDecimals: 0 })).toBe(50155)
    expect(convertAmount({ amount: 1.005, rate: 1, dir: 'toLocal', localDecimals: 2 })).toBe(1.01)
  })
  it('sin tasa válida no convierte', () => {
    expect(convertAmount({ amount: 10, rate: 0 })).toBe(null)
    expect(convertAmount({ amount: 10, rate: -1 })).toBe(null)
    expect(convertAmount({ amount: null, rate: 2 })).toBe(null)
  })
  it('roundDecimals respeta el signo', () => {
    expect(roundDecimals(-2.345, 2)).toBe(-2.35)
    expect(roundDecimals(2.5, 0)).toBe(3)
  })
})

describe('brecha BCV/paralelo', () => {
  it('gapPct', () => {
    expect(gapPct(885.4, 1009.3)).toBeCloseTo(13.99, 2)
    expect(gapPct(0, 10)).toBe(null)
    expect(gapPct(10, null)).toBe(null)
  })
  it('veGap solo con una consulta real y los dos valores', () => {
    const ve = { oficial: 100, paralelo: 112.7, paraleloDisponible: true, ts: 5, at: 3, paraleloAt: 4, source: 'api' }
    expect(veGap(ve)).toMatchObject({ bcv: 100, paralelo: 112.7, at: 4 })
    expect(veGap(ve).pct).toBeCloseTo(12.7, 5)
    expect(veGap({ ...ve, source: 'fallback' })).toBe(null)
    expect(veGap({ ...ve, paraleloDisponible: false, paralelo: null })).toBe(null)
    expect(veGap(null)).toBe(null)
  })
})

describe('toFieldText y usesDecimalComma', () => {
  it('el resultado pasa al campo sin miles y con el separador del locale', () => {
    expect(toFieldText(88540.5, 2, true)).toBe('88540,5')
    expect(toFieldText(88540.5, 2, false)).toBe('88540.5')
    expect(toFieldText(11.294, 2, true)).toBe('11,29')
    expect(toFieldText(null)).toBe('')
  })
  it('detecta la coma decimal', () => {
    expect(usesDecimalComma('es-VE')).toBe(true)
    expect(usesDecimalComma('de-DE')).toBe(true)
    expect(usesDecimalComma('en-US')).toBe(false)
  })
})
