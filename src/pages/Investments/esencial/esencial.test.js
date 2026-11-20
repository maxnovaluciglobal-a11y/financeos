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
import { es as appEs } from '../../../i18n/es.js'
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
    const same = new Set(['ess.put.part.dividends', 'ess.put.part.fx']) // "Dividendos" y "Dólar" son iguales en portugués
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
  it('Pusiste primero, luego El mercado sumó, y el desglose solo con dividendos o dólar', () => {
    const base = { basis: 'contributed', put: 1000, gain: 120, value: 1120, pct: 0.12, parts: null, partial: false }
    const plain = text(renderToStaticMarkup(h(PutSummary, { summary: base, money, pct })))
    expect(plain.indexOf('Pusiste')).toBeLessThan(plain.indexOf('El mercado sumó'))
    expect(plain).toContain('US$1000.00')
    expect(plain).toContain('+US$120.00')
    expect(plain).not.toContain('De dónde viene')
    const parts = text(renderToStaticMarkup(h(PutSummary, { summary: { ...base, parts: { price: 90, dividends: 50, fx: -20 } }, money, pct })))
    for (const k of ['De dónde viene', 'Precio', 'Dividendos', 'Dólar', '−US$20.00']) expect(parts).toContain(k)
  })
  it('pérdida: "El mercado restó"; en otra moneda, la pregunta del dólar (sin inflación inventada)', () => {
    const loss = { basis: 'invested', put: 1000, gain: -50, value: 950, pct: -0.05, parts: null, partial: false }
    const out = text(renderToStaticMarkup(h(PutSummary, { summary: loss, money, pct, currency: 'CLP' })))
    expect(out).toContain('El mercado restó')
    expect(out).toContain('¿Le ganaste al dólar?')
    expect(out).toContain('No, por ahora.')
    expect(out).not.toContain('inflación')
  })
  it('el interruptor es un switch accesible y el aviso es una nota', () => {
    const sw = renderToStaticMarkup(h(ViewToggle, { view: 'esencial', onChange: () => {} }))
    expect(sw).toMatch(/role="switch"[^>]*aria-checked="false"/)
    expect(renderToStaticMarkup(h(ViewToggle, { view: 'completa', onChange: () => {} }))).toMatch(/aria-checked="true"/)
    expect(renderToStaticMarkup(h(EduNotice))).toMatch(/role="note"[^>]*>.*Información educativa, no es recomendación de inversión\./)
  })
})
