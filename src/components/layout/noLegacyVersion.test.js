// C10 de la auditoría de branding (23-nov-2026): "moyiq v1.5" era la
// numeración de la época FinanceOS. La versión no se muestra: ni en el menú
// lateral, ni en Más, ni en el pie de Ajustes, LicenseGate o el PDF.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
const LANGS = ['es', 'en', 'pt', 'de']
const VERSION = /\bv\d+\.\d+/

describe('sin versión visible (C10)', () => {
  it('los textos del pie no llevan número de versión, en los 4 idiomas', async () => {
    for (const lang of LANGS) {
      const dict = (await import(`../../i18n/${lang}.js`))[lang]
      for (const key of ['settings.footer', 'licenseGate.version', 'rpdf.footer']) {
        const text = dict[key]
        expect(text, `${lang} ${key}`).not.toMatch(VERSION)
        expect(text, `${lang} ${key}`).toContain('MAXNOVA & LUCI Global LLC')
      }
    }
  })

  it('el menú lateral, Más y el PDF no escriben la versión a mano', () => {
    for (const rel of ['./Shell.jsx', '../../pages/More/index.jsx', '../../pages/Reports/ReportPDF.jsx']) {
      const src = read(rel).split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')
      expect(src, rel).not.toMatch(/moyiq v\d|>v\d+\.\d+</)
      expect(src, rel).not.toMatch(/creator="moyiq v/)
    }
  })
})
