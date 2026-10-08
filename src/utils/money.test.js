import { describe, it, expect } from 'vitest'
import { MONEY_MASK, maskMoney, stripDeviceOnlySettings, mergeIncomingSettings } from './money.js'

describe('maskMoney', () => {
  it('deja pasar el valor cuando no está oculto', () => {
    expect(maskMoney(false, '$12.500')).toBe('$12.500')
  })
  it('nunca deja dígitos cuando está oculto', () => {
    for (const v of ['$12.500', 12500, '−US$3', null, undefined]) {
      const out = maskMoney(true, v)
      expect(out).toBe(MONEY_MASK)
      expect(out).not.toMatch(/\d/)
    }
  })
})

describe('ajustes de dispositivo (hideAmounts) fuera de respaldo y sync', () => {
  it('stripDeviceOnlySettings quita hideAmounts sin tocar el resto', () => {
    const s = { currency: 'CLP', theme: 'dark', hideAmounts: true }
    expect(stripDeviceOnlySettings(s)).toEqual({ currency: 'CLP', theme: 'dark' })
    expect(s.hideAmounts).toBe(true) // no muta el original
  })

  it('mergeIncomingSettings conserva el hideAmounts local y descarta el entrante', () => {
    const incoming = { currency: 'USD', hideAmounts: false }
    expect(mergeIncomingSettings(incoming, { currency: 'CLP', hideAmounts: true }))
      .toEqual({ currency: 'USD', hideAmounts: true })
    expect(mergeIncomingSettings({ currency: 'USD', hideAmounts: true }, { currency: 'CLP' }))
      .toEqual({ currency: 'USD' })
  })

  it('tolera entradas vacías', () => {
    expect(stripDeviceOnlySettings(null)).toBe(null)
    expect(mergeIncomingSettings({ a: 1 }, null)).toEqual({ a: 1 })
  })
})

// ── Decimales por moneda (08-oct-2026) ───────────────────────────────────────
import { fmtMoney, fmtAmount, fmtSignedMoney, fmtAxis, setMoneyLocale, currencySymbol, localeForCurrency, moneyDecimals } from './index.js'
import { afterEach } from 'vitest'

const NBSP = ' '

describe('fmtMoney respeta los decimales de la moneda', () => {
  afterEach(() => setMoneyLocale('CLP', 'es'))

  it('USD 42.5 → $42.50 (en)', () => {
    setMoneyLocale('USD', 'en')
    expect(fmtMoney(42.5, currencySymbol('USD'))).toBe('$42.50')
    expect(moneyDecimals()).toBe(2)
  })
  it('USD siempre con 2 decimales, también en montos redondos', () => {
    setMoneyLocale('USD', 'en')
    expect(fmtMoney(1250, '$')).toBe('$1,250.00')
    expect(fmtMoney(0.005, '$')).toBe('$0.01')
  })
  it('CLP 42500 → $42.500 (sin decimales)', () => {
    setMoneyLocale('CLP', 'es')
    expect(fmtMoney(42500, '$')).toBe('$42.500')
    expect(fmtMoney(42500.6, '$')).toBe('$42.501')
  })
  it('COP sin decimales', () => {
    setMoneyLocale('COP', 'es')
    expect(fmtMoney(1_800_000, '$')).toBe('$1.800.000')
  })
  it('EUR en alemán: 42,50 € y 1.234,50 €', () => {
    setMoneyLocale('EUR', 'de')
    expect(localeForCurrency('EUR', 'de')).toBe('de-DE')
    expect(fmtMoney(42.5, '€')).toBe(`42,50${NBSP}€`)
    expect(fmtMoney(1234.5, '€')).toBe(`1.234,50${NBSP}€`)
  })
  it('EUR en inglés lleva el símbolo delante', () => {
    setMoneyLocale('EUR', 'en')
    expect(fmtMoney(42.5, '€')).toBe('€42.50')
  })
  it('MXN con centavos', () => {
    setMoneyLocale('MXN', 'es')
    expect(fmtMoney(199.9, '$')).toBe('$199.90')
  })
  it('fmtMoney sigue devolviendo el valor absoluto (el signo lo pone quien llama)', () => {
    setMoneyLocale('USD', 'en')
    expect(fmtMoney(-42.5, '$')).toBe('$42.50')
    expect(fmtMoney(null, '$')).toBe('$0.00')
  })
  it('fmtSignedMoney marca los negativos con signo menos y no deja "−$0.00"', () => {
    setMoneyLocale('USD', 'en')
    expect(fmtSignedMoney(-42.5, '$')).toBe('−$42.50')
    expect(fmtSignedMoney(42.5, '$')).toBe('$42.50')
    expect(fmtSignedMoney(-0.001, '$')).toBe('$0.00')
  })
  it('fmtAmount conserva el signo y nunca devuelve "-0"', () => {
    setMoneyLocale('CLP', 'es')
    expect(fmtAmount(-1500)).toBe('-1.500')
    expect(fmtAmount(-0.2)).toBe('0')
  })
})

describe('currencySymbol', () => {
  it('USD es "$" en inglés y "US$" en el resto', () => {
    expect(currencySymbol('USD', 'en')).toBe('$')
    expect(currencySymbol('USD', 'es')).toBe('US$')
    expect(currencySymbol('USD', 'de')).toBe('US$')
  })
  it('el resto no depende del idioma; desconocida → "$"', () => {
    expect(currencySymbol('EUR', 'de')).toBe('€')
    expect(currencySymbol('COP', 'en')).toBe('$')
    expect(currencySymbol('XYZ', 'es')).toBe('$')
  })
})

describe('fmtAxis (ejes compactos de gráficos, enteros)', () => {
  it('K y M sin centavos', () => {
    expect(fmtAxis(950.5)).toBe('951')
    expect(fmtAxis(12_000)).toBe('12K')
    expect(fmtAxis(1_500_000)).toBe('1.5M')
    expect(fmtAxis(-2500)).toBe('-3K')
  })
})

import { fmtMoneyCompact } from './index.js'
describe('fmtMoneyCompact (listas de gráficos)', () => {
  afterEach(() => setMoneyLocale('CLP', 'es'))
  it('USD: completo con centavos bajo 10 000, compacto arriba', () => {
    setMoneyLocale('USD', 'en')
    expect(fmtMoneyCompact(1250, '$')).toBe('$1,250.00')
    expect(fmtMoneyCompact(12_500, '$')).toBe('$12.5K')
    expect(fmtMoneyCompact(1_800_000, '$')).toBe('$1.8M')
  })
  it('CLP: mismo umbral de siempre (1 000)', () => {
    setMoneyLocale('CLP', 'es')
    expect(fmtMoneyCompact(950, '$')).toBe('$950')
    expect(fmtMoneyCompact(42_500, '$')).toBe('$43K')
  })
  it('EUR en alemán: símbolo detrás también compacto', () => {
    setMoneyLocale('EUR', 'de')
    expect(fmtMoneyCompact(12_500, '€')).toBe('12,5K €')
  })
})

import { fmtMoneyFor } from './index.js'
describe('fmtMoneyFor (sin estado global)', () => {
  it('formatea cualquier moneda/idioma sin cambiar la activa', () => {
    setMoneyLocale('CLP', 'es')
    expect(fmtMoneyFor(2450.5, 'USD', 'en')).toBe('$2,450.50')
    expect(fmtMoneyFor(2450.5, 'EUR', 'de')).toBe('2.450,50 €')
    expect(fmtMoneyFor(1686200, 'COP', 'es')).toBe('$1.686.200')
    expect(fmtMoney(42500, '$')).toBe('$42.500')
  })
})
