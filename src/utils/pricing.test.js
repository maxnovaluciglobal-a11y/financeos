import { describe, it, expect } from 'vitest'
import config from '../config.js'
import { formatPrice, proPriceVars } from './pricing.js'

describe('pricing', () => {
  it('config.pricing es la fuente única de los precios de Pro', () => {
    expect(config.pricing).toEqual({ proMonthly: 4.99, proAnnual: 39.99, currency: 'USD', trialDays: 14 })
  })

  it.each([
    ['es', '4,99', '39,99'],
    ['pt', '4,99', '39,99'],
    ['de', '4,99', '39,99'],
    ['en', '4.99', '39.99'],
  ])('formatea según el idioma (%s)', (lang, m, y) => {
    expect(proPriceVars(lang)).toEqual({ m, y })
  })

  it('cambiar el precio en la config cambia el texto', () => {
    expect(proPriceVars('en', { proMonthly: 5, proAnnual: 49.5 })).toEqual({ m: '5.00', y: '49.50' })
  })

  it('idioma desconocido cae al formato español', () => {
    expect(formatPrice(4.99, 'xx')).toBe('4,99')
  })
})
