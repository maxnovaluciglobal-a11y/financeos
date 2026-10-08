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

describe('paridad de las claves del Inicio M5 (es/en/pt/de)', () => {
  const prefixes = ['home.', 'backup.reminder.']
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
      expect(es[k]).not.toMatch(/\b(podés|tenés|contanos|dejanos|probá|elegí|revisá|escribinos|querés|vos|registrá|empezá|tocá|respaldá|creá|mirá)\b/i)
      expect(es[k]).not.toMatch(/[¡!]/)
      expect(es[k]).not.toMatch(/por favor/i)
    }
    for (const k of pick(de)) expect(de[k]).not.toMatch(/\b(du|dein|deine|dich|dir)\b/i)
  })
})

describe('T17: sin glifos unicode usados como ícono dentro de los textos', () => {
  // El ícono lo dibuja el componente (SignalIcon / Alert), no el string.
  const GLYPH_ICON = /^[◈◑◎⊖▤⇪↻⊟⊡⌂◆⚕⊞⟶⊙⚠↗⇄☀⏻⊗🔒]/u
  it.each([['es', es], ['en', en], ['pt', pt], ['de', de]])('%s', (_, dict) => {
    const offenders = Object.entries(dict).filter(([, v]) => GLYPH_ICON.test(String(v).trim())).map(([k]) => k)
    expect(offenders).toEqual([])
  })
})

describe('paridad de las claves del bloqueo T14 (es/en/pt/de)', () => {
  const prefixes = ['lock.']
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
      expect(es[k]).not.toMatch(/\b(podés|tenés|contanos|dejanos|probá|elegí|revisá|escribinos|querés|vos|registrá|empezá|tocá|ingresá|olvidás|usá)\b/i)
      expect(es[k]).not.toMatch(/[¡!]/)
      expect(es[k]).not.toMatch(/por favor/i)
    }
    for (const k of pick(de)) expect(de[k]).not.toMatch(/\b(du|dein|deine|dich|dir)\b/i)
  })

  it('el texto de la opción dice que es un bloqueo de pantalla, no cifrado', () => {
    expect(es['lock.settings.desc']).toMatch(/no cifra/)
    expect(en['lock.settings.desc']).toMatch(/does not encrypt/)
  })
})

// i18n/english-ready (oct-2026): textos que estaban fijos en español en
// contextos, gráficos, plantillas, PDFs, etc. Al sumar un prefijo nuevo en
// esa rama, agregarlo acá.
describe('paridad de las claves de english-ready (es/en/pt/de)', () => {
  const prefixes = [
    'toast.', 'demo.toast.', 'csv.', 'micro.', 'chart.', 'prio.', 'ring.', 'seal.', 'ui.',
    'errorBoundary.', 'subcat.', 'expsub.', 'subs.metrics.', 'cat.', 'settings.dualCurrency.',
    'settings.footer', 'adv.notes.nextStepsPh',
  ]
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

  it('sin voseo, exclamaciones ni "por favor" en ningún idioma; el alemán no tutea', () => {
    const VOSEO = /\b(podés|tenés|contanos|dejanos|probá|elegí|revisá|escribinos|querés|vos|registrá|empezá|tocá|ingresá|olvidás|usá|respaldá|creá|mirá|sabés|hacé|agregá|cargá|importá|definí|configurá)\b/i
    for (const k of pick(es)) {
      expect(es[k], k).not.toMatch(VOSEO)
      expect(es[k], k).not.toMatch(/por favor/i)
    }
    for (const [lang, d] of [['es', es], ['en', en], ['pt', pt], ['de', de]]) {
      for (const k of pick(d)) expect(d[k], `${lang}:${k}`).not.toMatch(/[¡!]/)
    }
    for (const k of pick(en)) expect(en[k], k).not.toMatch(/\bplease\b/i)
    for (const k of pick(de)) expect(de[k], k).not.toMatch(/\b(du|dein|deine|deinen|deinem|dich|dir)\b/i)
  })

  it('ninguna frase en inglés o alemán quedó igual al español', () => {
    // Solo frases (3+ palabras): etiquetas sueltas como "Streaming", "Internet"
    // o "Original" son iguales en varios idiomas a propósito.
    const offenders = []
    for (const k of pick(es).filter(k => String(es[k]).trim().split(/\s+/).filter(w => /\p{L}/u.test(w)).length >= 3 && !/^MOY IQ v/.test(es[k]))) {
      for (const [lang, d] of [['en', en], ['de', de]]) {
        if (d[k] === es[k]) offenders.push(`${lang}:${k}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
