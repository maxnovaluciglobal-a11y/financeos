import { describe, it, expect } from 'vitest'
import { translate, interpolate, detectLanguage } from './translate.js'
import { loadLang } from './langCache.js'
import { es } from './es.js'
import { en } from './en.js'
import { pt } from './pt.js'
import { de } from './de.js'

describe('detectLanguage', () => {
  it.each([
    ['es-CL', 'es'], ['en-US', 'en'], ['pt-BR', 'pt'], ['de-DE', 'de'], ['DE', 'de'],
    ['fr-FR', 'es'], ['', 'es'], [undefined, 'es'],
  ])('%s -> %s', (input, out) => {
    expect(detectLanguage(input === undefined ? [] : input)).toBe(out)
  })

  it('toma el primer idioma soportado de una lista', () => {
    expect(detectLanguage(['fr-FR', 'pt-PT', 'en'])).toBe('pt')
  })
})

describe('translate', () => {
  it('interpola variables y deja intactas las que faltan', () => {
    expect(interpolate('{a} y {b}', { a: 1 })).toBe('1 y {b}')
  })

  it('usa el idioma cargado y cae a español si falta', async () => {
    await loadLang('de')
    expect(translate('de', 'demoGate.title')).toBe(de['demoGate.title'])
    expect(translate('xx', 'demoGate.title')).toBe(es['demoGate.title'])
    expect(translate('es', 'no.existe')).toBe('no.existe')
  })
})

describe('paridad de las claves nuevas de fase 1 (es/en/pt/de)', () => {
  const prefixes = ['demoGate.', 'demo.docTitle', 'demo.banner.', 'demo.cta.', 'backup.', 'pro.gate.', 'qa.pasteDetectedDate']
  const pick = (dict) => Object.keys(dict).filter(k => prefixes.some(p => k.startsWith(p))).sort()
  it('las 4 lenguas tienen exactamente las mismas claves', () => {
    const base = pick(es)
    expect(base.length).toBeGreaterThan(0)
    expect(pick(en)).toEqual(base)
    expect(pick(pt)).toEqual(base)
    expect(pick(de)).toEqual(base)
  })

  it('ningún texto en español usa voseo, exclamaciones ni "por favor"', () => {
    for (const k of pick(es)) {
      expect(es[k]).not.toMatch(/\b(podés|tenés|contanos|dejanos|probá|elegí|revisá|escribinos|querés|vos)\b/i)
      expect(es[k]).not.toMatch(/[¡!]/)
      expect(es[k]).not.toMatch(/por favor/i)
    }
  })
})

describe('paridad de las claves de fase 2 (es/en/pt/de)', () => {
  const prefixes = ['qa.', 'method.', 'settings.categoryEmoji.', 'onboarding.v2.', 'country.', 'demo.tour.', 'demo.banner.']
  const pick = (dict) => Object.keys(dict).filter(k => prefixes.some(p => k.startsWith(p))).sort()
  it('las 4 lenguas tienen exactamente las mismas claves', () => {
    const base = pick(es)
    expect(base.length).toBeGreaterThan(0)
    expect(pick(en)).toEqual(base)
    expect(pick(pt)).toEqual(base)
    expect(pick(de)).toEqual(base)
  })

  it('las mismas variables {x} en los 4 idiomas', () => {
    const vars = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(',')
    for (const k of pick(es)) {
      for (const d of [en, pt, de]) expect(vars(d[k]), k).toBe(vars(es[k]))
    }
  })

  it('ningún texto en español usa voseo, exclamaciones ni "por favor"', () => {
    for (const k of pick(es)) {
      expect(es[k]).not.toMatch(/\b(podés|tenés|contanos|dejanos|probá|elegí|revisá|escribinos|querés|vos|registrá|empezá|tocá)\b/i)
      expect(es[k]).not.toMatch(/[¡!]/)
      expect(es[k]).not.toMatch(/por favor/i)
    }
  })
})

describe('paridad de las claves de fase 3 (es/en/pt/de)', () => {
  const prefixes = ['money.', 'score.', 'pulse.']
  const pick = (dict) => Object.keys(dict).filter(k => prefixes.some(p => k.startsWith(p))).sort()
  it('las 4 lenguas tienen exactamente las mismas claves', () => {
    const base = pick(es)
    expect(base.length).toBeGreaterThan(0)
    expect(pick(en)).toEqual(base)
    expect(pick(pt)).toEqual(base)
    expect(pick(de)).toEqual(base)
  })

  it('las mismas variables {x} en los 4 idiomas', () => {
    const vars = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(',')
    for (const k of pick(es)) {
      for (const d of [en, pt, de]) expect(vars(d[k]), k).toBe(vars(es[k]))
    }
  })

  it('ningún texto en español usa voseo, exclamaciones ni "por favor"; ningún texto alemán tutea', () => {
    for (const k of pick(es)) {
      expect(es[k]).not.toMatch(/\b(podés|tenés|contanos|dejanos|probá|elegí|revisá|escribinos|querés|vos|registrá|empezá|tocá)\b/i)
      expect(es[k]).not.toMatch(/[¡!]/)
      expect(es[k]).not.toMatch(/por favor/i)
    }
    for (const k of pick(de)) expect(de[k]).not.toMatch(/\b(du|dein|deine|dich|dir)\b/i)
  })
})
