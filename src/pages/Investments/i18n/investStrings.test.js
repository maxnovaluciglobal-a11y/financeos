// Textos de Inversiones fuera del diccionario principal (src/i18n/sections.js).
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { es as mainEs } from '../../../i18n/es.js'
import { translate } from '../../../i18n/translate.js'
import { sectionStrings } from '../../../i18n/sections.js'
import es from './strings.es.js'
import { investStringsReady, loadInvestStrings } from './investStrings.js'

// Fuera de pages/Investments, pero solo se pintan dentro de la sección.
// InvestCard (Panorama) hoy no se monta en ningún lado: si vuelve a Panorama,
// el test de importaciones lo marca y sus claves tienen que volver a es.js.
const ONLY_INVEST = ['utils/investMarket.js', 'demo/demoMarket.js', 'demo/demoMarketApi.js', 'components/charts/CandleChart.jsx', 'pages/Panorama/InvestCard.jsx']
const SRC = fileURLToPath(new URL('../../..', import.meta.url))
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.jsx?$/.test(f) && !/\.test\.js$/.test(f)) out.push(p)
  }
  return out
}

describe('textos diferidos de Inversiones', () => {
  it('no se repiten en el diccionario principal', () => {
    expect(Object.keys(es).filter(k => k in mainEs)).toEqual([])
  })

  it('las claves que se usan fuera de Inversiones siguen en el diccionario principal', () => {
    // Panorama, el menú o los datos de muestra se pintan sin entrar a la sección:
    // una clave diferida ahí se vería cruda. glossary.js solo lista claves para
    // sus tests (no pinta nada). Los módulos de ONLY_INVEST viven fuera de la
    // carpeta pero solo los importa Inversiones (lo comprueba el test de abajo).
    const bad = []
    for (const f of walk(SRC)) {
      const rel = relative(SRC, f)
      if (rel.startsWith('pages/Investments/') || ONLY_INVEST.includes(rel) || /^i18n\/(es|en|pt|de|withSections|glossary)\.js$/.test(rel)) continue
      for (const m of readFileSync(f, 'utf8').matchAll(/['"`](invest\.[\w.]+)['"`]/g)) {
        if (m[1] in es) bad.push(`${rel}: ${m[1]}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('los módulos de ONLY_INVEST solo los importa Inversiones', () => {
    const bad = []
    for (const f of walk(SRC)) {
      const rel = relative(SRC, f)
      if (rel.startsWith('pages/Investments/') || ONLY_INVEST.includes(rel)) continue
      const code = readFileSync(f, 'utf8')
      for (const m of ONLY_INVEST) {
        const base = m.split('/').pop().replace(/\.jsx?$/, '')
        if (new RegExp(`from ['"][^'"]*/${base}(\\.jsx?)?['"]`).test(code)) bad.push(`${rel} -> ${m}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('translate las encuentra al registrarse y el resto de idiomas llega con import()', async () => {
    const k = 'invest.gate.title'
    expect(translate('es', k)).toBe(es[k])
    expect(investStringsReady('es')).toBe(true)
    expect(investStringsReady('pt')).toBe(false)
    await loadInvestStrings('pt')
    expect(investStringsReady('pt')).toBe(true)
    expect(sectionStrings.pt[k]).toBeTruthy()
    expect(translate('pt', k)).toBe(sectionStrings.pt[k])
    expect(translate('pt', k)).not.toBe(es[k])
  })
})

describe('pantallas con textos diferidos (withSections.js)', () => {
  it('cada una tiene las mismas claves y variables en los 4 idiomas, y ninguna repite el diccionario principal', async () => {
    const { SECTION_DICTS } = await import('../../../i18n/withSections.js')
    const vars = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(',')
    for (const [name, d] of Object.entries(SECTION_DICTS)) {
      const keys = Object.keys(d.es).sort()
      expect(Object.keys(d.es).filter(k => k in mainEs), name).toEqual([])
      for (const lang of ['en', 'pt', 'de']) {
        expect(Object.keys(d[lang]).sort(), `${name}/${lang}`).toEqual(keys)
        for (const k of keys) expect(vars(d[lang][k]), `${name}/${lang}/${k}`).toBe(vars(d.es[k]))
      }
    }
  })
})
