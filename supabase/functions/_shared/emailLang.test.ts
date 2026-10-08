import { describe, it, expect } from 'vitest'
import { normalizeLang, pickLang, langFromClientReference, langFromStripeSession, langFromStripeSubscription } from './emailLang.ts'

describe('normalizeLang / pickLang', () => {
  it.each([['pt-BR', 'pt'], ['EN', 'en'], ['de_DE', 'de'], ['es', 'es'], ['auto', null], ['fr', null], [null, null], [42, null]])('%s -> %s', (i, o) => {
    expect(normalizeLang(i)).toBe(o)
  })
  it('toma el primer candidato reconocible (también dentro de listas) y cae a es', () => {
    expect(pickLang(null, 'auto', ['fr-FR', 'de-AT'])).toBe('de')
    expect(pickLang(undefined, '', [])).toBe('es')
  })
})

describe('Stripe', () => {
  it('client_reference_id lang_xx', () => {
    expect(langFromClientReference('lang_en')).toBe('en')
    expect(langFromClientReference('lang-pt')).toBe('pt')
    expect(langFromClientReference('cart_123')).toBeNull()
  })
  it('session: client_reference_id gana a locale; locale auto no cuenta', () => {
    expect(langFromStripeSession({ client_reference_id: 'lang_de', locale: 'en' })).toBe('de')
    expect(langFromStripeSession({ locale: 'pt-BR' })).toBe('pt')
    expect(langFromStripeSession({ locale: 'auto' })).toBe('es')
    expect(langFromStripeSession({ locale: 'auto', customer: { preferred_locales: ['en-US'] } })).toBe('en')
    expect(langFromStripeSession({})).toBe('es')
  })
  it('subscription: metadata o customer expandido; si no, es', () => {
    expect(langFromStripeSubscription({ metadata: { lang: 'en' } })).toBe('en')
    expect(langFromStripeSubscription({ customer: { preferred_locales: ['de'] } })).toBe('de')
    expect(langFromStripeSubscription({ customer: 'cus_123' })).toBe('es')
  })
})
