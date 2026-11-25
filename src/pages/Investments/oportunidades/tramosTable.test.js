// Tus tramos, rediseño del 24-nov-2026 (opción A, matriz): estructura de la
// tabla, estados de cada celda, totales = planCapital, lo que sigues, y
// semántica (caption, th scope, tfoot) en los 4 idiomas.
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement as h } from 'react'
import TramosTable, { columnTotals, shortAmount } from './TramosTable.jsx'
import Oportunidades from './Oportunidades.jsx'
import { readSignal } from './signals.js'
import { planCapital } from './capital.js'
import { makeFmt } from '../portfolio/format.js'
import { interpolate } from '../../../i18n/translate.js'
import es from './strings.es.js'
import en from './strings.en.js'
import pt from './strings.pt.js'
import de from './strings.de.js'

const tOf = (d) => (k, v) => interpolate(d[k] ?? k, v)
const t = tOf(es)
const fmt = makeFmt({ disp: { ccy: 'USD', rate: 1 }, currency: 'USD', language: 'es' })
const flat = (n, v = 100) => Array.from({ length: n }, () => v)
const withLast = (n, base, last) => [...flat(n - 1, base), last]
const cents = (x) => Math.round(x * 100)
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|[\u00A0\u202F]/g, ' ').replace(/\s+/g, ' ')

// A: en o bajo todas sus medias (RSI ok); B: sobre todas; C: en o bajo, RSI 60
// (bloqueado por la regla); D: 140 cierres (sin la de 200); W: lo que sigues.
const hitAll = readSignal(flat(250, 100))
const readings = {
  A: { ...hitAll, rsi: 40 },
  B: readSignal(withLast(250, 100, 130)),
  C: { ...hitAll, rsi: 60 },
  D: { ...readSignal(withLast(140, 100, 90)), rsi: 35 },
  W: readSignal(withLast(250, 100, 98)),
}
const mine = [{ t: 'A', name: 'Alfa' }, { t: 'B' }, { t: 'C' }, { t: 'D' }]
const watch = [{ t: 'W' }]
const alloc = [{ t: 'A', p: 25 }, { t: 'B', p: 25 }, { t: 'C', p: 25 }, { t: 'D', p: 25 }]
const plan = planCapital({ amount: 9000, alloc, readings, ladder: 'half200', rsiRule: true })
const render = (props = {}) => renderToStaticMarkup(h(TramosTable, { plan, mine, watch, readings, t, fmt, lad: 'half200', onOpen: () => {}, ...props }))

describe('TramosTable: estructura y semántica', () => {
  const html = render()
  it('tabla real: caption con la moneda, th scope, thead, tfoot y región con nombre', () => {
    expect(html).toMatch(/<table[^>]*>\s*<caption id="opp-tbl-cap">[^<]*US\$/)
    expect(html).toContain('role="region"')
    expect(html).toContain('aria-labelledby="opp-tbl-cap"')
    // sin desbordar no entra al orden de tabulación (se agrega solo si se desplaza)
    expect(html).not.toContain('tabindex')
    expect((html.match(/<th scope="col"/g) || []).length).toBe(6) // Activo + 4 medias + Total
    expect((html.match(/<th scope="row"/g) || []).length).toBe(4 + 1 + 2) // 4 tuyos + 1 seguido + Total y Cumple hoy
    expect(html).toContain('<thead>')
    expect(html).toContain('<tfoot>')
    expect(html).toContain('scope="rowgroup"')
  })
  it('orden del DOM = orden visual: el pie va después del último tbody', () => {
    expect(html.lastIndexOf('<tbody')).toBeLessThan(html.indexOf('<tfoot>'))
    expect(html.indexOf('</tfoot>')).toBe(html.indexOf('</table>') - '</tfoot>'.length)
  })
  it('forma ancha: precio y caída desde el máximo; en el teléfono, hoy/espera por activo para el lector', () => {
    expect(text(html)).toContain(es['opp.tbl.price'])
    expect(text(html)).toContain(es['opp.tbl.ddZero'])
    expect(text(html)).toContain(text(interpolate(es['opp.tbl.sr.row'], { a: fmt.money(2250), b: fmt.money(0) })))
  })
  it('columnas 20/50/100/200 con el peso de la escalera', () => {
    const out = text(html)
    for (const [n, w] of [[20, 10], [50, 15], [100, 25], [200, 50]]) {
      expect(out).toContain(`${n} d`)
      expect(out).toContain(`${w} %`)
    }
  })
  it('ningún activo aparece dos veces; el nombre del activo abre su ficha', () => {
    for (const tk of ['A', 'B', 'C', 'D', 'W']) expect((html.match(new RegExp(`aria-label="Abrir la ficha de ${tk}"`, 'g')) || []).length).toBe(1)
  })
  it('estado nunca solo por color: cada celda lleva texto para el lector', () => {
    expect(html).toContain('data-st="today"')
    expect(html).toContain(es['opp.res.st.today'])
    expect(html).toContain('data-st="rsi"')
    expect(html).toContain(interpolate(es['opp.res.st.rsi'], { v: 60 }))
    expect(html).toContain('data-st="wait"')
    const dB = readings.B.smas[0].dist
    expect(text(html)).toContain(text(interpolate(es['opp.res.st.wait'], { p: fmt.pct(dB, { decimals: 1 }) })))
    expect(html).toContain('data-st="none"')
    expect(html).toContain(es['opp.res.st.none'])
    // corto en el teléfono: "hoy", "RSI" y la distancia con signo
    expect(text(html)).toContain(`${es['opp.tbl.hoy']}`)
    expect(text(html)).toContain(text(fmt.pct(dB, { signed: true, decimals: 1 })))
  })
  it('sin RSI, el tramo en o bajo la media se marca como RSI (no cumple)', () => {
    const r2 = { A: { ...hitAll, rsi: null } }
    const p2 = planCapital({ amount: 100, alloc: [{ t: 'A', p: 100 }], readings: r2, rsiRule: true })
    const out = renderToStaticMarkup(h(TramosTable, { plan: p2, mine: [{ t: 'A' }], watch: [], readings: r2, t, fmt }))
    expect(out).toContain('data-st="rsi"')
    expect(out).toContain(es['opp.res.st.rsiNone'])
    expect(out).not.toContain('data-st="today"')
  })
})

describe('TramosTable: totales = planCapital', () => {
  it('Total por columna + sin lectura = monto; Cumple hoy por columna = plan.today', () => {
    const cols = columnTotals(plan)
    expect(cols.total.reduce((a, v) => a + cents(v), 0) + cents(plan.noData)).toBe(cents(plan.total))
    expect(cols.today.reduce((a, v) => a + cents(v), 0)).toBe(cents(plan.today))
    // A cumple los 4 tramos (2.250 × 10/15/25/50); C está bloqueado por RSI;
    // D no tiene la de 200: sus 2.250 van a 10/15/25 (450, 675, 1.125).
    expect(cols.today).toEqual([225 + 450, 337.5 + 675, 562.5 + 1125, 1125])
    expect(cols.total[3]).toBe(1125 * 3)
  })
  it('montos raros: suma exacta al centavo', () => {
    for (const amount of [0.07, 333.33, 1234567.89]) {
      const p = planCapital({ amount, alloc: [{ t: 'A', p: 33.3 }, { t: 'B', p: 33.3 }, { t: 'D', p: 33.4 }], readings, rsiRule: false })
      const c = columnTotals(p)
      expect(c.total.reduce((a, v) => a + cents(v), 0)).toBe(cents(p.total))
      expect(c.today.reduce((a, v) => a + cents(v), 0)).toBe(cents(p.today))
    }
  })
  it('el pie muestra esos totales', () => {
    const foot = text(render().split('<tfoot>')[1].split('</tfoot>')[0])
    const cols = columnTotals(plan)
    for (const v of [...cols.total, ...cols.today]) expect(foot).toContain(shortAmount(v))
    expect(foot).toContain(es['opp.tbl.total'])
    expect(foot).toContain(es['opp.tbl.today'])
  })
  it('monto corto: sin ",00" y con decimales cuando hay centavos', () => {
    expect(shortAmount(1125)).not.toMatch(/[.,]00$/)
    expect(shortAmount(337.5)).toMatch(/[.,]50$/)
  })
})

describe('TramosTable: lo que sigues y sin monto', () => {
  it('lo que sigues: sección aparte, solo distancia (sin monto) y ✓ en o bajo la media', () => {
    const html = render()
    const watchPart = html.split('scope="rowgroup"')[1]
    expect(watchPart).toBeTruthy()
    expect(text(html)).toContain(es['opp.tbl.watch'])
    expect(watchPart).toContain('data-st="hit"')
    expect(watchPart).toContain(interpolate(es['opp.tbl.sr.below'], { p: fmt.pct(0.02, { decimals: 1 }) }))
    expect(watchPart).not.toContain('data-st="today"')
  })
  it('sin monto: la tabla muestra solo distancias y no lleva pie', () => {
    const html = render({ plan: null })
    expect(html).not.toContain('<tfoot>')
    expect(html).toContain(es['opp.tbl.captionDist'])
    expect(html).not.toContain('data-st="today"')
    expect(html).toContain('data-st="hit"')
  })
  it('un activo tuyo que el reparto no incluye queda con su distancia, sin repetirse', () => {
    const p = planCapital({ amount: 1000, alloc: [{ t: 'A', p: 100 }], readings, rsiRule: true })
    const html = render({ plan: p })
    expect((html.match(/Abrir la ficha de B"/g) || []).length).toBe(1)
    expect(text(html)).toContain(es['opp.tbl.noAmount'])
  })
  it('cargando no es lo mismo que sin historia', () => {
    const p = planCapital({ amount: 1000, alloc: [{ t: 'Z', p: 100 }], readings: {} })
    const html = renderToStaticMarkup(h(TramosTable, { plan: p, mine: [{ t: 'Z' }], watch: [{ t: 'Q' }], readings: {}, t, fmt }))
    expect(text(html)).toContain(es['opp.tbl.loading'])
    expect(text(html)).not.toContain(es['opp.tbl.noHistory'])
  })
  it('el total con activos sin historia lleva una nota (las columnas no lo suman)', () => {
    const p = planCapital({ amount: 1000, alloc: [{ t: 'A', p: 60 }, { t: 'Z', p: 40 }], readings: { A: readings.A, Z: null } })
    const html = renderToStaticMarkup(h(TramosTable, { plan: p, mine: [{ t: 'A' }, { t: 'Z' }], watch: [], readings: { A: readings.A, Z: null }, t, fmt }))
    expect(text(html)).toContain(text(interpolate(es['opp.tbl.noDataNote'], { v: fmt.money(400) })))
    expect(text(render())).not.toContain(es['opp.tbl.noDataNote'].slice(0, 20))
  })
  it('porcentajes: "10 %" en es/pt/de y "10%" en inglés', () => {
    const out = (d) => text(renderToStaticMarkup(h(TramosTable, { plan, mine, watch, readings, t: tOf(d), fmt, lad: 'half200' })))
    expect(out(en)).toContain(' 10% ')
    expect(out(en)).not.toMatch(/\d %/)
    for (const d of [es, pt, de]) expect(out(d)).toContain(' 10 % ')
  })
  it('sin historia: la fila lo dice en vez de tramos', () => {
    const p = planCapital({ amount: 1000, alloc: [{ t: 'Z', p: 100 }], readings: { Z: null } })
    const html = renderToStaticMarkup(h(TramosTable, { plan: p, mine: [{ t: 'Z' }], watch: [], readings: { Z: null }, t, fmt }))
    expect(html).toMatch(/colspan="4"/i)
    expect(text(html)).toContain(es['opp.tbl.noHistory'])
  })
})

describe('Tus tramos: una sola tarjeta', () => {
  const pb = {
    positions: { rows: [{ t: 'A', type: 'Stock', name: 'Alfa', valueUsd: 1000 }], totals: { cost: 1000 } },
    market: { quotes: {} }, ledger: { usesCash: true, cash: 500 },
  }
  const html = renderToStaticMarkup(h(Oportunidades, { pb, fmt, demo: true, capital: 5000, targets: null, onOpen: () => {}, onDeposit: () => {} }))
  it('un título, un aviso educativo y los ajustes plegados detrás de "Cambiar"', () => {
    expect((html.match(/<section/g) || []).length).toBe(1)
    expect(html).toContain(`>${es['opp.title']}</h2>`)
    expect((html.match(new RegExp(es['opp.edu'].slice(0, 30), 'g')) || []).length).toBe(1)
    expect(html).toMatch(/aria-expanded="false"[^>]*aria-controls="opp-settings"/)
    expect(html).toMatch(/id="opp-settings"[^>]*hidden/)
    expect(text(html)).toContain(es['opp.set.m.equal'])
    expect(text(html)).toContain(interpolate(es['opp.set.lad'], { w: '10/15/25/50' }))
    expect(text(html)).toContain(es['opp.set.rsiOn'])
  })
  it('la nota del reparto único va dentro de "¿Cómo se calcula?"', () => {
    const det = html.split('<details')[1]
    expect(det).toContain(es['opp.cap.lumpNote'])
    expect(html.split('<details')[0]).not.toContain(es['opp.cap.lumpNote'])
  })
  it('atajos del monto: sin invertir y efectivo', () => {
    expect(text(html)).toContain(text(interpolate(es['opp.cap.fromFree'], { v: fmt.money(4000) })))
    expect(text(html)).toContain(text(interpolate(es['opp.cap.fromCash'], { v: fmt.money(500) })))
    expect(html).toContain('aria-pressed="false"')
  })
})

describe('textos de Tus tramos en 4 idiomas', () => {
  it('mismas claves en es/en/pt/de y sin claves huérfanas', () => {
    const keys = Object.keys(es).sort()
    for (const d of [en, pt, de]) expect(Object.keys(d).sort()).toEqual(keys)
  })
  it('nunca "compra" ni "recomendado"; español neutro, sin voseo; alemán con "Sie"', () => {
    const bad = /\b(compra|compre|vende|venda|te recomendamos|recomendado|buy|sell|we recommend|kaufen|verkaufen|compre|venda)\b/i
    for (const d of [es, en, pt, de]) expect(Object.entries(d).filter(([, v]) => bad.test(v))).toEqual([])
    const voseo = /\b(tenés|querés|podés|escribí|elegí|usá|mirá|sabés|vos)\b/i
    expect(Object.entries(es).filter(([, v]) => voseo.test(v))).toEqual([])
    expect(Object.entries(de).filter(([, v]) => /\b(du|dein|deine|dir|dich)\b/.test(v))).toEqual([])
    for (const d of [es, en, pt, de]) expect(d['opp.tbl.caption']).toContain('US$')
  })
})
