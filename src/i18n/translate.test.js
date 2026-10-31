import { describe, it, expect } from 'vitest'
import { translate, interpolate, detectLanguage } from './translate.js'
import { loadLang, waitForLang } from './langCache.js'
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
  const prefixes = ['lock.', 'deviceSwitch.']
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
    'settings.footer', 'settings.cancelSub.', 'adv.notes.nextStepsPh', 'tpl.', 'tplsel.', 'rpdf.', 'apdf.', 'imp.fileErr.', 'imp.rowErr.',
    'unsub.', 'settings.diagnostics.', 'dbError.newer.', 'multidolarar.rates.',
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

// Demo con varias personas (08-oct-2026): el banner no puede llevar a Sofía
// fija — el nombre y el país llegan como variables según la persona.
describe('demo.banner.label por persona', () => {
  it.each([['es', es], ['en', en], ['pt', pt], ['de', de]])('%s usa {name} y {country}, sin nombre fijo', (_, dict) => {
    const s = dict['demo.banner.label']
    expect(s).toContain('{name}')
    expect(s).toContain('{country}')
    expect(s).not.toMatch(/Sof[ií]a|Colomb|Kolumb/)
    expect(s).not.toMatch(/[!¡]/)
  })
  it('se arma con la persona de EE. UU. en inglés', () => {
    expect(interpolate(en['demo.banner.label'], { name: 'Maya Robinson', country: en['country.US'] }))
      .toBe('Sample data · Maya Robinson · United States')
  })
})

// Movimientos fijos (08-oct-2026): prefijo 'rec.' + las claves sueltas que se
// agregaron o reescribieron con la misma tarea.
describe('paridad de las claves de movimientos fijos (es/en/pt/de)', () => {
  const prefixes = ['rec.', 'dbError.', 'nav.recurring', 'mov.list.show', 'ahorroFiscal.figures', 'cf.recInc.', 'cf.recExp.', 'cf.analysis.recap']
  const pick = (dict) => Object.keys(dict).filter(k => prefixes.some(p => k.startsWith(p))).sort()
  it('las 4 lenguas tienen exactamente las mismas claves', () => {
    const base = pick(es)
    expect(base.length).toBeGreaterThan(100)
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
      expect(es[k]).not.toMatch(/\b(podés|tenés|contanos|dejanos|probá|elegí|revisá|escribinos|querés|vos|registrá|empezá|tocá|confirmá|agregá|creá|marcá)\b/i)
      expect(es[k]).not.toMatch(/[¡!]/)
      expect(es[k]).not.toMatch(/por favor/i)
    }
    for (const k of pick(de)) expect(de[k]).not.toMatch(/\b(du|dein|deine|dich|dir)\b/i)
    for (const k of pick(en)) expect(en[k]).not.toMatch(/!/)
  })
})

// Doble opt-in de marketing (oct-2026): casilla de LicenseGate y texto de la
// casilla de DemoGate que menciona el correo de confirmación.
describe('paridad de las claves de doble opt-in (es/en/pt/de)', () => {
  const keys = ['licenseGate.marketingConsent', 'demoGate.consentDoi']
  it('existen en los 4 idiomas', () => {
    for (const k of keys) for (const d of [es, en, pt, de]) expect(typeof d[k]).toBe('string')
  })
  it('mencionan el correo de confirmación y la baja, sin exclamaciones ni voseo, de en primera persona sin "du"', () => {
    for (const k of keys) {
      expect(es[k]).toMatch(/confirm/i); expect(en[k]).toMatch(/confirm/i); expect(pt[k]).toMatch(/confirm/i); expect(de[k]).toMatch(/Bestätigung/)
      for (const d of [es, en, pt, de]) expect(d[k]).not.toMatch(/[¡!]/)
      expect(es[k]).not.toMatch(/\b(podés|querés|vos)\b/i)
      expect(de[k]).not.toMatch(/\bdu\b|\bdein/i)
    }
  })
})

describe('paridad de las claves del plan "como Rial" fases 1 y 2 (es/en/pt/de)', () => {
  const prefixes = ['nav.tabsLabel', 'steps.', 'tour.', 'pushAsk.', 'empty.', 'menu.', 'budgets.copy.', 'nps.']
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

  it('sin voseo, exclamaciones ni "por favor"; el alemán no tutea', () => {
    for (const k of pick(es)) {
      expect(es[k]).not.toMatch(/\b(podés|tenés|contanos|dejanos|probá|elegí|revisá|escribinos|querés|vos|registrá|empezá|tocá|respaldá|creá|mirá|hacé|activá|copiá)\b/i)
      expect(es[k]).not.toMatch(/por favor/i)
    }
    for (const d of [es, en, pt, de]) for (const k of pick(d)) expect(d[k], k).not.toMatch(/[¡!]/)
    for (const k of pick(de)) expect(de[k]).not.toMatch(/\b(du|dein|deine|dich|dir)\b/i)
  })
})

describe('paridad de las claves del plan "como Rial" fase 3 (R12–R14, es/en/pt/de)', () => {
  const prefixes = ['refcur.', 'conv.', 'nav.backTo', 'nav.sec.tools']
  const pick = (dict) => Object.keys(dict).filter(k => prefixes.some(p => k.startsWith(p))).sort()
  it('las 4 lenguas tienen exactamente las mismas claves', () => {
    const base = pick(es)
    expect(base.length).toBeGreaterThan(20)
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

  it('sin voseo, exclamaciones ni "por favor"; el alemán no tutea', () => {
    for (const k of pick(es)) {
      expect(es[k]).not.toMatch(/\b(podés|tenés|querés|vos|escribila|escribí|agregá|consultá|usás|guardá|editá)\b/i)
      expect(es[k]).not.toMatch(/por favor/i)
    }
    for (const d of [es, en, pt, de]) for (const k of pick(d)) expect(d[k], k).not.toMatch(/[¡!]/)
    for (const k of pick(de)) expect(de[k]).not.toMatch(/\b(du|dein|deine|dich|dir)\b/i)
  })
})

// Pulido 09-oct-2026: claves tocadas o nuevas (multimoneda VE, textos que
// estaban fijos en JSX, banderas, primeras entradas de Metas/Presupuestos).
describe('paridad de las claves del pulido 09-oct (es/en/pt/de)', () => {
  const prefixes = ['multimoneda.', 'steuer.elster.', 'mov.form.typeNeed', 'mov.form.typeWant', 'goals.suggest.perMonthSuffix', 'goals.first.', 'budgets.first.']
  const pick = (dict) => Object.keys(dict).filter(k => prefixes.some(p => k.startsWith(p))).sort()
  it('las 4 lenguas tienen exactamente las mismas claves', () => {
    const base = pick(es)
    expect(base.length).toBeGreaterThan(20)
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

  it('sin voseo, exclamaciones, "en vivo" ni emoji de bandera; el alemán no tutea', () => {
    for (const k of pick(es)) {
      expect(es[k], k).not.toMatch(/\b(podés|tenés|querés|vos|acá|escribí|elegí|usás|guardá|mirá)\b/i)
      expect(es[k], k).not.toMatch(/en vivo|tiempo real/i)
    }
    for (const d of [es, en, pt, de]) for (const k of pick(d)) {
      expect(d[k], k).not.toMatch(/[¡!]/)
      expect(d[k], k).not.toMatch(/\p{Regional_Indicator}/u)
    }
    for (const k of pick(de)) expect(de[k], k).not.toMatch(/\b(du|dein|deine|deinen|deinem|deiner|dich|dir)\b/i)
  })
})

// Pulido 09-oct: el alemán va de "Sie" en TODA la app (antes solo se probaba
// por prefijo de fase y quedaban ~95 textos con du/dein en las herramientas
// por país, ajustes, licencia y login).
describe('alemán formal en todas las claves', () => {
  it('ningún texto en alemán tutea (du/dein/dich/dir)', () => {
    const offenders = Object.entries(de).filter(([, v]) => /\b(du|dein|deine|deinen|deinem|deiner|deines|dich|dir)\b/i.test(String(v))).map(([k]) => k)
    expect(offenders).toEqual([])
  })
  it('ni imperativos de du al empezar una frase', () => {
    const IMP = /(^|[.:—–]\s+)(Gib|Prüfe|Melde dich|Sieh|Erfasse|Wende dich|Simuliere|Trage|Wähle|Tippe|Speichere|Öffne|Kopiere|Erwäge|Aktualisiere|Versuche es)\b/
    const offenders = Object.entries(de).filter(([, v]) => IMP.test(String(v))).map(([k]) => k)
    expect(offenders).toEqual([])
  })
})

describe('sin voseo ni exclamaciones en ningún texto en español', () => {
  it('es', () => {
    const VOSEO = /\b(tenés|podés|querés|sabés|acá|vos|hacé|mirá|elegí|agregá|usá|probá|revisá|tocá|empezá|registrá|escribí|guardá|editá|creá|cargá|importá|definí|configurá|contanos|dejanos|escribinos|ingresá|olvidás|respaldá|consultá|usás)\b/i
    const offenders = Object.entries(es).filter(([, v]) => VOSEO.test(String(v)) || /[¡!]/.test(String(v))).map(([k]) => k)
    expect(offenders).toEqual([])
  })
})

// Oferta de Pro con prueba de 14 días y selector anual/mensual (auditoría 360, C-03):
// prefijo nuevo 'billing.' y las tres claves de LicenseGate/Ajustes que cambiaron.
describe('paridad de las claves de la oferta de Pro con prueba (es/en/pt/de)', () => {
  const changed = ['settings.upgrade.title', 'settings.upgrade.btn', 'licenseGate.planProDesc']
  const pick = (dict) => Object.keys(dict).filter(k => k.startsWith('billing.') || changed.includes(k)).sort()
  const vars = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(',')

  it('las 4 lenguas tienen exactamente las mismas claves', () => {
    const base = pick(es)
    expect(base.length).toBe(11)
    expect(pick(en)).toEqual(base)
    expect(pick(pt)).toEqual(base)
    expect(pick(de)).toEqual(base)
  })

  it('las mismas variables {x} en los 4 idiomas', () => {
    for (const k of pick(es)) for (const d of [en, pt, de]) expect(vars(d[k]), k).toBe(vars(es[k]))
  })

  it('el título y el botón de Ajustes llevan {days}; ya no llevan el precio mensual fijo', () => {
    for (const d of [es, en, pt, de]) {
      expect(d['settings.upgrade.title']).toContain('{days}')
      expect(d['settings.upgrade.btn']).toContain('{days}')
      expect(d['settings.upgrade.title']).not.toContain('{m}')
      expect(d['licenseGate.planProDesc']).not.toMatch(/\{m\}|US\$/)
    }
  })

  it('las notas dicen que se pide tarjeta, cuándo es el primer cobro y que se puede cancelar', () => {
    expect(es['billing.trialNote']).toMatch(/tarjeta/i)
    expect(en['billing.trialNote']).toMatch(/card/i)
    expect(pt['billing.trialNote']).toMatch(/cartão/i)
    expect(de['billing.trialNote']).toMatch(/Karte/)
    for (const d of [es, en, pt, de]) expect(d['billing.trialNote']).toContain('{next}')
    expect(es['billing.then.annual']).toMatch(/Cancela cuando quieras/)
    expect(en['billing.then.monthly']).toMatch(/Cancel anytime/)
    expect(pt['billing.then.annual']).toMatch(/Cancele quando quiser/)
    expect(de['billing.then.annual']).toMatch(/kündbar/)
  })

  it('sin voseo, exclamaciones, "por favor" ni "please"; el alemán va de Sie', () => {
    for (const k of pick(es)) {
      expect(es[k], k).not.toMatch(/\b(podés|tenés|querés|vos|probá|elegí|cancelá|usá|empezá|pasá)\b/i)
      expect(es[k], k).not.toMatch(/por favor/i)
    }
    for (const d of [es, en, pt, de]) for (const k of pick(d)) expect(d[k], k).not.toMatch(/[¡!]/)
    for (const k of pick(en)) expect(en[k], k).not.toMatch(/\bplease\b/i)
    for (const k of pick(de)) expect(de[k], k).not.toMatch(/\b(du|dein|deine|deinen|deinem|dich|dir)\b/i)
  })

  it('ninguna frase en inglés, portugués o alemán quedó igual al español', () => {
    const offenders = []
    for (const k of pick(es).filter(k => String(es[k]).trim().split(/\s+/).filter(w => /\p{L}/u.test(w)).length >= 3)) {
      for (const [lang, d] of [['en', en], ['pt', pt], ['de', de]]) if (d[k] === es[k]) offenders.push(`${lang}:${k}`)
    }
    expect(offenders).toEqual([])
  })
})

// C-31 (auditoría 360): pantalla de acceso y cambio de contraseña.
describe('paridad de authGate. y resetPassword. (es/en/pt/de)', () => {
  const prefixes = ['authGate.', 'resetPassword.']
  const pick = (dict) => Object.keys(dict).filter(k => prefixes.some(p => k.startsWith(p))).sort()
  it('las 4 lenguas tienen exactamente las mismas claves y variables', () => {
    const base = pick(es)
    expect(base.length).toBeGreaterThan(0)
    for (const d of [en, pt, de]) expect(pick(d)).toEqual(base)
    const vars = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(',')
    for (const k of base) for (const d of [en, pt, de]) expect(vars(d[k]), k).toBe(vars(es[k]))
  })
  it('sin voseo ni "por favor"; el alemán no tutea', () => {
    const VOSEO = /\b(podés|tenés|querés|vos|registrá|empezá|ingresá|olvidás|usá|creá|mirá|revisá|elegí|aceptás)\b/i
    for (const k of pick(es)) { expect(es[k], k).not.toMatch(VOSEO); expect(es[k], k).not.toMatch(/por favor/i) }
    for (const k of pick(de)) expect(de[k], k).not.toMatch(/\b(du|dein|deine|deinen|deinem|dich|dir)\b/i)
  })
})

// C-22 (auditoría 360): borrado de la cuenta desde Ajustes.
describe('paridad de deleteAccount., feedback. y syncPass. (es/en/pt/de)', () => {
  const pick = (dict) => Object.keys(dict).filter(k => k.startsWith('deleteAccount.') || k.startsWith('feedback.') || k.startsWith('syncPass.')).sort()
  it('las 4 lenguas tienen las mismas claves y variables', () => {
    const base = pick(es)
    expect(base.length).toBeGreaterThan(0)
    for (const d of [en, pt, de]) expect(pick(d)).toEqual(base)
    const vars = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(',')
    for (const k of base) for (const d of [en, pt, de]) expect(vars(d[k]), k).toBe(vars(es[k]))
  })
  it('sin voseo, exclamaciones ni "por favor"; el alemán no tutea; palabra de confirmación en mayúsculas', () => {
    const VOSEO = /\b(podés|tenés|querés|vos|escribí|descargá|usá|eliminá|preferís|cancelaste vos)\b/i
    for (const k of pick(es)) { expect(es[k], k).not.toMatch(VOSEO); expect(es[k], k).not.toMatch(/[¡!]|por favor/i) }
    for (const k of pick(de)) expect(de[k], k).not.toMatch(/\b(du|dein|deine|deinen|deinem|dich|dir)\b/i)
    for (const d of [es, en, pt, de]) expect(d['deleteAccount.confirmWord']).toBe(d['deleteAccount.confirmWord'].toUpperCase())
  })
})

// PRD-4 (auditoría 360): vista previa de Pro, franja del demo y checklist de Pro.
describe('paridad de proTrial. y pro.demo. (es/en/pt/de)', () => {
  const pick = (dict) => Object.keys(dict).filter(k => k.startsWith('proTrial.') || k.startsWith('pro.demo.') || k.startsWith('pro.gate.preview')).sort()
  it('las 4 lenguas tienen las mismas claves y variables', () => {
    const base = pick(es)
    expect(base.length).toBe(13)
    for (const d of [en, pt, de]) expect(pick(d)).toEqual(base)
    const vars = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(',')
    for (const k of base) for (const d of [en, pt, de]) expect(vars(d[k]), k).toBe(vars(es[k]))
  })
  it('sin voseo, exclamaciones ni "por favor"; el alemán no tutea', () => {
    const VOSEO = /\b(podés|tenés|querés|vos|probá|abrí|revisá|importá)\b/i
    for (const k of pick(es)) { expect(es[k], k).not.toMatch(VOSEO); expect(es[k], k).not.toMatch(/[¡!]|por favor/i) }
    for (const d of [en, pt, de]) for (const k of pick(d)) expect(d[k], k).not.toMatch(/!/)
    for (const k of pick(de)) expect(de[k], k).not.toMatch(/\b(du|dein|deine|deinen|deinem|dich|dir)\b/i)
  })
})

describe('A11Y-17: tipografía por idioma', () => {
  it('el alemán separa el % del número y usa comillas „…“', () => {
    const bad = Object.entries(de).filter(([, v]) => /[\d}]%/.test(v) || /"/.test(v) || /€\{/.test(v))
    expect(bad.map(([k]) => k)).toEqual([])
  })

  it('los ejemplos de mensajes del banco en portugués son de Brasil (R$ con decimales, sin comercios chilenos)', () => {
    for (const k of ['qa.pastePh', 'mov.form.pastePh', 'income.paste.placeholder']) {
      expect(pt[k]).toMatch(/R\$ \d{1,3}(\.\d{3})*,\d{2}/)
      expect(pt[k]).not.toMatch(/AHUMADA|Jumbo/i)
    }
  })
})

describe('paridad de las claves de la ola 1 de diseño visual (UI-Q4, Q5, Q8, M3; es/en/pt/de)', () => {
  const prefixes = ['movl.', 'ui.state.', 'goals.status.', 'ring.legend']
  const pick = (dict) => Object.keys(dict).filter(k => prefixes.some(p => k.startsWith(p))).sort()
  it('las 4 lenguas tienen exactamente las mismas claves', () => {
    const base = pick(es)
    expect(base.length).toBeGreaterThan(30)
    expect(pick(en)).toEqual(base)
    expect(pick(pt)).toEqual(base)
    expect(pick(de)).toEqual(base)
  })
  it('las mismas variables {x} en los 4 idiomas', () => {
    const vars = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(',')
    for (const k of pick(es)) for (const d of [en, pt, de]) expect(vars(d[k]), k).toBe(vars(es[k]))
  })
  it('sin voseo ni exclamaciones; el alemán no tutea', () => {
    for (const k of pick(es)) expect(es[k]).not.toMatch(/\b(podés|tenés|querés|vos|tocá|buscá|elegí|mirá)\b/i)
    for (const d of [es, en, pt, de]) for (const k of pick(d)) expect(d[k], k).not.toMatch(/[¡!]/)
    for (const k of pick(de)) expect(de[k]).not.toMatch(/\b(du|dein|deine|dich|dir)\b/i)
  })
})

describe('paridad de las claves de la ola 2 de diseño visual (UI-M5…M9, L2; es/en/pt/de)', () => {
  const prefixes = ['budgets.head.', 'budgets.pace.', 'budgets.state.', 'budgets.col.', 'budgets.meter.', 'budgets.carry', 'budgets.unbudgeted.', 'budgets.deleteAria', 'budgets.ring.', 'budgets.list.', 'budgets.model.col.', 'chart.expensesPrev', 'chart.savingsPrev', 'chart.donut.amount', 'chart.donut.share', 'reports.cum.']
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
    for (const k of pick(es)) for (const d of [en, pt, de]) expect(vars(d[k]), k).toBe(vars(es[k]))
  })
  it('sin voseo, exclamaciones ni "por favor"; el alemán no tutea', () => {
    for (const k of pick(es)) {
      expect(es[k]).not.toMatch(/\b(podés|tenés|querés|vos|tocá|mirá|elegí|gastá|asigná)\b/i)
      expect(es[k]).not.toMatch(/por favor/i)
    }
    for (const d of [es, en, pt, de]) for (const k of pick(d)) expect(d[k], k).not.toMatch(/[¡!]/)
    for (const k of pick(de)) expect(de[k]).not.toMatch(/\b(du|dein|deine|dich|dir)\b/i)
  })
})

describe('paridad de las claves de "Debo · Me deben" (D2, es/en/pt/de)', () => {
  const prefixes = ['debts.dir.', 'debts.owed.', 'debts.type.MePrestaron', 'debts.type.Financiamiento', 'networth.receivables', 'home.upcoming.kind.collect', 'home.upcoming.titleBoth', 'csv.type.receivable', 'tour.debt.direction.']
  const pick = (dict) => Object.keys(dict).filter(k => prefixes.some(p => k.startsWith(p))).sort()
  it('las 4 lenguas tienen exactamente las mismas claves', () => {
    const base = pick(es)
    expect(base.length).toBe(48) // +2: aviso al borrar un "me deben" con sus ingresos (30-oct)
    expect(pick(en)).toEqual(base)
    expect(pick(pt)).toEqual(base)
    expect(pick(de)).toEqual(base)
  })
  it('las mismas variables {x} en los 4 idiomas', () => {
    const vars = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(',')
    for (const k of pick(es)) for (const d of [en, pt, de]) expect(vars(d[k]), k).toBe(vars(es[k]))
  })
  it('sin voseo, exclamaciones ni "por favor"; el alemán no tutea', () => {
    for (const k of pick(es)) {
      expect(es[k]).not.toMatch(/\b(podés|tenés|querés|vos|tocá|mirá|elegí|registrá|cobrá|prestaste vos)\b/i)
      expect(es[k]).not.toMatch(/por favor/i)
    }
    for (const d of [es, en, pt, de]) for (const k of pick(d)) expect(d[k], k).not.toMatch(/[¡!]/)
    for (const k of pick(de)) expect(de[k]).not.toMatch(/\b(du|dein|deine|dich|dir)\b/i)
  })
})

describe('waitForLang (V4): primer pintado sin español en otros idiomas', () => {
  it('resuelve al instante si el idioma ya está cargado', async () => {
    let called = false
    await waitForLang('es', 10, () => { called = true; return Promise.resolve() })
    expect(called).toBe(false)
  })
  it('espera a que llegue el diccionario', async () => {
    let release
    const pending = new Promise((r) => { release = r })
    let done = false
    const wait = waitForLang('xx', 1000, () => pending).then(() => { done = true })
    await Promise.resolve()
    expect(done).toBe(false)
    release()
    await wait
    expect(done).toBe(true)
  })
  it('con el chunk colgado se rinde tras el tope, no deja la app en el splash', async () => {
    await expect(waitForLang('xx', 5, () => new Promise(() => {}))).resolves.toBeUndefined()
  })
})
