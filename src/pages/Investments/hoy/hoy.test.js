// Pestaña Hoy (F2): el ejemplo es coherente con el demo de Panorama, la
// pantalla se arma completa con datos inyectados, el estado vacío trae sus 3
// caminos y el aporte del mes guarda solo un monto.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { es } from '../../../i18n/es.js'

vi.mock('../../../i18n/useT.js', () => {
  const fill = (s, p = {}) => String(s).replace(/\{(\w+)\}/g, (_, k) => (k in p ? p[k] : `{${k}}`))
  const useT = () => ({ t: (k, p) => (k in es ? fill(es[k], p) : k), lang: 'es' })
  return { useT, useTFor: useT }
})

const { default: Hoy } = await import('./Hoy.jsx')
const { AppContext } = await import('../../../context/AppContext.jsx')
const { readAporte, saveAporte, APORTE_KEY } = await import('./aporteStore.js')
const demo = await import('../../../demo/demoInvestHoy.js')
const { demoInvestSnapshot } = await import('../../../demo/demoInvest.js')
const { portfolioTotals, currencyOf } = await import('../../../utils/investValuation.js')
const { cashBook } = await import('../../../utils/investCash.js')
const { historySymbol, scoreCloses, reviewToday } = await import('../../../utils/investHoy.js')
const { RULE_DEFAULTS } = await import('../../../core/investData.js')

const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ')

function sampleData(over = {}) {
  const market = demo.demoMarket()
  return {
    phase: 'ready', error: null, holdings: demo.demoHoldings(), quotes: demo.demoQuotes(), quotesFailed: false,
    rates: {}, latam: null, stopColumn: true, watch: demo.DEMO_WATCH, capital: demo.DEMO_CAPITAL, rule: RULE_DEFAULTS,
    ops: demo.demoOperations(), opsMissing: false, at: Date.now(), sample: true,
    market: { phase: 'ready', ...market }, sparks: Object.fromEntries(market.items.map(it => [it.sym, it.spark])),
    historyOf: (sym, r = '1y') => demo.demoHistory(sym, r), historySymbol, pendingHistory: 0,
    reload: () => {}, retryHistory: () => {},
    ...over,
  }
}
const render = (data, settings = { currency: 'USD', language: 'es' }) => renderToStaticMarkup(
  h(AppContext.Provider, { value: { settings, expenses: [], showToast: () => {} } },
    h(Hoy, { demo: true, onOpen: () => {}, onTab: () => {}, useData: () => data })),
)

describe('datos de ejemplo de Hoy', () => {
  it('suman lo mismo que el snapshot del demo (Panorama y Portafolio)', () => {
    const snap = demoInvestSnapshot()
    const T = portfolioTotals(demo.demoHoldings(), t => demo.demoQuotes()[t], t => currencyOf(t), {})
    expect(T.value).toBeCloseTo(snap.valueUsd)
    expect(T.cost).toBeCloseTo(snap.costUsd)
    expect(T.day).toBeCloseTo(snap.dayUsd, 0)
  })
  it('el libro de ejemplo cuadra: efectivo 500, aportado 11.500, ganancia = valor − aportado', () => {
    const B = cashBook(demo.demoOperations(), demo.demoHoldings(), { ccyOf: () => 'USD', priceOf: t => demo.demoQuotes()[t].price, toUsd: v => v })
    expect(B.cash).toBeCloseTo(500)
    expect(B.contributed).toBeCloseTo(11500)
    expect(B.gain).toBeCloseTo(B.value - B.contributed)
  })
  it('las series terminan en el precio de ejemplo y "Para revisar hoy" tiene algo que mostrar', () => {
    for (const hd of demo.demoHoldings()) {
      const rows = demo.demoHistory(historySymbol(hd), '1y')
      expect(rows.at(-1).close).toBeCloseTo(demo.demoQuotes()[hd.t].price, 1)
    }
    const scores = {}
    for (const t of [...demo.demoHoldings().map(historySymbol), ...demo.DEMO_WATCH]) scores[t] = scoreCloses(demo.demoHistory(t, '1y').map(r => r.close))
    const r = reviewToday({ holdings: demo.demoHoldings().map(x => ({ t: historySymbol(x) })), watch: demo.DEMO_WATCH, scores })
    expect(r.state).toBe('ready')
    expect(r.below.map(x => x.t)).toContain('MSFT')
    expect(r.rsiOut.length).toBeGreaterThan(0)
  })
  it('son deterministas', () => {
    expect(demo.demoHistory('VOO', '1y')).toEqual(demo.demoHistory('VOO', '1y'))
  })
})

describe('<Hoy>', () => {
  it('arma la pantalla completa en el orden de Invest, rotulada como ejemplo', () => {
    const out = text(render(sampleData()))
    const order = ['Datos de ejemplo', 'Dow 30', 'Valor de tu portafolio', 'Tu riesgo hoy', 'Para revisar hoy', 'Valor en el tiempo', 'Tus posiciones', 'Efectivo y aportes', '¿Cuánto puedes aportar este mes?', 'Ver mercado']
    let at = -1
    for (const k of order) {
      const i = out.indexOf(k)
      expect(i, k).toBeGreaterThan(at)
      at = i
    }
    expect(out).toContain('S&P 500 (SPY)')
    expect(out).toContain('Chile (ECH)')
    for (const r of ['1M', '3M', 'Año', '1A', 'Máx']) expect(out).toContain(r)
    expect(out).toContain('Datos para revisar, no instrucciones de compra o venta.')
    expect(out).not.toContain('Yahoo Finance,') // el ejemplo no se atribuye a ninguna fuente
  })
  it('el riesgo usa los stops guardados y el límite de la regla', () => {
    const out = text(render(sampleData({ rule: { risk: 2, limit: 60 } })))
    expect(out).toContain('2 posiciones sin stop: no se cuentan en este total')
    expect(out).toContain('tu límite es 60')
    const est = text(render(sampleData({ stopColumn: false })))
    expect(est).toContain('se estima con −8 %')
  })
  it('el gráfico es un control deslizante con teclado y resumen en texto', () => {
    const html = render(sampleData())
    expect(html).toMatch(/role="slider"[^>]*tabindex="0"/)
    expect(html).toMatch(/aria-valuetext="[^"]+"/)
    expect(text(html)).toMatch(/Entre el .+ el valor pasó de/)
  })
  it('sin posiciones: estado vacío con los 3 caminos, sin cinta ni gráfico', () => {
    const out = text(render(sampleData({ holdings: [], quotes: {}, ops: [] })))
    expect(out).toContain('Empieza con tu portafolio')
    for (const k of ['Agregar mi primera posición', 'Importar CSV', 'Ver un ejemplo']) expect(out).toContain(k)
    expect(out).not.toContain('Valor en el tiempo')
    expect(out).not.toContain('Dow 30')
  })
  it('"Para revisar hoy" no queda cargando cuando la historia falló', () => {
    const out = text(render(sampleData({ historyOf: () => null })))
    expect(out).toContain('No se pudieron cargar los datos históricos')
    expect(out).not.toContain('Calculando indicadores')
  })
  it('error de carga con reintento', () => {
    const out = text(render(sampleData({ phase: 'error' })))
    expect(out).toContain(es['invest.card.retry'])
  })
})

describe('aporte del mes', () => {
  afterEach(() => { delete globalThis.window })
  it('guarda solo el monto en US$ redondeado y avisa a Planificar', () => {
    const store = new Map()
    const events = []
    globalThis.window = { dispatchEvent: (e) => events.push(e) }
    globalThis.CustomEvent ??= class { constructor(type, init) { this.type = type; this.detail = init?.detail } }
    expect(saveAporte(410.555, (k, v) => store.set(k, v))).toBe(true)
    expect([...store.keys()]).toEqual([APORTE_KEY])
    expect(store.get(APORTE_KEY)).toBe('410.56')
    expect(events[0].detail).toEqual({ usd: 410.56 })
    expect(readAporte(k => store.get(k))).toBe(410.56)
    expect(saveAporte(0, () => { throw new Error('no') })).toBe(false)
    expect(readAporte(() => 'x')).toBeNull()
  })
})

describe('privacidad de Hoy', () => {
  it('no guarda tickers ni posiciones en el dispositivo: solo el período, el índice y el monto del aporte', async () => {
    const fs = await import('fs')
    const dir = new URL('.', import.meta.url)
    const src = ['Hoy.jsx', 'useHoyData.js', 'ValueChart.jsx'].map(f => fs.readFileSync(new URL(f, dir), 'utf8')).join('\n')
    expect(src).not.toMatch(/sessionStorage|indexedDB/)
    // Un solo setItem: el de writeKey; todo lo que se escribe pasa por ahí.
    expect(src.match(/setItem\(/g)).toHaveLength(1)
    const writes = [...src.matchAll(/writeKey\(([^,]+),/g)].map(m => m[1].trim())
    expect(new Set(writes)).toEqual(new Set(['RANGE_KEY', 'CMP_KEY']))
  })
})
