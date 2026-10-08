import { describe, it, expect } from 'vitest'
import { regionDefaults, languageForCountry } from './region.js'

describe('regionDefaults (primer arranque)', () => {
  it.each([
    [['en-US', 'en'], { language: 'en', country: 'US', currency: 'USD' }],
    [['de-DE'], { language: 'de', country: 'DE', currency: 'EUR' }],
    [['pt-PT'], { language: 'pt', country: 'PT', currency: 'EUR' }],
    [['es-MX'], { language: 'es', country: 'MX', currency: 'MXN' }],
    [['es-AR', 'en'], { language: 'es', country: 'AR', currency: 'ARS' }],
    [['es-CO'], { language: 'es', country: 'CO', currency: 'COP' }],
    ['en_US', { language: 'en', country: 'US', currency: 'USD' }],
  ])('%j', (input, out) => {
    expect(regionDefaults(input)).toEqual(out)
  })

  it('región que la app no ofrece: idioma sí, país "Otro" en USD (no Chile)', () => {
    expect(regionDefaults(['en-GB'])).toEqual({ language: 'en', country: 'OTHER', currency: 'USD' })
    expect(regionDefaults(['pt-BR'])).toEqual({ language: 'pt', country: 'OTHER', currency: 'USD' })
  })

  it('español sin región reconocible no toca país ni moneda', () => {
    expect(regionDefaults(['es-419'])).toEqual({ language: 'es' })
    expect(regionDefaults(['es'])).toEqual({ language: 'es' })
  })

  it('idioma no soportado cae a español y no inventa país', () => {
    expect(regionDefaults(['fr-FR'])).toEqual({ language: 'es' })
    expect(regionDefaults([])).toEqual({ language: 'es' })
  })

  it('la región del primer locale manda aunque el idioma salga de otro', () => {
    expect(regionDefaults(['fr-DE', 'de'])).toEqual({ language: 'de', country: 'DE', currency: 'EUR' })
  })
})

describe('languageForCountry', () => {
  it.each([['US', 'en'], ['DE', 'de'], ['PT', 'pt'], ['CL', 'es'], ['ES', 'es'], ['VE', 'es'], ['OTHER', null], ['ZZ', null], [undefined, null]])(
    '%s -> %s', (c, l) => expect(languageForCountry(c)).toBe(l))
})
