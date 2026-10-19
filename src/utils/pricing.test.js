import { describe, it, expect } from 'vitest'
import config from '../config.js'
import { formatPrice, proPriceVars, proCta, withCheckoutLang, checkoutFor, annualPerMonth, annualSavingPct, BILLING_PERIODS, DEFAULT_BILLING_PERIOD } from './pricing.js'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

describe('pricing', () => {
  it('config.pricing es la fuente única de los precios de Pro', () => {
    expect(config.pricing).toEqual({
      proMonthly: 4.99, proAnnual: 39.99, currency: 'USD', trialDays: 14,
      trialEnabled: true,
      trialCheckoutUrl: 'https://buy.stripe.com/fZudR2f5R26c96Qaz7fnO04',
      trialCheckoutUrlAnnual: 'https://buy.stripe.com/cNi4gs8Ht8uAfvecHffnO05',
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
    it('con trialEnabled false el CTA es el de siempre', () => {
      expect(proCta({ ...config.pricing, trialEnabled: false })).toEqual({ trial: false, href: 'https://moyiq.app/#pricing', labelKey: 'pro.gate.cta' })
    })
    it('la config de producción ofrece la prueba con el link mensual de 14 días', () => {
      expect(proCta(config.pricing)).toEqual({ trial: true, href: 'https://buy.stripe.com/fZudR2f5R26c96Qaz7fnO04', labelKey: 'pro.gate.trialCta' })
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

// Auditoría 360, C-03 / COM-3: LicenseGate (primera pantalla de plan de cada alta
// nueva) y Ajustes abrían el Payment Link SIN prueba de 14 días y sin opción
// anual. Los links con prueba son los mismos que la landing (moyiq.app/#pricing).
describe('checkoutFor (Pro con prueba, mensual o anual)', () => {
  const MONTHLY = 'https://buy.stripe.com/fZudR2f5R26c96Qaz7fnO04'
  const ANNUAL = 'https://buy.stripe.com/cNi4gs8Ht8uAfvecHffnO05'

  it('el anual es el período por defecto, como en la landing', () => {
    expect(BILLING_PERIODS).toEqual(['annual', 'monthly'])
    expect(DEFAULT_BILLING_PERIOD).toBe('annual')
  })

  it('cada período abre su Payment Link CON prueba', () => {
    expect(checkoutFor('monthly')).toEqual({ trial: true, href: MONTHLY })
    expect(checkoutFor('annual')).toEqual({ trial: true, href: ANNUAL })
  })

  it('un período desconocido cuenta como anual (nunca queda sin link)', () => {
    expect(checkoutFor(undefined).href).toBe(ANNUAL)
    expect(checkoutFor('weekly').href).toBe(ANNUAL)
  })

  it('con la prueba apagada o sin link https real cae a la página de precios, sin prometer prueba', () => {
    const base = { ...config.pricing }
    const fallback = { trial: false, href: 'https://moyiq.app/#pricing' }
    expect(checkoutFor('annual', { ...base, trialEnabled: false })).toEqual(fallback)
    expect(checkoutFor('annual', { ...base, trialEnabled: 'true' })).toEqual(fallback)
    expect(checkoutFor('annual', { ...base, trialCheckoutUrlAnnual: '' })).toEqual(fallback)
    expect(checkoutFor('monthly', { ...base, trialCheckoutUrl: 'http://inseguro' })).toEqual(fallback)
    expect(checkoutFor('annual', { ...base, trialCheckoutUrlAnnual: undefined })).toEqual(fallback)
  })

  it('el link lleva el idioma del correo de licencia (client_reference_id)', () => {
    expect(withCheckoutLang(checkoutFor('annual').href, 'de')).toBe(`${ANNUAL}?client_reference_id=lang_de`)
    expect(withCheckoutLang(checkoutFor('monthly').href, 'en')).toBe(`${MONTHLY}?client_reference_id=lang_en`)
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

describe('la app solo ofrece Payment Links con prueba', () => {
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

  it('los únicos Payment Links en src/ son los dos con prueba de 14 días', () => {
    const found = new Set()
    for (const [, text] of source) for (const m of text.matchAll(/buy\.stripe\.com\/([A-Za-z0-9]+)/g)) found.add(m[1])
    expect([...found].sort()).toEqual(['cNi4gs8Ht8uAfvecHffnO05', 'fZudR2f5R26c96Qaz7fnO04'])
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
