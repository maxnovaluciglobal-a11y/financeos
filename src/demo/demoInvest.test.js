import { describe, it, expect } from 'vitest'
import { demoInvestSnapshot } from './demoInvest.js'
import { DEMO_SETTINGS } from './demoData.js'
import { moduleOn } from '../utils/modules.js'
import { investValueForUser } from '../utils/investNetWorth.js'

describe('Inversiones en el demo', () => {
  it('se ve encendido, sin tocar el valor por defecto de una cuenta real', () => {
    expect(moduleOn(DEMO_SETTINGS, 'investments')).toBe(true)
    expect(moduleOn({}, 'investments')).toBe(false)
  })
  it('la muestra es ficticia y no cita una fuente de precios', () => {
    const s = demoInvestSnapshot(1000)
    expect(s.demo).toBe(true)
    expect(s.yahoo).toBe(false)
    expect(s.coingecko).toBe(false)
    expect(s.uid).toBeNull()
  })
  it('sale en la moneda de cada persona del demo', () => {
    for (const currency of ['COP', 'EUR', 'USD']) {
      expect(investValueForUser(demoInvestSnapshot(), { currency }, () => null).amount, currency).toBeGreaterThan(0)
    }
  })
})
