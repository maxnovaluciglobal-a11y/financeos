// Las preguntas siguen al mes elegido (revisión del 24-nov-2026).
import { describe, it, expect } from 'vitest'
import { questionLabel, monthName } from './AskMoyiq.jsx'
import { translate } from '../../../i18n/translate.js'
import { es } from '../../../i18n/es.js'
import { en } from '../../../i18n/en.js'

const tOf = (dict) => (k, v) => {
  let s = dict[k] ?? k
  for (const [a, b] of Object.entries(v || {})) s = s.replaceAll(`{${a}}`, String(b))
  return s
}
const today = new Date(2026, 10, 24)

describe('questionLabel / monthName', () => {
  it('mes en curso: "este mes"', () => {
    expect(questionLabel('spent', { activeMonth: '2026-11', t: tOf(es), today })).toBe('¿Cuánto gasté este mes?')
  })
  it('mes elegido en la cabecera: nombra el mes', () => {
    expect(questionLabel('spent', { activeMonth: '2026-10', t: tOf(es), today, locale: 'es-ES' })).toBe('¿Cuánto gasté en octubre?')
    expect(questionLabel('compare', { activeMonth: '2026-10', t: tOf(en), today, locale: 'en-US' })).toBe('Compare October with the month before')
  })
  it('otro año: con el año', () => {
    expect(monthName('2025-12', today, 'es-ES')).toBe('diciembre de 2025')
  })
  it('las claves nuevas existen (no caen a la clave)', () => {
    expect(typeof translate).toBe('function')
    for (const k of ['home.ask.q.spent.other', 'home.ask.q.compare.other', 'home.ask.spent.body.other', 'home.ask.perDay.future', 'home.ask.compare.balance', 'home.tourReplay']) {
      expect(es[k], k).toBeTruthy()
      expect(en[k], k).toBeTruthy()
    }
    expect(es['home.ask.compare.left']).toBeUndefined()
  })
})
