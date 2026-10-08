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
