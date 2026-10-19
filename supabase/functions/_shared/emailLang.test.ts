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

describe('client_reference_id con la cuenta (C-39 / PRD-2)', () => {
  it('lee el idioma y el id de la cuenta de u_<uuid>_lang_xx', async () => {
    const { userIdFromClientReference } = await import('./emailLang.ts')
    const ref = 'u_0f8fad5b-d9cb-469f-a165-70867728950e_lang_pt'
    expect(langFromClientReference(ref)).toBe('pt')
    expect(userIdFromClientReference(ref)).toBe('0f8fad5b-d9cb-469f-a165-70867728950e')
    expect(userIdFromClientReference('lang_en')).toBeNull()
    for (const bad of ['u_123_lang_es', 'u_0f8fad5b-d9cb-469f-a165-70867728950e', 'u__lang_es', null, 7]) {
      expect(userIdFromClientReference(bad)).toBeNull()
    }
  })
})
