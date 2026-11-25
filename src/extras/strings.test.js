import { describe, it, expect } from 'vitest'
import es from './strings.es.js'
import en from './strings.en.js'
import pt from './strings.pt.js'
import de from './strings.de.js'

const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort()
const LANGS = { en, pt, de }

describe('textos de avisos locales, Transparencias, Invita y Puntos y millas', () => {
  for (const [lang, d] of Object.entries(LANGS)) {
    it(`${lang}: mismas claves y variables que el español, sin textos vacíos`, () => {
      expect(Object.keys(d).sort()).toEqual(Object.keys(es).sort())
      for (const k of Object.keys(es)) {
        expect(vars(d[k]), `${lang} ${k}`).toEqual(vars(es[k]))
        expect(String(d[k]).trim().length, `${lang} ${k}`).toBeGreaterThan(0)
      }
    })
  }

  it('es: español neutro (sin voseo), sin exclamaciones', () => {
    for (const [k, v] of Object.entries(es)) {
      expect(v, k).not.toMatch(/\b(podés|tenés|querés|vos|revisá|mirá|pagá|activá|compartí|anotá|escribí|probá|elegí)\b/i)
      expect(v, k).not.toMatch(/[¡!]/)
    }
  })

  it('sin referencias a recompensas, cupones ni pagos en "Invita a alguien"', () => {
    for (const d of [es, en, pt, de]) {
      const txt = Object.entries(d).filter(([k]) => k.startsWith('invite.')).map(([, v]) => v).join(' ')
      expect(txt).not.toMatch(/cup[oó]n|coupon|gana|reward|descuento|discount|recompensa|Prämie|desconto/i)
    }
  })
})
