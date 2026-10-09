import { describe, it, expect } from 'vitest'
import { refEligible, savedRate, cachedRate, resolveRefRate, toRef, isStale, rateAgeDays, rateOptions, loadersFor, rateToolFor, CACHE_KEYS } from './refRate.js'

const store = (obj) => (k) => (k in obj ? JSON.stringify(obj[k]) : null)
const DAY = 86400000

describe('refEligible (R12)', () => {
  it('VE y AR siempre, salvo que ya usen USD', () => {
    expect(refEligible({ country: 'VE', currency: 'VES' })).toBe(true)
    expect(refEligible({ country: 'AR', currency: 'ARS' })).toBe(true)
    expect(refEligible({ country: 'VE', currency: 'USD' })).toBe(false)
  })
  it('el resto solo con "Mostrar equivalente en USD"', () => {
    expect(refEligible({ country: 'CL', currency: 'CLP' })).toBe(false)
    expect(refEligible({ country: 'CL', currency: 'CLP', showDualCurrency: true })).toBe(true)
  })
})

describe('de dónde sale la tasa: nunca inventada', () => {
  it('la guardada por el usuario, con su fecha y fuente', () => {
    expect(savedRate({ usdRate: 900, usdRateAt: 5, usdRateSource: 'bcv' })).toEqual({ rate: 900, at: 5, source: 'bcv' })
  })
  it('una tasa vieja sin fecha se marca "legacy" (sin fecha)', () => {
    expect(savedRate({ usdRate: 36 })).toEqual({ rate: 36, at: null, source: 'legacy' })
  })
  it('0 o vacío no es una tasa', () => {
    expect(savedRate({ usdRate: 0 })).toBe(null)
    expect(savedRate({})).toBe(null)
  })
  it('sin tasa propia, usa la última consulta en caché con SU fecha (aunque esté vencida)', () => {
    const read = store({ [CACHE_KEYS.VE]: { oficial: 874.73, paralelo: 990, ts: 1000, source: 'api' } })
    expect(cachedRate({ country: 'VE', currency: 'VES' }, read)).toEqual({ rate: 874.73, at: 1000, source: 'bcv' })
  })
  it('nunca usa los valores fijos de respaldo (fallback sin red)', () => {
    const read = store({ [CACHE_KEYS.VE]: { oficial: 771, ts: 1000, source: 'fallback' } })
    expect(cachedRate({ country: 'VE', currency: 'VES' }, read)).toBe(null)
    expect(resolveRefRate({ country: 'VE', currency: 'VES' }, read)).toBe(null)
  })
  it('la caché de VE no aplica si la moneda principal no es VES', () => {
    const read = store({ [CACHE_KEYS.VE]: { oficial: 874, ts: 1, source: 'api' } })
    expect(cachedRate({ country: 'VE', currency: 'EUR' }, read)).toBe(null)
  })
  it('Fixer (proxy propio) para el resto de monedas', () => {
    const read = store({ [CACHE_KEYS.FIXER]: { rates: { CLP: 950.5 }, ts: 7, source: 'fixer' } })
    expect(cachedRate({ country: 'CL', currency: 'CLP' }, read)).toEqual({ rate: 950.5, at: 7, source: 'fixer' })
  })
  it('la del usuario gana sobre la caché', () => {
    const read = store({ [CACHE_KEYS.AR]: { oficial: 1500, ts: 1, source: 'api' } })
    expect(resolveRefRate({ country: 'AR', currency: 'ARS', usdRate: 1600, usdRateAt: 2, usdRateSource: 'blue' }, read).rate).toBe(1600)
  })
})

describe('conversión y antigüedad', () => {
  it('toRef divide por la tasa', () => {
    expect(toRef(1749.46, 874.73)).toBeCloseTo(2, 5)
    expect(toRef(100, 0)).toBe(null)
  })
  it('vieja: >1 día en VE/AR, >7 en el resto; sin fecha siempre', () => {
    const now = 10 * DAY
    expect(rateAgeDays(now - 2 * DAY, now)).toBe(2)
    expect(isStale(now - 2 * DAY, 'VE', now)).toBe(true)
    expect(isStale(now - 2 * DAY, 'CL', now)).toBe(false)
    expect(isStale(now - 1000, 'VE', now)).toBe(false)
    expect(isStale(null, 'CL', now)).toBe(true)
  })
})

describe('rateOptions: qué se ofrece al consultar la tasa de hoy', () => {
  it('VE: BCV y paralelo (si existe), con la hora de la consulta', () => {
    const ve = { oficial: 874.73, paralelo: 990, paraleloDisponible: true, ts: 9, source: 'api' }
    expect(rateOptions({ country: 'VE', currency: 'VES' }, { ve })).toEqual([
      { source: 'bcv', rate: 874.73, at: 9 }, { source: 'paralelo', rate: 990, at: 9 },
    ])
  })
  it('sin red (fallback) no ofrece nada: hay que escribirla a mano', () => {
    const ve = { oficial: 771, paralelo: 865, paraleloDisponible: true, ts: 9, source: 'fallback' }
    expect(rateOptions({ country: 'VE', currency: 'VES' }, { ve })).toEqual([])
  })
  it('AR: oficial, blue y MEP', () => {
    const ar = { oficial: 1500, blue: 1545, mep: 1521, ts: 3, source: 'api' }
    expect(rateOptions({ country: 'AR', currency: 'ARS' }, { ar }).map(o => o.source)).toEqual(['oficial', 'blue', 'mep'])
  })
  it('loadersFor y la herramienta de tasa por país (R13)', () => {
    expect(loadersFor({ country: 'VE', currency: 'VES' })).toEqual(['ve'])
    expect(loadersFor({ country: 'AR', currency: 'ARS' })).toEqual(['ar'])
    expect(loadersFor({ country: 'CL', currency: 'CLP' })).toEqual(['fixer'])
    expect(rateToolFor('ve')).toBe('multimoneda')
    expect(rateToolFor('AR')).toBe('multidolar')
    expect(rateToolFor('CL')).toBe(null)
  })
})
