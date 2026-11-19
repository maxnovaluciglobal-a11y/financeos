// La pantalla de licencia ya no muestra el prefijo FNOS- (resto de FinanceOS):
// formato "XXXX-XXXX-XXXX" en los 4 idiomas, en el texto y en el placeholder.
// La validación sigue aceptando la clave completa (ver licenseValidator.test.js).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { es } from '../i18n/es.js'
import { en } from '../i18n/en.js'
import { pt } from '../i18n/pt.js'
import { de } from '../i18n/de.js'

const DICTS = { es, en, pt, de }
const SHOWN = ['licenseGate.keyFormat', 'licenseGate.helpStep2', 'syncPass.licenseBody', 'syncPass.errLicense']

describe('clave de licencia sin FNOS- a la vista', () => {
  it.each(Object.keys(DICTS))('%s: ningún texto de la pantalla de licencia ni del sync muestra el prefijo', (lang) => {
    const d = DICTS[lang]
    expect(d['licenseGate.keyFormat']).toBe('XXXX-XXXX-XXXX')
    expect(d['licenseGate.helpStep2']).toContain('XXXX-XXXX-XXXX')
    for (const k of SHOWN) expect(d[k], `${lang} ${k}`).not.toMatch(/FNOS/)
    expect(d['licenseGate.helpStep2'], 'el correo ya no dice "License Key"').not.toMatch(/License Key/)
  })

  it('LicenseGate y Ajustes › Sync no tienen el formato con FNOS- escrito a mano', () => {
    for (const f of ['./LicenseGate.jsx', '../pages/Settings/SyncSection.jsx']) {
      const src = readFileSync(new URL(f, import.meta.url), 'utf8')
      expect(src, f).not.toMatch(/FNOS-XXXX/)
    }
  })

  it('LicenseGate normaliza la clave antes de validarla y de guardarla en la cuenta', () => {
    const src = readFileSync(new URL('./LicenseGate.jsx', import.meta.url), 'utf8')
    expect(src).toMatch(/const clean = normalizeLicenseInput\(key\)/)
  })
})
