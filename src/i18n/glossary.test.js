// Glosario único (F-1): términos canónicos en los 4 idiomas y sinónimos
// retirados fuera de los diccionarios (benchmark/05-coherencia-360.md §4).
import { describe, it, expect } from 'vitest'
import { es } from './es.js'
import { en } from './en.js'
import { pt } from './pt.js'
import { de } from './de.js'
import { GLOSSARY, RETIRED, PENDING_INVEST_VIEW, term } from './glossary.js'
import assetEs from '../pages/Investments/asset/strings.es.js'
import assetEn from '../pages/Investments/asset/strings.en.js'
import assetPt from '../pages/Investments/asset/strings.pt.js'
import assetDe from '../pages/Investments/asset/strings.de.js'
import essEs from '../pages/Investments/esencial/strings.es.js'
import essEn from '../pages/Investments/esencial/strings.en.js'
import essPt from '../pages/Investments/esencial/strings.pt.js'
import essDe from '../pages/Investments/esencial/strings.de.js'
import { es as pfEs } from '../pages/Investments/portfolio/text.es.js'
import { en as pfEn } from '../pages/Investments/portfolio/text.en.js'
import { pt as pfPt } from '../pages/Investments/portfolio/text.pt.js'
import { de as pfDe } from '../pages/Investments/portfolio/text.de.js'

const DICTS = { es, en, pt, de }
const LANGS = ['es', 'en', 'pt', 'de']
// Los diccionarios por módulo de Inversiones (ficha, vista esencial,
// Portafolio) también cuentan: la misma cifra no puede tener dos nombres.
const MODULE_DICTS = {
  es: [assetEs, essEs, pfEs], en: [assetEn, essEn, pfEn], pt: [assetPt, essPt, pfPt], de: [assetDe, essDe, pfDe],
}
const ALL = Object.fromEntries(LANGS.map(l => [l, Object.assign({}, ...MODULE_DICTS[l], DICTS[l])]))

// Lo que hoy viola un sinónimo retirado, como 'lang:clave'.
function violations() {
  const out = new Set()
  for (const r of RETIRED) {
    for (const [k, v] of Object.entries(ALL[r.lang])) {
      if (r.scope && !r.scope.some(p => k.startsWith(p))) continue
      if (r.re.test(String(v))) out.add(`${r.lang}:${k}`)
    }
  }
  return out
}

describe('glosario único', () => {
  it('cada término está en los 4 idiomas', () => {
    const bad = Object.entries(GLOSSARY).filter(([, t]) => LANGS.some(l => typeof t[l] !== 'string' || !t[l].trim()) || !t.def).map(([id]) => id)
    expect(bad).toEqual([])
  })

  it('el portugués no es una copia del español (salvo cognados marcados)', () => {
    const bad = Object.entries(GLOSSARY).filter(([, t]) => t.pt === t.es && !t.cognate).map(([id]) => id)
    expect(bad).toEqual([])
  })

  it('las claves dueñas de un término lo usan en cada idioma', () => {
    const bad = []
    for (const [id, t] of Object.entries(GLOSSARY)) {
      for (const key of t.keys || []) {
        for (const l of LANGS) {
          const v = DICTS[l][key]
          if (typeof v !== 'string' || !v.toLowerCase().includes(t[l].toLowerCase())) bad.push(`${id} → ${l}:${key}`)
        }
      }
    }
    expect(bad).toEqual([])
  })

  it('ningún diccionario usa un sinónimo retirado', () => {
    const found = [...violations()].filter(x => !PENDING_INVEST_VIEW.has(x)).sort()
    expect(found).toEqual([])
  })

  it('la lista de pendientes de Inversiones solo baja (trinquete)', () => {
    const v = violations()
    const fixed = [...PENDING_INVEST_VIEW].filter(x => !v.has(x)).sort()
    expect(fixed).toEqual([])
  })

  it('term() da el canónico y cae al español', () => {
    expect(term('teQueda', 'pt')).toBe('Sobra este mês')
    expect(term('apartar', 'xx')).toBe('Apartar')
    expect(term('nope', 'es')).toBe('nope')
  })

  it('Portafolio en alemán trata de "Sie", como el resto de la app', () => {
    const noVars = (v) => String(v).replace(/\{\w+\}/g, '')
    expect(Object.entries(pfDe).filter(([, v]) => /\b(du|dein\w*|dich|dir)\b/i.test(noVars(v))).map(([k]) => k)).toEqual([])
  })
})
