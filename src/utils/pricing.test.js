import { describe, it, expect } from 'vitest'
import config from '../config.js'
import { formatPrice, proPriceVars, withCheckoutLang, checkoutFor, checkoutPlan, checkoutPlanForHref, annualPerMonth, annualSavingPct, BILLING_PERIODS, DEFAULT_BILLING_PERIOD } from './pricing.js'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

describe('pricing', () => {
  it('config.pricing es la fuente única de los precios de Pro', () => {
    expect(config.pricing).toEqual({
      proMonthly: 4.99, proAnnual: 39.99, currency: 'USD', trialDays: 14,
      noCardTrial: true,
      checkoutUrl: 'https://buy.stripe.com/6oU9AM8Ht3aggzi8qZfnO00',
      checkoutUrlAnnual: 'https://buy.stripe.com/3cI14gbTF7qwbeYaz7fnO01',
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

})

describe('withCheckoutLang (idioma del correo de licencia vía client_reference_id)', () => {
  it('agrega lang_xx a un Payment Link de Stripe', () => {
    expect(withCheckoutLang('https://buy.stripe.com/abc', 'en')).toBe('https://buy.stripe.com/abc?client_reference_id=lang_en')
  })
  it('no toca otras URLs, idiomas desconocidos ni un client_reference_id existente', () => {
    // C14: la página de planes de la landing sí cambia al idioma de la interfaz.
    expect(withCheckoutLang('https://moyiq.app/#pricing', 'en')).toBe('https://moyiq.app/en/#pricing')
    expect(withCheckoutLang('https://moyiq.app/', 'en')).toBe('https://moyiq.app/')
    expect(withCheckoutLang('https://buy.stripe.com/abc', 'fr')).toBe('https://buy.stripe.com/abc')
    expect(withCheckoutLang('https://buy.stripe.com/abc?client_reference_id=x', 'de')).toBe('https://buy.stripe.com/abc?client_reference_id=x')
  })
})

// Modelo A (26-nov-2026): la prueba de 14 días es sin tarjeta y se empieza en la
// app; comprar Pro abre los Payment Links SIN prueba (los con prueba con tarjeta,
// …fnO04/…fnO05, ya no se ofrecen; stripe-webhook los sigue reconociendo).
describe('checkoutFor (Pro sin prueba, mensual o anual)', () => {
  const MONTHLY = 'https://buy.stripe.com/6oU9AM8Ht3aggzi8qZfnO00'
  const ANNUAL = 'https://buy.stripe.com/3cI14gbTF7qwbeYaz7fnO01'

  it('el anual es el período por defecto, como en la landing', () => {
    expect(BILLING_PERIODS).toEqual(['annual', 'monthly'])
    expect(DEFAULT_BILLING_PERIOD).toBe('annual')
  })

  it('cada período abre su Payment Link sin prueba; ningún checkout promete prueba', () => {
    expect(checkoutFor('monthly')).toEqual({ trial: false, href: MONTHLY })
    expect(checkoutFor('annual')).toEqual({ trial: false, href: ANNUAL })
  })

  it('un período desconocido cuenta como anual (nunca queda sin link)', () => {
    expect(checkoutFor(undefined).href).toBe(ANNUAL)
    expect(checkoutFor('weekly').href).toBe(ANNUAL)
  })

  it('sin link https real (compilación de tienda) cae a la página de precios', () => {
    const base = { ...config.pricing }
    const fallback = { trial: false, href: 'https://moyiq.app/#pricing' }
    expect(checkoutFor('annual', { ...base, checkoutUrlAnnual: '' })).toEqual(fallback)
    expect(checkoutFor('monthly', { ...base, checkoutUrl: 'http://inseguro' })).toEqual(fallback)
    expect(checkoutFor('annual', { ...base, checkoutUrlAnnual: undefined })).toEqual(fallback)
  })

  it('el link lleva el idioma del correo de licencia (client_reference_id)', () => {
    expect(withCheckoutLang(checkoutFor('annual').href, 'de')).toBe(`${ANNUAL}?client_reference_id=lang_de`)
    expect(withCheckoutLang(checkoutFor('monthly').href, 'en')).toBe(`${MONTHLY}?client_reference_id=lang_en`)
  })

  it('etiqueta del evento: mensual o anual, sin "_trial"', () => {
    expect(checkoutPlan('monthly')).toBe('monthly')
    expect(checkoutPlan('annual')).toBe('annual')
    expect(checkoutPlanForHref(MONTHLY)).toBe('monthly')
    expect(checkoutPlanForHref(ANNUAL)).toBe('annual')
    expect(checkoutPlanForHref('https://moyiq.app/#pricing')).toBe(null)
  })
})

describe('precios del selector anual/mensual (coherentes con la landing)', () => {
  it('anual por mes = 3,33 y ahorro 33 % con los precios de hoy (US$ 4,99 / 39,99)', () => {
    expect(annualPerMonth()).toBe(3.33)
    expect(formatPrice(annualPerMonth(), 'es')).toBe('3,33')
    expect(formatPrice(annualPerMonth(), 'en')).toBe('3.33')
    expect(annualSavingPct()).toBe(33)
  })

  it('se recalcula si cambian los precios de la config', () => {
    expect(annualPerMonth({ proMonthly: 10, proAnnual: 90 })).toBe(7.5)
    expect(annualSavingPct({ proMonthly: 10, proAnnual: 90 })).toBe(25)
  })
})

describe('la app solo ofrece los Payment Links sin prueba', () => {
  const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')
  const files = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.(js|jsx)$/.test(name) && !/\.test\.js$/.test(name)) files.push(full)
    }
  }
  walk(SRC)
  const source = files.map((f) => [f, readFileSync(f, 'utf8')])

  it('los únicos Payment Links en src/ son los dos sin prueba (mensual y anual)', () => {
    const found = new Set()
    for (const [, text] of source) for (const m of text.matchAll(/buy\.stripe\.com\/([A-Za-z0-9]+)/g)) found.add(m[1])
    expect([...found].sort()).toEqual(['3cI14gbTF7qwbeYaz7fnO01', '6oU9AM8Ht3aggzi8qZfnO00'])
  })

  it('PRO_CHECKOUT_URL (el link mensual sin prueba) ya no existe', () => {
    const offenders = source.filter(([, text]) => /PRO_CHECKOUT_URL/.test(text)).map(([f]) => f)
    expect(offenders).toEqual([])
  })
})

describe('checkout atado a la cuenta (C-39 / PRD-2)', () => {
  const ID = '0F8FAD5B-D9CB-469F-A165-70867728950E'
  it('lleva el id de la cuenta y el idioma en client_reference_id y el email precargado', () => {
    const u = new URL(withCheckoutLang('https://buy.stripe.com/abc', 'pt', { id: ID, email: 'ana@ejemplo.com' }))
    expect(u.searchParams.get('client_reference_id')).toBe('u_0f8fad5b-d9cb-469f-a165-70867728950e_lang_pt')
    expect(u.searchParams.get('prefilled_email')).toBe('ana@ejemplo.com')
    expect(u.searchParams.get('client_reference_id')).toMatch(/^[A-Za-z0-9_-]{1,200}$/)
  })
  it('sin cuenta válida queda como antes; un email raro no se manda', () => {
    expect(withCheckoutLang('https://buy.stripe.com/abc', 'es', { id: 'no-uuid', email: 'x' })).toBe('https://buy.stripe.com/abc?client_reference_id=lang_es')
    expect(withCheckoutLang('https://buy.stripe.com/abc', 'es', null)).toBe('https://buy.stripe.com/abc?client_reference_id=lang_es')
    expect(withCheckoutLang('https://moyiq.app/#pricing', 'es', { id: ID, email: 'a@b.co' })).toBe('https://moyiq.app/#pricing')
  })
})
