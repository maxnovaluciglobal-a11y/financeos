// Indicadores en grilla (26-nov-2026): cada lectura larga tiene su versión corta
// para la tarjeta, en los 4 idiomas, y la pestaña usa la grilla de Fundamentales.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import es from './strings.es.js'
import en from './strings.en.js'
import pt from './strings.pt.js'
import de from './strings.de.js'

const readings = Object.keys(es).filter(k => /^asset\.rd\.[a-z0-9]+\.[A-Za-z]+$/i.test(k) && !/\.(label|range)$/.test(k))

describe('indicadores en grilla', () => {
  it('hay lecturas para revisar', () => { expect(readings.length).toBeGreaterThan(10) })
  for (const [lang, dict] of Object.entries({ es, en, pt, de })) {
    it(`${lang}: cada lectura tiene su versión corta, de una línea`, () => {
      for (const k of readings) {
        const short = dict[`${k}.short`]
        expect(short, `${lang} ${k}.short`).toBeTruthy()
        expect(short.length, `${lang} ${k}.short`).toBeLessThanOrEqual(34)
      }
      expect(dict['asset.ind.explain']).toBeTruthy()
      expect(dict['asset.ind.explainHide']).toBeTruthy()
    })
  }
  it('la pestaña usa la grilla de Fundamentales y pliega las explicaciones', () => {
    const src = readFileSync(join(__dirname, 'Panes.jsx'), 'utf8')
    const pane = src.slice(src.indexOf('export function IndicatorsPane'), src.indexOf('// ── Fundamentales ──'))
    expect(pane).toMatch(/className=\{s\.metrics\}/)
    expect(pane).toMatch(/aria-expanded=\{explain\}/)
    expect(pane).toMatch(/\{explain && \(/)
  })
})
