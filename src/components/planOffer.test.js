// LicenseGate (primera pantalla de plan de cada alta nueva) y la tarjeta de Ajustes
// ofrecen Pro con la prueba de 14 días y el selector anual/mensual, igual que la
// landing (auditoría 360, C-03 / COM-3). Se renderizan con renderToStaticMarkup, sin
// DOM: useT se reemplaza por el traductor real fijado a un idioma.
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('../i18n/useT.js', async () => {
  const { translate } = await import('../i18n/translate.js')
  const useT = () => {
    const lang = globalThis.__TEST_LANG || 'es'
    return { t: (key, vars) => translate(lang, key, vars), lang }
  }
  return { useT, useTFor: useT }
})

const { loadLang } = await import('../i18n/langCache.js')
const { translate } = await import('../i18n/translate.js')
const { default: LicenseGate } = await import('./LicenseGate.jsx')
const { default: UpgradeCard } = await import('../pages/Settings/UpgradeCard.jsx')
const { default: config } = await import('../config.js')

const LANGS = ['es', 'en', 'pt', 'de']
const PERIOD_PRICE = { es: '3,33', en: '3.33', pt: '3,33', de: '3,33' }
const ANNUAL_PRICE = { es: '39,99', en: '39.99', pt: '39,99', de: '39,99' }
const MONTHLY_PRICE = { es: '4,99', en: '4.99', pt: '4,99', de: '4,99' }

const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/\s+/g, ' ')
const renderGate = (lang) => {
  globalThis.__TEST_LANG = lang
  return renderToStaticMarkup(createElement(LicenseGate, { onActivate() {}, userEmail: 'a@b.co', userId: 'u1' }))
}
const renderCard = (lang) => {
  globalThis.__TEST_LANG = lang
  return renderToStaticMarkup(createElement(UpgradeCard, { subStyle: {} }))
}
const t = (lang, key, vars) => translate(lang, key, vars)

beforeAll(async () => { await Promise.all(['en', 'pt', 'de'].map(loadLang)) })

describe.each(LANGS)('LicenseGate · %s', (lang) => {
  it('ofrece Pro con la prueba de 14 días: insignia, cobro del anual y primer cobro el día 15', () => {
    const out = text(renderGate(lang))
    expect(out).toContain(t(lang, 'billing.trialBadge', { days: 14 }))
    expect(out).toContain(t(lang, 'billing.then.annual', { y: ANNUAL_PRICE[lang], m: MONTHLY_PRICE[lang] }))
    expect(out).toContain(t(lang, 'billing.trialNote', { next: 15 }))
  })

  it('el anual viene preseleccionado y el precio grande es el mensual equivalente (US$ 3,33)', () => {
    const html = renderGate(lang)
    const out = text(html)
    expect(out).toContain(`US$ ${PERIOD_PRICE[lang]}`)
    expect(out).not.toContain(`US$ ${MONTHLY_PRICE[lang]}`)
    const annualLabel = `${t(lang, 'billing.period.annual')} ${t(lang, 'billing.period.save', { pct: 33 })}`
    expect(html).toMatch(new RegExp(`aria-pressed="true"[^>]*>${annualLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<`))
    expect(html).toMatch(new RegExp(`aria-pressed="false"[^>]*>${t(lang, 'billing.period.monthly')}<`))
    expect(html).toContain(`aria-label="${t(lang, 'billing.period.label')}"`)
  })

  it('no filtra claves sin traducir', () => {
    expect(text(renderGate(lang))).not.toMatch(/\b(billing|licenseGate|settings)\.[a-zA-Z]+/)
  })
})

describe.each(LANGS)('Tarjeta "Probar Pro" de Ajustes · %s', (lang) => {
  it('título, botón y notas hablan de la prueba de 14 días con el anual preseleccionado', () => {
    const html = renderCard(lang)
    const out = text(html)
    expect(out).toContain(t(lang, 'settings.upgrade.title', { days: 14 }))
    expect(out).toContain(t(lang, 'settings.upgrade.btn', { days: 14 }))
    expect(out).toContain(t(lang, 'billing.then.annual', { y: ANNUAL_PRICE[lang], m: MONTHLY_PRICE[lang] }))
    expect(out).toContain(t(lang, 'billing.trialNote', { next: 15 }))
    expect(html).toMatch(/aria-pressed="true"/)
    expect(out).not.toMatch(/\b(billing|licenseGate|settings)\.[a-zA-Z]+/)
  })
})

describe('sin prueba en la config', () => {
  it('LicenseGate no promete prueba ni muestra el selector (tarjeta mensual de siempre)', () => {
    const saved = { ...config.pricing }
    config.pricing.trialEnabled = false
    try {
      const html = renderGate('es')
      const out = text(html)
      expect(out).toContain(`US$ ${MONTHLY_PRICE.es}`)
      expect(out).not.toContain(t('es', 'billing.trialBadge', { days: 14 }))
      expect(out).not.toContain(t('es', 'billing.trialNote', { next: 15 }))
      expect(html).not.toContain('aria-pressed')
    } finally { Object.assign(config.pricing, saved) }
  })

  it('la tarjeta de Ajustes vuelve al título y botón genéricos', () => {
    const saved = { ...config.pricing }
    config.pricing.trialEnabled = false
    try {
      const out = text(renderCard('es'))
      expect(out).toContain(t('es', 'menu.upgrade.title'))
      expect(out).not.toContain(t('es', 'settings.upgrade.title', { days: 14 }))
    } finally { Object.assign(config.pricing, saved) }
  })
})
