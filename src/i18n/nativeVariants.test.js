// Variantes `<key>@native` (i18n/translate.js): cada una existe en los 4
// idiomas y tiene su clave base, y en ningún idioma la app de tienda habla de
// navegador, precio, prueba, clave de licencia, "próximamente" ni beta.
import { describe, it, expect } from 'vitest'
import { es } from './es.js'
import { en } from './en.js'
import { pt } from './pt.js'
import { de } from './de.js'
import { NATIVE_SUFFIX } from './translate.js'

const DICTS = { es, en, pt, de }
const nativeKeys = (d) => Object.keys(d).filter(k => k.endsWith(NATIVE_SUFFIX))

describe('variantes @native', () => {
  it('las mismas claves en los 4 idiomas, todas con su clave base', () => {
    const base = nativeKeys(es).sort()
    expect(base.length).toBeGreaterThan(10)
    for (const [lang, d] of Object.entries(DICTS)) {
      expect(nativeKeys(d).sort(), lang).toEqual(base)
      for (const k of base) expect(d[k.slice(0, -NATIVE_SUFFIX.length)], `${lang} ${k}`).toBeTypeOf('string')
    }
  })
  it('las mismas variables {x} que la clave base', () => {
    const vars = (v) => [...String(v).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort()
    for (const [lang, d] of Object.entries(DICTS)) {
      for (const k of nativeKeys(d)) {
        const b = d[k.slice(0, -NATIVE_SUFFIX.length)]
        for (const v of vars(d[k])) expect(vars(b), `${lang} ${k}`).toContain(v)
      }
    }
  })
  const BAD = /navegador|browser|navigateur|Browser|haz clic|click|clique|klicken|US\$|prueba de|trial|teste de|Testphase|clave|license key|chave de licen|Lizenzschlüssel|Próximamente|Coming soon|Em breve|Demnächst|beta\b|incógnito|incognito/i
  for (const [lang, d] of Object.entries(DICTS)) {
    it(`${lang}: sin rastros de la web ni de venta`, () => {
      expect(nativeKeys(d).filter(k => BAD.test(d[k]))).toEqual([])
    })
  }
  it('es: sin voseo', () => {
    expect(nativeKeys(es).filter(k => /\b(tenés|podés|usá|tocá|elegí|querés|sabés)\b/.test(es[k]))).toEqual([])
  })
})
