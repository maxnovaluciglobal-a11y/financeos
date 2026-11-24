// Auditoría de traducción de TODO src/pages/Investments (F7, 23-nov-2026).
// Encuentra solos los diccionarios de la sección (cada strings.<lang>.js y
// text.<lang>.js, en cualquier carpeta) y exige, para cada uno:
//  · los 4 idiomas presentes, con las mismas claves y variables que el español;
//  · nada en español en en/de: un texto idéntico al español que tenga alguna
//    palabra de 4 letras o más falla, salvo los de la lista blanca (siglas,
//    tickers, nombres propios y palabras que son iguales de verdad);
//  · sin restos de español en en/de/pt (palabras que solo existen en español);
//  · sin voseo en el español.
// Una clave nueva idéntica al español falla aquí hasta que alguien la traduzca
// o la revise y la sume a la lista blanca con su motivo.
import { describe, it, expect } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const LANGS = ['es', 'en', 'pt', 'de']
const DICT_RE = /^(strings|text)\.(es|en|pt|de)\.js$/

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (DICT_RE.test(f)) out.push(p)
  }
  return out
}
const groups = {}
for (const f of walk(ROOT)) {
  const m = f.match(/^(.*)\.(es|en|pt|de)\.js$/)
  const name = relative(ROOT, m[1])
  ;(groups[name] ||= {})[m[2]] = f
}
async function load(file, lang) {
  const mod = await import(pathToFileURL(file).href)
  return mod.default || mod[lang]
}
const dicts = {}
for (const [name, files] of Object.entries(groups)) {
  dicts[name] = {}
  for (const l of LANGS) if (files[l]) dicts[name][l] = await load(files[l], l)
}

const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join()
const strip = (s) => String(s).replace(/\{\w+\}/g, ' ')
const longWord = (s) => /\p{L}{4,}/u.test(strip(s))

// Idénticos al español revisados uno por uno: siglas de indicadores, tickers
// y nombres de índices, nombres propios y palabras iguales en ese idioma.
const SAME_OK = {
  en: new Set([
    'asset.layer.macd', 'asset.rd.macd.label', 'fl.col.macd', // MACD (12, 26, 9)
    'asset.fund.m.beta', // Beta
    'asset.ex.b3', // B3 (São Paulo)
    'fl.rsi.mid', 'invest.hoy.ctx.vix.normal', 'invest.mkt.vix.normal', // "neutral", "normal"
    'fl.disc.list.chile', 'invest.hoy.pvh.cmp.ECH', // Chile
    'invest.hoy.strip.sym.ixic', 'invest.hoy.strip.sym.rut', 'invest.hoy.strip.sym.btc', // Nasdaq, Russell 2000, Bitcoin
    'invest.mkt.news.cat.macro', // Macro
    'plan.calc.stop', 'plan.calc.full.stop', 'plan.calc.r.stop', 'pf.f.stop', 'pf.csv.h.stop', // Stop
    'plan.calc.capital', // Capital (US$)
    'plan.ap.res.total', 'pf.total', 'pf.col.total', // Total
    'pf.f.ticker', 'pf.csv.h.ticker', // Ticker
    'pf.freq.irregular', // Irregular
  ]),
  de: new Set([
    'asset.ex.b3', 'fl.col.macd',
    'fl.col.vol', // Volumen
    'fl.rsi.mid', 'invest.hoy.ctx.vix.normal', 'invest.mkt.vix.normal',
    'fl.disc.list.chile', 'invest.hoy.pvh.cmp.ECH',
    'invest.hoy.strip.sym.ixic', 'invest.hoy.strip.sym.rut', 'invest.hoy.strip.sym.btc',
    'plan.calc.stop', 'plan.calc.full.stop', 'plan.calc.r.stop',
    'pf.f.ticker', 'pf.csv.h.ticker', 'pf.csv.h.stop',
  ]),
}

// Palabras que solo existen en español (no en inglés ni alemán; los clíticos
// portugueses "-los/-las" van pegados con guion y no cuentan).
const ES_ONLY = /(?<![\p{L}-])(que|los|las|para|con|una|del|tus|está|están|también|según|todavía|aquí|cuando|puedes|tienes|ningún|ninguna|hasta|desde)(?![\p{L}])|[ñ¿¡]/iu
const ES_NOT_PT = /(?<![\p{L}-])(y|tú|usted|puedes|tienes|aquí|todavía|cuando|también|según|hasta|ningún|ninguna|los|las|el|del|una|tus|muy)(?![\p{L}])|[ñ¿¡]/iu
const LEFTOVER_OK = new Set([
  'de:asset.mine.lots', // "Los" es sustantivo alemán (lote)
])
const VOSEO = /(?<![\p{L}])(vos|sos|tenés|podés|querés|sabés|venís|decís|elegí|tocá|mirá|buscá|agregá|escribí|probá|hacé|usá|guardá|revisá|activá|creá|volvé|descargá|completá|iniciá|empezá|seguí|pasá|dejá|poné|fijate|andá|intentá|borrá|cargá|exportá|importá|cambiá|compará|confirmá|registrá|abrí|cerrá|esperá|necesitás|tenés)(?![\p{L}])/iu

describe('auditoría de traducción de Inversiones', () => {
  it('encuentra todos los diccionarios de la sección', () => {
    const names = Object.keys(groups).sort()
    for (const n of ['asset/strings', 'esencial/strings', 'follow/strings', 'help/strings', 'i18n/strings', 'planificar/strings', 'portfolio/text', 'settings/strings']) {
      expect(names).toContain(n)
    }
  })

  for (const name of Object.keys(groups).sort()) {
    describe(name, () => {
      it('los 4 idiomas, con las mismas claves y variables que el español', () => {
        for (const l of LANGS) expect(dicts[name][l], `${name}.${l}.js`).toBeTruthy()
        const es = dicts[name].es
        const keys = Object.keys(es).sort()
        for (const l of ['en', 'pt', 'de']) {
          const d = dicts[name][l]
          expect(keys.filter(k => !(k in d)), `${name}/${l}: faltan`).toEqual([])
          expect(Object.keys(d).filter(k => !(k in es)), `${name}/${l}: sobran`).toEqual([])
          expect(keys.filter(k => vars(d[k]) !== vars(es[k])), `${name}/${l}: variables`).toEqual([])
          expect(keys.filter(k => typeof d[k] !== 'string' || !d[k].trim()), `${name}/${l}: vacías`).toEqual([])
        }
      })

      it('en y de: ningún texto idéntico al español con palabras de 4+ letras (salvo la lista blanca)', () => {
        const es = dicts[name].es
        for (const l of ['en', 'de']) {
          const d = dicts[name][l]
          const same = Object.keys(es).filter(k => d[k] === es[k] && longWord(es[k]) && !SAME_OK[l].has(k))
          expect(same, `${name}/${l}`).toEqual([])
        }
      })

      it('en, de y pt: sin restos de español', () => {
        for (const l of ['en', 'de', 'pt']) {
          const d = dicts[name][l]
          const re = l === 'pt' ? ES_NOT_PT : ES_ONLY
          const bad = Object.entries(d).filter(([k, v]) => re.test(strip(v)) && !LEFTOVER_OK.has(`${l}:${k}`)).map(([k, v]) => `${k}: ${v}`)
          expect(bad, `${name}/${l}`).toEqual([])
        }
      })

      it('español sin voseo', () => {
        const bad = Object.entries(dicts[name].es).filter(([, v]) => VOSEO.test(v)).map(([k, v]) => `${k}: ${v}`)
        expect(bad).toEqual([])
      })
    })
  }

  it('la lista blanca no tiene claves viejas (cada una sigue existiendo e idéntica)', () => {
    const all = Object.fromEntries(['en', 'de'].map(l => [l, Object.assign({}, ...Object.values(dicts).map(d => d[l]))]))
    const es = Object.assign({}, ...Object.values(dicts).map(d => d.es))
    for (const l of ['en', 'de']) for (const k of SAME_OK[l]) expect(all[l][k], `${l}:${k}`).toBe(es[k])
  })

  it('el detector funciona: un texto copiado del español falla y un resto de español se ve', () => {
    expect(longWord('Cargando…')).toBe(true)
    expect(longWord('{v} · {zone}')).toBe(false)
    expect(ES_ONLY.test('Loading the prices para you')).toBe(true)
    expect(ES_NOT_PT.test('Você pode defini-las em Carteira')).toBe(false)
    expect(ES_NOT_PT.test('Puedes cambiarlo aquí')).toBe(true)
    expect(VOSEO.test('Tocá el botón')).toBe(true)
    expect(VOSEO.test('Toca el botón')).toBe(false)
  })
})
