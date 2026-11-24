// D19: un solo texto de privacidad de Inversiones en toda la app.
// I-18 (benchmark/05-coherencia-360, 23-nov-2026): la descripción del módulo
// en Ajustes › Funciones nombra la pantalla Inversiones (y dónde más se ve el
// portafolio) y dice el almacenamiento tal como lo hace el código
// (core/investBridge.js): posiciones en la cuenta, en nuestro servidor; para
// precios solo viajan los símbolos; el módulo no envía los movimientos.
// `invest.privacy` (src/pages/Investments/i18n) todavía tiene el texto
// anterior: se alinea con esta misma redacción cuando se toque esa carpeta.
import { describe, it, expect } from 'vitest'
import { es } from './withSections.js'
import { en } from './withSections.js'
import { pt } from './withSections.js'
import { de } from './withSections.js'

const DICTS = { es, en, pt, de }

describe('texto de privacidad de Inversiones (D19)', () => {
  it('es el texto aprobado en español', () => {
    expect(es['invest.privacy']).toBe('Tus posiciones de inversión se guardan en nuestro servidor para que puedas verlas en cualquier dispositivo. Para traer precios solo se consultan los símbolos. Tus movimientos siguen solo en tu teléfono.')
  })
})

describe('Ajustes › Funciones › Inversiones (I-18)', () => {
  it('texto exacto en español', () => {
    expect(es['settings.features.investments.sub']).toBe('Agrega la sección Inversiones con tu portafolio, que también aparece en Panorama y en Patrimonio neto. Tus posiciones se guardan en tu cuenta, en nuestro servidor, para que puedas verlas en cualquier dispositivo. Para traer precios solo se envían los símbolos. Esta función no envía tus movimientos.')
  })
  for (const [lang, d] of Object.entries(DICTS)) {
    it(`${lang}: nombra Inversiones, Panorama y Patrimonio con sus nombres de la app`, () => {
      const sub = d['settings.features.investments.sub']
      expect(sub).toContain(d['nav.investments'])
      expect(sub).toContain(d['nav.panorama'])
      expect(sub.toLowerCase()).toContain(d['networth.title'].toLowerCase())
    })
    it(`${lang}: no promete que los movimientos quedan solo en el teléfono (hay sincronización cifrada)`, () => {
      expect(d['settings.features.investments.sub']).not.toMatch(/teléfono|phone|telefone|Telefon/i)
    })
  }
})
