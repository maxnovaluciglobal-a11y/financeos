// C14 de la auditoría de branding (23-nov-2026): "Ver planes" y "Ayuda" en el
// idioma de la interfaz, con el mismo criterio que cancelUrl().
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { helpUrl, landingLang, pricingUrl, isPricingUrl, PRICING_URLS } from './landingUrls.js'
import { cancelUrl } from './cancelUrl.js'
import { withCheckoutLang, checkoutFor } from './pricing.js'

describe('landingLang', () => {
  it('es y de tienen landing propia; en y pt van a la inglesa; lo desconocido, a la española', () => {
    expect(landingLang('es')).toBe('es')
    expect(landingLang('es-VE')).toBe('es')
    expect(landingLang('de')).toBe('de')
    expect(landingLang('en')).toBe('en')
    expect(landingLang('pt')).toBe('en')
    expect(landingLang('pt_BR')).toBe('en')
    expect(landingLang(undefined)).toBe('es')
    expect(landingLang('fr')).toBe('es')
  })
})

describe('pricingUrl y helpUrl', () => {
  it('planes en el idioma de la interfaz', () => {
    expect(pricingUrl('es')).toBe('https://moyiq.app/#pricing')
    expect(pricingUrl('en')).toBe('https://moyiq.app/en/#pricing')
    expect(pricingUrl('pt')).toBe('https://moyiq.app/en/#pricing')
    expect(pricingUrl('de')).toBe('https://moyiq.app/de/#pricing')
  })
  it('ayuda: página propia en español, preguntas frecuentes de la portada en inglés y alemán', () => {
    expect(helpUrl('es')).toBe('https://moyiq.app/ayuda.html')
    expect(helpUrl('en')).toBe('https://moyiq.app/en/#faq')
    expect(helpUrl('pt')).toBe('https://moyiq.app/en/#faq')
    expect(helpUrl('de')).toBe('https://moyiq.app/de/#faq')
  })
  it('el portugués va a la misma landing que la página de cancelación', () => {
    expect(new URL(pricingUrl('pt')).pathname).toBe(new URL(cancelUrl('pt')).pathname.replace(/[^/]+$/, ''))
  })
  it('isPricingUrl reconoce las tres y nada más', () => {
    for (const u of Object.values(PRICING_URLS)) expect(isPricingUrl(u)).toBe(true)
    expect(isPricingUrl('https://moyiq.app/')).toBe(false)
    expect(isPricingUrl(null)).toBe(false)
  })
})

describe('withCheckoutLang con la página de planes', () => {
  const off = { checkoutUrl: '', checkoutUrlAnnual: '' }
  it('sin links de pago (compilación de tienda), el fallback de checkoutFor sale en el idioma de la interfaz', () => {
    expect(withCheckoutLang(checkoutFor('annual', off).href, 'en')).toBe('https://moyiq.app/en/#pricing')
    expect(withCheckoutLang(checkoutFor('monthly', off).href, 'de')).toBe('https://moyiq.app/de/#pricing')
    expect(withCheckoutLang(checkoutFor('annual', off).href, 'pt')).toBe('https://moyiq.app/en/#pricing')
    expect(withCheckoutLang(checkoutFor('annual', off).href, 'es')).toBe('https://moyiq.app/#pricing')
  })
  it('una URL de planes de otro idioma también se corrige', () => {
    expect(withCheckoutLang('https://moyiq.app/de/#pricing', 'es')).toBe('https://moyiq.app/#pricing')
  })
  it('otras URLs no se tocan', () => {
    expect(withCheckoutLang('https://moyiq.app/', 'en')).toBe('https://moyiq.app/')
  })
})

describe('ningún componente escribe a mano la página de planes o de ayuda', () => {
  const SRC = fileURLToPath(new URL('..', import.meta.url))
  const files = []
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(jsx?|tsx?)$/.test(n) && !/\.test\./.test(n) && !p.endsWith('landingUrls.js')) files.push(p)
    }
  }
  walk(SRC)
  it('moyiq.app/#pricing y moyiq.app/ayuda.html solo viven en landingUrls.js', () => {
    const bad = files.filter((f) => {
      const code = readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\{\/\*)/.test(l)).join('\n')
      return /['"`]https:\/\/moyiq\.app\/(#pricing|ayuda\.html)/.test(code)
    })
    expect(bad).toEqual([])
  })
})
