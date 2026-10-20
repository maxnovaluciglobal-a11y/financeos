// A11Y-17 / PRD-12 / A11Y-15: reglas de copy de los diccionarios de la app.
// Los lectores de pantalla leen los emoji en voz alta ("bombilla", "chincheta")
// y la voz de producto no los usa: solo se permiten flechas funcionales.
// "Recurrentes" ya no nombra los fijos (término único "Fijos" / "fijo").
import { describe, it, expect } from 'vitest'
import { es } from './es.js'
import { en } from './en.js'
import { pt } from './pt.js'
import { de } from './de.js'

const ALLOWED_GLYPHS = new Set(['↔', '⬆'])
const pictographs = (v) => [...String(v).matchAll(/\p{Extended_Pictographic}/gu)].map(m => m[0]).filter(g => !ALLOWED_GLYPHS.has(g))

describe('copy de la app', () => {
  for (const [lang, dict] of [['es', es], ['en', en], ['pt', pt], ['de', de]]) {
    it(`${lang}: sin emoji`, () => {
      expect(Object.entries(dict).filter(([, v]) => pictographs(v).length).map(([k]) => k)).toEqual([])
    })
  }
  it('es: sin anglicismos de interruptor ni "click"', () => {
    const bad = Object.entries(es).filter(([, v]) => /\bRollover\b|\b(ON|OFF)\b|\bclick\b/.test(v)).map(([k]) => k)
    expect(bad).toEqual([])
  })
  it('término único para los fijos: sin "recurrente(s)" en las pantallas de fijos, movimientos y suscripciones', () => {
    const scoped = (dict, re) => Object.entries(dict).filter(([k, v]) => /^(mov|subs|rec|cf|nav|reports\.kpi|apdf|rpdf|adv\.subs|demo\.toast|micro)\./.test(k) && re.test(v)).map(([k]) => k)
    expect(scoped(es, /recurrente/i)).toEqual([])
    expect(scoped(pt, /recorrente/i)).toEqual([])
    expect(scoped(de, /wiederkehrend|Fixkosten|Fixposten/i)).toEqual([])
  })
})
