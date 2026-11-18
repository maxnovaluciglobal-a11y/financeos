// D19: un solo texto de privacidad de Inversiones en toda la app. Ajustes ›
// Funciones lo repite tal cual después de su frase de presentación.
import { describe, it, expect } from 'vitest'
import { es } from './es.js'
import { en } from './en.js'
import { pt } from './pt.js'
import { de } from './de.js'

const DICTS = { es, en, pt, de }

describe('texto de privacidad de Inversiones (D19)', () => {
  it('es el texto aprobado en español', () => {
    expect(es['invest.privacy']).toBe('Tus posiciones de inversión se guardan en nuestro servidor para que puedas verlas en cualquier dispositivo. Para traer precios solo se consultan los símbolos. Tus movimientos siguen solo en tu teléfono.')
  })
  for (const [lang, d] of Object.entries(DICTS)) {
    it(`${lang}: Ajustes › Funciones usa el mismo texto`, () => {
      expect(d['settings.features.investments.sub'].endsWith(' ' + d['invest.privacy'])).toBe(true)
    })
  }
})
