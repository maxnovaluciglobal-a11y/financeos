// Ayuda de Inversiones (F7): preguntas completas en 4 idiomas, acordeón
// accesible, que diga con exactitud dónde viven los datos y que se cargue
// solo al pedirla.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import es from './strings.es.js'
import en from './strings.en.js'
import pt from './strings.pt.js'
import de from './strings.de.js'
import { interpolate } from '../../../i18n/translate.js'
import { HELP_GROUPS, HELP_EMAIL } from './dict.js'
import { HelpBody } from './InvestHelp.jsx'

const L = { es, en, pt, de }
const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join()
const tFor = (d) => (k, v) => interpolate(d[k] ?? k, v)
const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')

describe('Ayuda de Inversiones: textos', () => {
  it('cada grupo y pregunta tiene título, pregunta y respuesta en los 4 idiomas', () => {
    for (const d of Object.values(L)) {
      for (const g of HELP_GROUPS) {
        expect(typeof d[`hlp.g.${g.id}`], g.id).toBe('string')
        for (const q of g.qs) {
          expect(d[`hlp.q.${q}`], q).toBeTruthy()
          expect(d[`hlp.a.${q}`], q).toBeTruthy()
        }
      }
    }
  })
  for (const lang of ['en', 'pt', 'de']) {
    it(`${lang}: mismas claves, variables y párrafos que el español`, () => {
      expect(Object.keys(L[lang]).sort()).toEqual(Object.keys(es).sort())
      for (const k of Object.keys(es)) {
        expect(vars(L[lang][k]), k).toBe(vars(es[k]))
        expect(String(L[lang][k]).split('\n\n').length, k).toBe(String(es[k]).split('\n\n').length)
      }
    })
  }
  it('cubre las preguntas de la ayuda vieja (13) más las de alertas', () => {
    const all = HELP_GROUPS.flatMap(g => g.qs)
    expect(all.length).toBe(16)
    for (const q of ['fresh', 'ma', 'rsi', 'macd', 'calc', 'stop', 'cash', 'tramos', 'where', 'ai', 'free', 'alertsHow', 'alertsOld']) expect(all).toContain(q)
  })
  it('dice con exactitud dónde viven los datos: cuenta, servidor y RLS; no en el dispositivo', () => {
    const a = es['hlp.a.where']
    expect(a).toMatch(/servidor/)
    expect(a).toMatch(/RLS/)
    expect(a).toMatch(/no en el dispositivo/)
    for (const w of ['posiciones', 'movimientos', 'lista', 'alertas', 'capital']) expect(a).toContain(w)
    expect(a).toMatch(/exportar/)
    expect(a).toMatch(/eliminar/i)
    for (const d of [en, pt, de]) expect(d['hlp.a.where']).toMatch(/RLS/)
  })
  it('alertas: funcionan con la app cerrada y las de invest.moyiq.app no se trasladaron', () => {
    expect(es['hlp.a.alertsHow']).toMatch(/app esté cerrada/)
    expect(es['hlp.q.alertsOld']).toContain('invest.moyiq.app')
    expect(es['hlp.a.alertsOld']).toMatch(/^No se trasladaron/)
    expect(es['hlp.a.alertsOld']).toMatch(/solo en el navegador/)
  })
  it('sin IA para recomendar; gratis y educativo; pie educativo', () => {
    expect(es['hlp.a.ai']).toMatch(/^No\./)
    expect(es['hlp.a.free']).toMatch(/gratis/)
    expect(es['hlp.foot']).toBe('moyiq · Inversiones · análisis educativo · no es asesoría financiera.')
  })
  it('español neutro con "tú", sin exclamaciones ni emoji', () => {
    const vos = /(?<![\p{L}])(tenés|podés|querés|sabés|elegí|tocá|mirá|buscá|agregá|escribí|probá|hacé|usá|guardá|revisá|activá|creá|volvé|vos)(?![\p{L}])/iu
    for (const [k, v] of Object.entries(es)) expect(vos.test(v), k).toBe(false)
    for (const d of Object.values(L)) for (const [k, v] of Object.entries(d)) {
      expect(/!/.test(v), k).toBe(false)
      expect(/\p{Extended_Pictographic}/u.test(v), k).toBe(false)
    }
    // Alemán con "Sie".
    expect(de['hlp.intro']).toMatch(/Sie/)
  })
})

describe('Ayuda de Inversiones: pantalla', () => {
  it('un <details>/<summary> por pregunta, encabezados por grupo, contacto y pie', () => {
    const html = renderToStaticMarkup(h(HelpBody, { t: tFor(es), onClose: () => {} }))
    const n = HELP_GROUPS.reduce((a, g) => a + g.qs.length, 0)
    expect(html.match(/<details/g)).toHaveLength(n)
    expect(html.match(/<summary>/g)).toHaveLength(n)
    expect(html.match(/<h3 /g)).toHaveLength(HELP_GROUPS.length)
    expect(html).toContain(`href="mailto:${HELP_EMAIL}"`)
    expect(html).toContain(`aria-label="${es['hlp.close']}"`)
    expect(html).toContain('role="note"')
    // Párrafos separados.
    expect(html).toContain('<p>Inversiones tiene cinco pestañas.</p>')
  })
  it('en inglés no queda nada en español', () => {
    const html = renderToStaticMarkup(h(HelpBody, { t: tFor(en) }))
    expect(html).not.toMatch(/Inversiones|Cerrar|¿/)
  })
  it('el correo de soporte es el mismo en la ayuda y en Ajustes › Inversiones', async () => {
    const { SUPPORT_EMAIL } = await import('../settings/model.js')
    expect(HELP_EMAIL).toBe(SUPPORT_EMAIL)
  })
  it('se carga con lazy() desde el hub (no viaja en el chunk de Inversiones)', () => {
    const hub = read('../hub/InvestHub.jsx')
    expect(hub).toMatch(/lazy\(\(\) => import\('\.\.\/help\/InvestHelp\.jsx'\)\)/)
    expect(hub).not.toMatch(/from '\.\.\/help\//)
  })
})
