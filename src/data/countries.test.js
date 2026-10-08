import { describe, it, expect } from 'vitest'
import { COUNTRIES, PRIMARY_COUNTRIES, suggestedCurrency, templateForCountry } from './countries.js'
import TEMPLATES from './templates.js'
import config from '../config.js'
import { es } from '../i18n/es.js'
import { en } from '../i18n/en.js'
import { pt } from '../i18n/pt.js'
import { de } from '../i18n/de.js'

describe('countries', () => {
  it('cada país sugiere una moneda que la app ofrece', () => {
    const codes = config.currencies.map(c => c.code)
    for (const c of COUNTRIES) expect(codes).toContain(c.currency)
  })

  it('los países principales existen en la lista', () => {
    for (const p of PRIMARY_COUNTRIES) expect(COUNTRIES.some(c => c.code === p)).toBe(true)
  })

  it('cada país tiene nombre en los 4 idiomas', () => {
    for (const c of COUNTRIES) {
      for (const d of [es, en, pt, de]) expect(d[`country.${c.code}`], c.code).toBeTruthy()
    }
  })

  it('suggestedCurrency usa el mapa y USD si el país no existe', () => {
    expect(suggestedCurrency('CO')).toBe('COP')
    expect(suggestedCurrency('DE')).toBe('EUR')
    expect(suggestedCurrency('ZZ')).toBe('USD')
  })

  it('templateForCountry devuelve siempre una plantilla existente', () => {
    for (const c of [...COUNTRIES.map(c => c.code), 'ZZ']) {
      expect(TEMPLATES.some(t => t.id === templateForCountry(c))).toBe(true)
    }
    expect(templateForCountry('CL')).toBe('personal')
  })
})
