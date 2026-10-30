import { describe, it, expect } from 'vitest'
import { refEligible, savedRate, cachedRate, resolveRefRate, toRef, isStale, rateAgeDays, rateOptions, loadersFor, rateToolFor, defaultRateOption, CACHE_KEYS } from './refRate.js'

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

describe('tasa preseleccionada al consultar (decisión: BCV oficial en VE)', () => {
  it('VE: queda elegida la oficial del BCV y el paralelo sigue como opción', () => {
    const ve = { oficial: 874.73, paralelo: 990, paraleloDisponible: true, ts: 9, source: 'api' }
    const opts = rateOptions({ country: 'VE', currency: 'VES' }, { ve })
    expect(defaultRateOption(opts)).toEqual({ source: 'bcv', rate: 874.73, at: 9 })
    expect(opts.map(o => o.source)).toContain('paralelo')
  })
  it('fuera de VE no se preselecciona nada', () => {
    const ar = { oficial: 1500, blue: 1545, mep: 1521, ts: 3, source: 'api' }
    expect(defaultRateOption(rateOptions({ country: 'AR', currency: 'ARS' }, { ar }))).toBe(null)
    expect(defaultRateOption([])).toBe(null)
  })
})

describe('B1: una sola tasa, descrita igual en todos lados', () => {
  it('rateLabelParts: fuente y fecha; guardada sin fecha = "Tasa guardada" sin fecha', async () => {
    const { rateLabelParts } = await import('./refRate.js')
    expect(rateLabelParts(savedRate({ usdRate: 885.4, usdRateAt: 10, usdRateSource: 'bcv' }))).toEqual({ sourceKey: 'refcur.source.bcv', at: 10 })
    // El caso del bug: Ajustes decía "Fixer" y el Inicio "sin fecha" para la misma tasa.
    expect(rateLabelParts(savedRate({ usdRate: 36 }))).toEqual({ sourceKey: 'refcur.source.legacy', at: null })
    expect(rateLabelParts(savedRate({ usdRate: 900, usdRateAt: 10 }))).toEqual({ sourceKey: 'refcur.source.manual', at: 10 })
    expect(rateLabelParts(null)).toBe(null)
  })

  it('fresherRate: solo si la actual está vieja o sin fecha, y la nueva es posterior y distinta', async () => {
    const { fresherRate } = await import('./refRate.js')
    const now = 100 * DAY
    const opts = [
      { source: 'bcv', rate: 900, at: now - DAY / 2 },
      { source: 'paralelo', rate: 1010, at: now - DAY / 2 },
    ]
    // Vigente (VE: ≤ 1 día) → no se ofrece nada.
    expect(fresherRate({ rate: 880, at: now - DAY / 4, source: 'bcv' }, opts, 'VE', now)).toBe(null)
    // Vieja → la misma fuente que la actual.
    expect(fresherRate({ rate: 880, at: now - 5 * DAY, source: 'paralelo' }, opts, 'VE', now)).toEqual(opts[1])
    // Vieja de fuente propia → la oficial del BCV.
    expect(fresherRate({ rate: 880, at: now - 5 * DAY, source: 'manual' }, opts, 'VE', now)).toEqual(opts[0])
    // Sin fecha → se ofrece la consultada (con su fecha).
    expect(fresherRate({ rate: 36, at: null, source: 'legacy' }, opts, 'VE', now)).toEqual(opts[0])
    // Mismo valor → no es "más reciente".
    expect(fresherRate({ rate: 900, at: null, source: 'legacy' }, opts, 'VE', now)).toBe(null)
    // Consultada más vieja que la actual → nada.
    expect(fresherRate({ rate: 880, at: now - DAY / 4 + 1, source: 'bcv' }, [{ source: 'bcv', rate: 900, at: now - 3 * DAY }], 'VE', now + 3 * DAY)).toBe(null)
    // Sin opciones (sin red) → nada.
    expect(fresherRate({ rate: 880, at: null, source: 'legacy' }, [], 'VE', now)).toBe(null)
  })

  it('fresherRate en AR prefiere el oficial; en el resto, Fixer con 7 días de margen', async () => {
    const { fresherRate } = await import('./refRate.js')
    const now = 100 * DAY
    const ar = [{ source: 'blue', rate: 1545, at: now }, { source: 'oficial', rate: 1510, at: now }]
    expect(fresherRate({ rate: 1400, at: now - 3 * DAY, source: 'manual' }, ar, 'AR', now)).toEqual(ar[1])
    const fx = [{ source: 'fixer', rate: 950, at: now }]
    expect(fresherRate({ rate: 940, at: now - 3 * DAY, source: 'fixer' }, fx, 'CL', now)).toBe(null)
    expect(fresherRate({ rate: 940, at: now - 8 * DAY, source: 'fixer' }, fx, 'CL', now)).toEqual(fx[0])
  })

  it('ratePatch guarda tasa, fecha y fuente', async () => {
    const { ratePatch } = await import('./refRate.js')
    expect(ratePatch({ source: 'bcv', rate: 900, at: 7 })).toEqual({ usdRate: 900, usdRateAt: 7, usdRateSource: 'bcv' })
    expect(ratePatch(null)).toBe(null)
    expect(ratePatch({ source: 'bcv', rate: 0, at: 7 })).toBe(null)
  })
})

describe('rial #20: euro como moneda de referencia', () => {
  const fixer = (ts = 5 * DAY) => ({ [CACHE_KEYS.FIXER]: { source: 'fixer', ts, rates: { USD: 1, EUR: 0.8, CLP: 950, VES: 36 } } })

  it('sin refCurrency todo sigue en US$ (compatibilidad)', async () => {
    const { lensCurrency, resolveLensRate } = await import('./refRate.js')
    const settings = { country: 'VE', currency: 'VES', usdRate: 885.4, usdRateAt: 10 * DAY, usdRateSource: 'bcv' }
    expect(lensCurrency(settings)).toBe('USD')
    expect(lensCurrency({ ...settings, refCurrency: 'XYZ' })).toBe('USD')
    // resolveRefRate no cambia con la lente: la tasa guardada sigue siendo por 1 US$.
    expect(resolveRefRate({ ...settings, refCurrency: 'EUR' })).toEqual({ rate: 885.4, at: 10 * DAY, source: 'bcv' })
    expect(resolveLensRate(settings, store(fixer()))).toEqual({ rate: 885.4, at: 10 * DAY, source: 'bcv', ref: 'USD' })
    expect(refEligible({ ...settings, refCurrency: 'EUR' })).toBe(true)
  })

  it('una cuenta en euros no puede mirarse en euros', async () => {
    const { lensCurrency, eurSelectable } = await import('./refRate.js')
    expect(lensCurrency({ country: 'DE', currency: 'EUR', refCurrency: 'EUR' })).toBe('USD')
    expect(eurSelectable({ country: 'DE', currency: 'EUR', showDualCurrency: true })).toBe(false)
    expect(eurSelectable({ country: 'VE', currency: 'VES' })).toBe(true)
    expect(eurSelectable({ country: 'CL', currency: 'CLP' })).toBe(false) // sin lente activada
  })

  it('VE: Bs por 1 € = BCV ÷ (€ por 1 US$ de Fixer), con la fecha más vieja', async () => {
    const { resolveLensRate, lensLabelParts } = await import('./refRate.js')
    const settings = { country: 'VE', currency: 'VES', refCurrency: 'EUR', usdRate: 880, usdRateAt: 10 * DAY, usdRateSource: 'bcv' }
    const r = resolveLensRate(settings, store(fixer(5 * DAY)))
    expect(r.ref).toBe('EUR')
    expect(r.rate).toBeCloseTo(1100, 6) // 880 / 0,8
    expect(r.at).toBe(5 * DAY)
    expect(r.via.base).toEqual({ rate: 880, at: 10 * DAY, source: 'bcv' })
    expect(r.via.eurUsd).toEqual({ rate: 0.8, at: 5 * DAY })
    expect(lensLabelParts(r)).toEqual({ sourceKey: 'refcur.source.crossEur', baseKey: 'refcur.source.bcv', at: 5 * DAY })
  })

  it('AR cruza su dólar con Fixer igual; una tasa base sin fecha deja el cruce sin fecha', async () => {
    const { resolveLensRate } = await import('./refRate.js')
    const r = resolveLensRate({ country: 'AR', currency: 'ARS', refCurrency: 'EUR', usdRate: 1200 }, store(fixer()))
    expect(r.rate).toBeCloseTo(1500, 6)
    expect(r.at).toBe(null)
    expect(r.via.base.source).toBe('legacy')
  })

  it('el resto: moneda local por 1 € directo de Fixer', async () => {
    const { resolveLensRate, lensLabelParts } = await import('./refRate.js')
    const r = resolveLensRate({ country: 'CL', currency: 'CLP', showDualCurrency: true, refCurrency: 'EUR', usdRate: 900, usdRateAt: DAY }, store(fixer(3 * DAY)))
    expect(r).toEqual({ rate: 950 / 0.8, at: 3 * DAY, source: 'fixer', ref: 'EUR' })
    expect(lensLabelParts(r)).toEqual({ sourceKey: 'refcur.source.fixer', at: 3 * DAY })
  })

  it('sin Fixer en caché (o con su respaldo sin red) la lente vuelve a US$ y lo marca', async () => {
    const { resolveLensRate } = await import('./refRate.js')
    const settings = { country: 'VE', currency: 'VES', refCurrency: 'EUR', usdRate: 880, usdRateAt: DAY, usdRateSource: 'bcv' }
    expect(resolveLensRate(settings, store({}))).toEqual({ rate: 880, at: DAY, source: 'bcv', ref: 'USD', wanted: 'EUR' })
    const fallback = { [CACHE_KEYS.FIXER]: { source: 'fallback', ts: DAY, rates: { EUR: 0.92 } } }
    expect(resolveLensRate(settings, store(fallback)).ref).toBe('USD')
    // Sin tasa en US$ (ni guardada ni en caché), no hay lente.
    expect(resolveLensRate({ country: 'VE', currency: 'VES', refCurrency: 'EUR' }, store({}))).toBe(null)
  })

  it('crossToEur descarta tasas inválidas', async () => {
    const { crossToEur } = await import('./refRate.js')
    expect(crossToEur({ rate: 0, at: 1 }, { rate: 0.8, at: 1 })).toBe(null)
    expect(crossToEur({ rate: 10, at: 1 }, { rate: 0, at: 1 })).toBe(null)
    expect(crossToEur(null, { rate: 0.8, at: 1 })).toBe(null)
  })
})
