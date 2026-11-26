// Textos y piezas de la vista esencial: mismas claves y variables en los 4
// idiomas, español neutro, portugués propio (no copia del español), cada t('…')
// existe, y el aviso educativo dice lo que tiene que decir.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import es from './strings.es.js'
import en from './strings.en.js'
import pt from './strings.pt.js'
import de from './strings.de.js'
import { es as appEs } from '../../../i18n/withSections.js'
import PutSummary from './PutSummary.jsx'
import { EduNotice, ViewToggle } from './ViewToggle.jsx'

const L = { es, en, pt, de }
const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort()
const DIR = dirname(fileURLToPath(import.meta.url))
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('textos de la vista esencial', () => {
  for (const lang of ['en', 'pt', 'de']) {
    it(`${lang}: mismas claves y variables que el español`, () => {
      expect(Object.keys(L[lang]).sort()).toEqual(Object.keys(es).sort())
      expect(Object.keys(es).filter(k => vars(es[k]).join() !== vars(L[lang][k]).join())).toEqual([])
    })
  }
  it('portugués propio: ninguna frase igual al español (salvo palabras que son iguales)', () => {
    // "Dividendos", "Dólar" y "Depositado" (como en Resumen, invest.dep.deposited) son iguales en portugués
    const same = new Set(['ess.put.part.dividends', 'ess.put.part.fx', 'ess.put.put'])
    expect(Object.keys(es).filter(k => !same.has(k) && pt[k] === es[k])).toEqual([])
  })
  it('español neutro, sin exclamaciones ni emoji; el alemán no tutea', () => {
    const vos = /\b(tenés|podés|querés|sabés|elegí|tocá|mirá|buscá|agregá|escribí|probá|hacé|usá|guardá|revisá|vos)\b/i
    expect(Object.entries(es).filter(([, v]) => vos.test(v)).map(([k]) => k)).toEqual([])
    for (const d of Object.values(L)) {
      expect(Object.entries(d).filter(([, v]) => /[¡!]|\p{Extended_Pictographic}/u.test(v)).map(([k]) => k)).toEqual([])
    }
    expect(Object.entries(de).filter(([, v]) => /\b(du|dein|deine|dich|dir)\b/i.test(v)).map(([k]) => k)).toEqual([])
  })
  it('sin consejos de compra o venta', () => {
    const banned = /deber[ií]as|te sugerimos|compra ahora|vende ya|should buy|you should|sollten Sie kaufen/i
    for (const d of Object.values(L)) expect(Object.entries(d).filter(([, v]) => banned.test(v)).map(([k]) => k)).toEqual([])
  })
  it('el aviso educativo y el interruptor dicen lo pedido', () => {
    expect(es['ess.edu']).toBe('Información educativa, no es recomendación de inversión.')
    expect(es['ess.view.label']).toBe('Vista completa')
    for (const w of ['velas', 'RSI', 'MACD', 'Bollinger', 'stop', 'cinta']) expect(es['ess.view.hint']).toContain(w)
  })
  it('cada t(\'…\') literal de estas piezas existe', () => {
    const code = readdirSync(DIR).filter(f => f.endsWith('.jsx')).map(f => readFileSync(join(DIR, f), 'utf8')).join('\n')
    const used = [...new Set([...code.matchAll(/\bt\(\s*'([^'$`]+)'/g)].map(m => m[1]))]
    expect(used.length).toBeGreaterThan(8)
    expect(used.filter(k => !(k in es) && !(k in appEs))).toEqual([])
  })
})

describe('<PutSummary>, interruptor y aviso', () => {
  const money = (n, signed) => `${signed && n > 0 ? '+' : n < 0 ? '−' : ''}US$${Math.abs(n).toFixed(2)}`
  const pct = (f, signed) => `${signed && f > 0 ? '+' : ''}${(f * 100).toFixed(1)} %`
  it('sin resumen no dibuja nada', () => {
    expect(renderToStaticMarkup(h(PutSummary, { summary: null, money, pct }))).toBe('')
  })
  it('Depositado primero, luego Ganancia (las palabras de Resumen), y el desglose solo con dividendos o dólar', () => {
    const base = { basis: 'contributed', put: 1000, gain: 120, value: 1120, pct: 0.12, parts: null, partial: false }
    const plain = text(renderToStaticMarkup(h(PutSummary, { summary: base, money, pct })))
    expect(plain.indexOf('Depositado')).toBeGreaterThan(-1)
    expect(plain.indexOf('Depositado')).toBeLessThan(plain.indexOf('Ganancia'))
    expect(plain).toContain('12.0 % sobre lo depositado')
    expect(plain).not.toMatch(/Pusiste|El mercado (sumó|restó)/)
    expect(plain).toContain('US$1000.00')
    expect(plain).toContain('+US$120.00')
    expect(plain).not.toContain('De dónde viene')
    const parts = text(renderToStaticMarkup(h(PutSummary, { summary: { ...base, parts: { price: 90, dividends: 50, fx: -20 } }, money, pct })))
    for (const k of ['De dónde viene', 'Precio', 'Dividendos', 'Dólar', '−US$20.00']) expect(parts).toContain(k)
  })
  it('pérdida: "Pérdida"; sin libro, "Pagado por tus posiciones"; en otra moneda, la pregunta del dólar (sin inflación inventada)', () => {
    const loss = { basis: 'invested', put: 1000, gain: -50, value: 950, pct: -0.05, parts: null, partial: false }
    const out = text(renderToStaticMarkup(h(PutSummary, { summary: loss, money, pct, currency: 'CLP' })))
    expect(out).toContain('Pagado por tus posiciones')
    // Sin doble negación: "Pérdida US$50.00", nunca "Pérdida −US$50.00".
    expect(out).toContain('Pérdida US$50.00')
    expect(out).not.toMatch(/Pérdida\s*−/)
    expect(out).not.toContain('−US$50.00')
    expect(out).toContain('5.0 % sobre lo pagado')
    expect(out).toContain('¿Le ganaste al dólar?')
    expect(out).toContain('No, por ahora.')
    expect(out).not.toContain('inflación')
  })
  it('pérdida contra la inflación: "Perdiste 3.0 %", nunca "Sumaste −3.0 %"', () => {
    const loss = { basis: 'invested', put: 1000, gain: -30, value: 970, pct: -0.03, parts: null, partial: false }
    const out = text(renderToStaticMarkup(h(PutSummary, { summary: loss, money, pct, inflation: { pct: 0.05 } })))
    expect(out).toContain('No. Perdiste 3.0 % y la inflación del período fue +5.0 %.')
    expect(out).not.toMatch(/Sumaste\s*−|Sumaste\s*-/)
    const gain = text(renderToStaticMarkup(h(PutSummary, { summary: { ...loss, gain: 20, value: 1020, pct: 0.02 }, money, pct, inflation: { pct: 0.05 } })))
    expect(gain).toContain('No. Sumaste +2.0 %')
  })
  it('el interruptor es un switch accesible y el aviso es una nota', () => {
    const sw = renderToStaticMarkup(h(ViewToggle, { view: 'esencial', onChange: () => {} }))
    expect(sw).toMatch(/role="switch"[^>]*aria-checked="false"/)
    expect(renderToStaticMarkup(h(ViewToggle, { view: 'completa', onChange: () => {} }))).toMatch(/aria-checked="true"/)
    // El estado también en palabras, no solo por color o posición.
    expect(text(sw)).toContain('Apagada')
    expect(text(renderToStaticMarkup(h(ViewToggle, { view: 'completa', onChange: () => {} })))).toContain('Encendida')
    expect(renderToStaticMarkup(h(EduNotice))).toMatch(/role="note"[^>]*>.*Información educativa, no es recomendación de inversión\./)
  })
  it('compacto (encabezado de Inversiones): sin el párrafo visible; la explicación queda en aria-describedby y title', () => {
    const html = renderToStaticMarkup(h(ViewToggle, { view: 'esencial', onChange: () => {}, compact: true }))
    expect(html).not.toContain('<p ')
    const id = html.match(/aria-describedby="([^"]+)"/)[1]
    expect(html).toMatch(new RegExp(`<span id="${id.replace(/[:]/g, '\\$&')}" class="sr-only">Suma velas`))
    expect(html).toMatch(/title="Suma velas/)
    // Sin compact, igual que antes (la ficha del activo).
    expect(renderToStaticMarkup(h(ViewToggle, { view: 'esencial', onChange: () => {} }))).toMatch(/<p id="[^"]+" class="[^"]*">Suma velas/)
  })
})

// Arreglo 10 (26-nov-2026): la cifra de "Ganancia" no se parte en dos líneas.
describe('PutSummary: cifras sin cortar', () => {
  it('la cifra va sin saltos y con un tamaño que se ajusta al ancho', async () => {
    const { readFileSync } = await import('node:fs')
    const css = readFileSync(new URL('./esencial.module.css', import.meta.url), 'utf8')
    const rule = css.match(/\.putValue\s*\{[^}]*\}/)[0]
    expect(rule).toMatch(/white-space:\s*nowrap/)
    expect(rule).not.toMatch(/overflow-wrap:\s*anywhere/)
    expect(rule).toMatch(/font-size:\s*clamp\(/)
  })
})
