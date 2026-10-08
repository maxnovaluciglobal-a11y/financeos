import { describe, it, expect } from 'vitest'
import config from '../config.js'
import { formatPrice, proPriceVars, proCta, withCheckoutLang } from './pricing.js'

describe('pricing', () => {
  it('config.pricing es la fuente única de los precios de Pro', () => {
    expect(config.pricing).toEqual({
      proMonthly: 4.99, proAnnual: 39.99, currency: 'USD', trialDays: 14,
      trialEnabled: false, trialCheckoutUrl: null,
    })
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

  describe('proCta (T10)', () => {
    const base = { proMonthly: 4.99, proAnnual: 39.99, trialDays: 14 }
    it('por defecto (trialEnabled false) el CTA es el de siempre', () => {
      expect(proCta(config.pricing)).toEqual({ trial: false, href: 'https://moyiq.app/#pricing', labelKey: 'pro.gate.cta' })
    })
    it('con la prueba habilitada pero sin URL, cae al CTA de siempre', () => {
      expect(proCta({ ...base, trialEnabled: true, trialCheckoutUrl: null }).trial).toBe(false)
      expect(proCta({ ...base, trialEnabled: true, trialCheckoutUrl: '' }).trial).toBe(false)
      expect(proCta({ ...base, trialEnabled: true, trialCheckoutUrl: 'http://inseguro' }).trial).toBe(false)
    })
    it('solo trialEnabled === true habilita la prueba (no un valor truthy cualquiera)', () => {
      expect(proCta({ ...base, trialEnabled: 'true', trialCheckoutUrl: 'https://buy.stripe.com/x' }).trial).toBe(false)
    })
    it('habilitada y con URL https: "Probar 14 días" hacia el checkout de prueba', () => {
      expect(proCta({ ...base, trialEnabled: true, trialCheckoutUrl: 'https://buy.stripe.com/x' }))
        .toEqual({ trial: true, href: 'https://buy.stripe.com/x', labelKey: 'pro.gate.trialCta' })
    })
  })
})

describe('withCheckoutLang (idioma del correo de licencia vía client_reference_id)', () => {
  it('agrega lang_xx a un Payment Link de Stripe', () => {
    expect(withCheckoutLang('https://buy.stripe.com/abc', 'en')).toBe('https://buy.stripe.com/abc?client_reference_id=lang_en')
  })
  it('no toca otras URLs, idiomas desconocidos ni un client_reference_id existente', () => {
    expect(withCheckoutLang('https://moyiq.app/#pricing', 'en')).toBe('https://moyiq.app/#pricing')
    expect(withCheckoutLang('https://buy.stripe.com/abc', 'fr')).toBe('https://buy.stripe.com/abc')
    expect(withCheckoutLang('https://buy.stripe.com/abc?client_reference_id=x', 'de')).toBe('https://buy.stripe.com/abc?client_reference_id=x')
  })
})
