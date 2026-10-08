import { describe, it, expect } from 'vitest'
import { pressKey, keypadToNumber, currencyDecimals, amountToKeypad, formatKeypadDisplay } from './keypad.js'
import { toKeypadAmount } from './smsParser.js'

const type = (keys, decimals = 2, start = '') => keys.reduce((a, k) => pressKey(a, k, decimals), start)

describe('pressKey · dígitos', () => {
  it('concatena dígitos', () => {
    expect(type(['1', '2', '3'])).toBe('123')
  })

  it('no repite ceros a la izquierda', () => {
    expect(type(['0', '0', '0'])).toBe('0')
    expect(type(['0', '5'])).toBe('5')
  })

  it('ignora teclas desconocidas', () => {
    expect(pressKey('12', 'x')).toBe('12')
  })
})

describe('pressKey · decimales (moneda con 2)', () => {
  it('admite como máximo 2 decimales', () => {
    expect(type(['1', ',', '2', '3', '4'])).toBe('1,23')
  })

  it('la coma sobre vacío arma "0,"', () => {
    expect(type([','])).toBe('0,')
  })

  it('no agrega una segunda coma', () => {
    expect(type(['1', ',', ',', '5'])).toBe('1,5')
  })

  it('"000" respeta el límite de decimales', () => {
    expect(type(['1', ',', '000'])).toBe('1,00')
  })
})

describe('pressKey · moneda sin decimales (CLP, COP)', () => {
  it('la coma no hace nada', () => {
    expect(type(['1', ',', '5'], 0)).toBe('15')
  })

  it('"000" agrega tres ceros', () => {
    expect(type(['1', '8', '000'], 0)).toBe('18000')
    expect(type(['5', '000', '000'], 0)).toBe('5000000')
  })

  it('"000" sobre vacío o "0" no agrega ceros a la izquierda', () => {
    expect(type(['000'], 0)).toBe('')
    expect(type(['0', '000'], 0)).toBe('0')
  })
})

describe('pressKey · borrar', () => {
  it('borra el último carácter', () => {
    expect(type(['1', ',', '5', '⌫'])).toBe('1,')
    expect(type(['1', '⌫', '⌫'])).toBe('')
  })
})

describe('pressKey después de pegar un SMS (toKeypadAmount)', () => {
  it('sigue el formato con coma: no puede armar "12.5,3"', () => {
    const pasted = toKeypadAmount(12.5)
    expect(pasted).toBe('12,5')
    expect(pressKey(pasted, ',')).toBe('12,5')
    expect(type(['3', '4'], 2, pasted)).toBe('12,53')
  })

  it('un monto entero pegado admite "000"', () => {
    expect(pressKey(toKeypadAmount(23), '000', 0)).toBe('23000')
  })
})

describe('keypadToNumber', () => {
  it.each([['1234,5', 1234.5], ['0,', 0], ['', 0], ['18000', 18000]])('%s -> %s', (s, n) => {
    expect(keypadToNumber(s)).toBe(n)
  })
})

describe('currencyDecimals', () => {
  it('usa el mapa explícito de config y 2 por defecto', () => {
    expect(currencyDecimals('CLP')).toBe(0)
    expect(currencyDecimals('COP')).toBe(0)
    expect(currencyDecimals('USD')).toBe(2)
    expect(currencyDecimals('ARS')).toBe(2)
    expect(currencyDecimals('XXX')).toBe(2)
  })
})

describe('amountToKeypad', () => {
  it('redondea a los decimales de la moneda', () => {
    expect(amountToKeypad(12990.4, 0)).toBe('12990')
    expect(amountToKeypad(12.5, 2)).toBe('12,5')
    expect(amountToKeypad(0, 2)).toBe('')
  })
})

describe('formatKeypadDisplay', () => {
  it.each([
    ['18500', 'es-CL', '18.500'],
    ['1686200', 'es-CO', '1.686.200'],
    ['1234,5', 'en-US', '1,234.5'],
    ['0,', 'es-CL', '0,'],
    ['12,', 'en-US', '12.'],
    ['', 'es-CL', ''],
  ])('%s en %s -> %s', (a, loc, out) => {
    expect(formatKeypadDisplay(a, loc)).toBe(out)
  })
})
