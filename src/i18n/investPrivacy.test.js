// D19: un solo texto de privacidad de Inversiones en toda la app.
// I-18 (benchmark/05-coherencia-360, 23-nov-2026): la descripción del módulo
// en Ajustes › Funciones nombra la pantalla Inversiones (y dónde más se ve el
// portafolio) y dice el almacenamiento tal como lo hace el código
// (core/investBridge.js): posiciones en la cuenta, en nuestro servidor; para
// precios solo viajan los símbolos; el módulo no envía los movimientos.
// `invest.privacy` (src/pages/Investments/i18n) lo alinea la rama F7 al
// integrar: acá no se exige ni su texto viejo ni que coincida con Ajustes.
// D19 (actualizado el 23-nov-2026 por delegación de Walter, revisión F7): un solo texto de privacidad de Inversiones en toda la app. Ajustes ›
// Funciones lo repite tal cual después de su frase de presentación.
import { describe, it, expect } from 'vitest'
import { es } from './withSections.js'
import { en } from './withSections.js'
import { pt } from './withSections.js'
import { de } from './withSections.js'

const DICTS = { es, en, pt, de }

describe('texto de privacidad de Inversiones (D19)', () => {
  // Texto actualizado el 23-nov-2026 por delegación de Walter (revisión F7): el
  // de D19 podía leerse como si los movimientos de inversión quedaran en el
  // dispositivo, y viven en la cuenta, como dice la Ayuda (hlp.a.where).
  const APPROVED = {
    es: 'Tus posiciones, movimientos, los activos que sigues, tus alertas, tu capital de referencia y tus planes se guardan en tu cuenta, en nuestro servidor, para que puedas verlos en cualquier dispositivo. Tus finanzas personales siguen en tu dispositivo. Para traer precios solo se consultan los símbolos.',
    en: 'Your holdings, activity, the assets you follow, your alerts, your reference capital and your plans are stored in your account on our server, so you can see them on any device. Your personal finances stay on your device. To fetch prices, only the symbols are looked up.',
    pt: 'Suas posições, movimentos, os ativos que você segue, seus alertas, seu capital de referência e seus planos ficam na sua conta, no nosso servidor, para que você possa vê-los em qualquer dispositivo. Suas finanças pessoais continuam no seu dispositivo. Para buscar preços, só os símbolos são consultados.',
    de: 'Ihre Positionen, Bewegungen, die Werte, die Sie verfolgen, Ihre Alarme, Ihr Referenzkapital und Ihre Pläne werden in Ihrem Konto auf unserem Server gespeichert, damit Sie sie auf jedem Gerät sehen können. Ihre persönlichen Finanzen bleiben auf Ihrem Gerät. Für die Kurse werden nur die Symbole abgefragt.',
  }
  for (const [lang, d] of Object.entries(DICTS)) {
    it(`${lang}: es el texto aprobado (actualizado el 23-nov-2026 por delegación de Walter, revisión F7)`, () => {
      expect(d['invest.privacy']).toBe(APPROVED[lang])
    })
  }
  it('ya no dice que los movimientos de inversión queden en el teléfono', () => {
    for (const d of Object.values(DICTS)) expect(d['invest.privacy']).not.toMatch(/teléfono|phone|telefone|Telefon/)
  })
  for (const [lang, d] of Object.entries(DICTS)) {
    it(`${lang}: existe y dice que para los precios solo viajan los símbolos`, () => {
      expect(typeof d['invest.privacy']).toBe('string')
      expect(d['invest.privacy']).toMatch(/símbolos|symbols|símbolos|Symbole/i)
    })
  }
})

describe('Ajustes › Funciones › Inversiones (I-18)', () => {
  it('texto exacto en español', () => {
    expect(es['settings.features.investments.sub']).toBe('Agrega la sección Inversiones con tu portafolio, que también aparece en Panorama y en Patrimonio neto. Tus posiciones, movimientos, los activos que sigues, tus alertas, tu capital de referencia y tus planes se guardan en tu cuenta, en nuestro servidor, para que puedas verlos en cualquier dispositivo. Tus finanzas personales siguen en tu dispositivo. Para traer precios solo se consultan los símbolos.')
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
