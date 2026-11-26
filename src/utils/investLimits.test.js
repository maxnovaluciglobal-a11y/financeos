import { describe, it, expect } from 'vitest'
import config from '../config.js'
import {
  STARTER_INVEST_LIMITS, investLimitsEnabled, investLimitsFor, currentInvestLimits,
  canAddMore, canImportFile, canPushAlerts, splitForTramos,
} from './investLimits.js'

describe('límites de Inversiones en Starter (modelo A, 26-nov-2026)', () => {
  it('vienen apagados: con la config de hoy nadie tiene límites', () => {
    expect(config.features.investStarterLimits).toBe(false)
    expect(investLimitsEnabled()).toBe(false)
    expect(currentInvestLimits({ isPro: false, isDemo: false })).toBeNull()
  })

  it('solo true (no un valor parecido) los enciende', () => {
    expect(investLimitsEnabled({ investStarterLimits: 'true' })).toBe(false)
    expect(investLimitsEnabled({ investStarterLimits: 1 })).toBe(false)
    expect(investLimitsEnabled({ investStarterLimits: true })).toBe(true)
  })

  it('encendidos: Starter queda con 1 portafolio, 10 posiciones, 10 seguidos, 3 en Tus tramos, sin importar ni push', () => {
    const lim = investLimitsFor({ enabled: true, isPro: false })
    expect(lim).toEqual({ portfolios: 1, positions: 10, watchlist: 10, tramos: 3, importFile: false, alertPush: false })
    expect(lim).toBe(STARTER_INVEST_LIMITS)
  })

  it('encendidos: Pro y el demo siguen sin límites', () => {
    expect(investLimitsFor({ enabled: true, isPro: true })).toBeNull()
    expect(investLimitsFor({ enabled: true, isDemo: true })).toBeNull()
  })

  describe('reglas', () => {
    const on = investLimitsFor({ enabled: true, isPro: false })
    const off = investLimitsFor({ enabled: false, isPro: false })
    it('posiciones y Siguiendo: hasta 10 con el flag encendido; sin tope apagado', () => {
      expect(canAddMore('positions', 9, on)).toBe(true)
      expect(canAddMore('positions', 10, on)).toBe(false)
      expect(canAddMore('watchlist', 10, on)).toBe(false)
      expect(canAddMore('positions', 500, off)).toBe(true)
      expect(canAddMore('watchlist', 500, off)).toBe(true)
    })
    it('Tus tramos: 3 activos con el flag encendido, todos apagado', () => {
      const list = ['A', 'B', 'C', 'D', 'E']
      expect(splitForTramos(list, on)).toEqual({ shown: ['A', 'B', 'C'], locked: ['D', 'E'] })
      expect(splitForTramos(list, off)).toEqual({ shown: list, locked: [] })
    })
    it('importar CSV/Excel y avisos push de alertas: solo Pro con el flag encendido', () => {
      expect(canImportFile(on)).toBe(false)
      expect(canPushAlerts(on)).toBe(false)
      expect(canImportFile(off)).toBe(true)
      expect(canPushAlerts(off)).toBe(true)
      expect(canImportFile(investLimitsFor({ enabled: true, isPro: true }))).toBe(true)
    })
  })
})
