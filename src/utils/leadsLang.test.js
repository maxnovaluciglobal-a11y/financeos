import { describe, it, expect } from 'vitest'
import { LEADS_LANG_ENABLED, normalizeLeadLang, withLeadLang } from './leadsLang.js'

describe('LEADS_LANG_ENABLED', () => {
  it('encendido: la migración 20261009000000_leads_lang se aplicó en producción el 08-oct-2026', () => {
    expect(LEADS_LANG_ENABLED).toBe(true)
  })
})

describe('withLeadLang', () => {
  const params = { p_email: 'a@b.com' }

  it('flag encendido (default): agrega p_lang', () => {
    expect(withLeadLang(params, 'en')).toEqual({ p_email: 'a@b.com', p_lang: 'en' })
  })

  it('flag apagado explícito: tampoco agrega p_lang', () => {
    expect('p_lang' in withLeadLang(params, 'de', false)).toBe(false)
  })

  it('flag encendido: agrega p_lang normalizado', () => {
    expect(withLeadLang(params, 'en', true)).toEqual({ p_email: 'a@b.com', p_lang: 'en' })
    expect(withLeadLang(params, 'pt-BR', true).p_lang).toBe('pt')
    expect(withLeadLang(params, ' DE ', true).p_lang).toBe('de')
    expect(withLeadLang(params, 'es_AR', true).p_lang).toBe('es')
  })

  it('idioma no soportado o vacío: omite p_lang aun con el flag encendido', () => {
    for (const v of ['fr', '', null, undefined, 42, 'auto']) {
      expect('p_lang' in withLeadLang(params, v, true)).toBe(false)
    }
  })

  it('no muta el objeto original', () => {
    const p = { p_email: 'a@b.com' }
    withLeadLang(p, 'en', true)
    expect(p).toEqual({ p_email: 'a@b.com' })
  })
})

describe('normalizeLeadLang', () => {
  it('reduce a es/en/pt/de o null', () => {
    expect(normalizeLeadLang('EN-us')).toBe('en')
    expect(normalizeLeadLang('it')).toBeNull()
    expect(normalizeLeadLang(null)).toBeNull()
  })
})
