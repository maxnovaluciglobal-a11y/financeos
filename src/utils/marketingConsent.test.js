import { describe, it, expect } from 'vitest'
import { MARKETING_DOI_ENABLED, withStarterConsent, shouldRequestOptin, OPTIN_SOURCES } from './marketingConsent.js'

describe('MARKETING_DOI_ENABLED', () => {
  it('apagado hasta aplicar 20261010010000_marketing_double_optin.sql y deployar send-optin-confirmation', () => {
    expect(MARKETING_DOI_ENABLED).toBe(false)
  })
})

describe('withStarterConsent', () => {
  const params = { p_email: 'a@b.com', p_lang: 'es' }

  it('flag encendido: agrega p_consent_marketing como booleano estricto', () => {
    expect(withStarterConsent(params, true, true)).toEqual({ ...params, p_consent_marketing: true })
    expect(withStarterConsent(params, false, true)).toEqual({ ...params, p_consent_marketing: false })
    expect(withStarterConsent(params, undefined, true).p_consent_marketing).toBe(false)
    expect(withStarterConsent(params, 'yes', true).p_consent_marketing).toBe(false)
  })

  it('flag apagado: no agrega el parámetro (la RPC vieja daría 404)', () => {
    expect('p_consent_marketing' in withStarterConsent(params, true, false)).toBe(false)
  })

  it('no muta el objeto original', () => {
    const p = { p_email: 'a@b.com' }
    withStarterConsent(p, true, true)
    expect(p).toEqual({ p_email: 'a@b.com' })
  })
})

describe('shouldRequestOptin', () => {
  const data = { ok: true, id: '0b6f1c2e-3d4a-4b5c-8d9e-0f1a2b3c4d5e' }
  it('solo con flag, casilla marcada y registro ok con id', () => {
    expect(shouldRequestOptin(data, true, true)).toBe(true)
    expect(shouldRequestOptin(data, false, true)).toBe(false)
    expect(shouldRequestOptin(data, true, false)).toBe(false)
    expect(shouldRequestOptin({ ok: false }, true, true)).toBe(false)
    expect(shouldRequestOptin({ ok: true }, true, true)).toBe(false)
    expect(shouldRequestOptin(null, true, true)).toBe(false)
  })
})

describe('OPTIN_SOURCES', () => {
  it('coincide con las fuentes que acepta send-optin-confirmation', () => {
    expect(OPTIN_SOURCES).toEqual(['starter', 'diagnostico', 'demo'])
  })
})
