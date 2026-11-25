// Textos de "lo que viene" (cuotas, próximos meses, tarjetas): paridad, variables y voz en los 4 idiomas.
import { describe, it, expect } from 'vitest'
import es from './strings.es.js'
import en from './strings.en.js'
import pt from './strings.pt.js'
import de from './strings.de.js'
import { es as esMain } from '../es.js'

describe('textos de "lo que viene"', () => {
  const keys = Object.keys(es).sort()
  it('las 4 lenguas tienen las mismas claves, todas con prefijo ahead.', () => {
    expect(keys.every(k => k.startsWith('ahead.'))).toBe(true)
    for (const d of [en, pt, de]) expect(Object.keys(d).sort()).toEqual(keys)
  })
  it('no pisan claves del diccionario principal', () => {
    expect(keys.filter(k => k in esMain)).toEqual([])
  })
  it('las mismas variables {x}', () => {
    const vars = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(',')
    for (const k of keys) for (const d of [en, pt, de]) expect(vars(d[k]), k).toBe(vars(es[k]))
  })
  it('sin voseo, exclamaciones ni "por favor"; el alemán no tutea', () => {
    const VOSEO = /\b(podés|tenés|querés|vos|tocá|mirá|elegí|registrá|anotá|guardá|agregá|actualizá|revisá)\b/i
    for (const k of keys) {
      expect(es[k], k).not.toMatch(VOSEO)
      expect(es[k], k).not.toMatch(/por favor/i)
    }
    for (const d of [es, en, pt, de]) for (const k of keys) expect(d[k], k).not.toMatch(/[¡!]/)
    for (const k of keys) expect(de[k], k).not.toMatch(/\b(du|dein|deine|dich|dir)\b/i)
  })
})
