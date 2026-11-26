// Pestaña Hoy (F2): el ejemplo es coherente con el demo de Panorama, la
// pantalla se arma completa con datos inyectados, el estado vacío trae sus 3
// caminos y el aporte del mes guarda solo un monto.
import { describe, it, expect, vi, afterEach } from 'vitest'
// Textos de Inversiones registrados como al entrar a la sección.
import '../i18n/investStrings.js'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { es } from '../../../i18n/withSections.js'

vi.mock('../../../i18n/useT.js', () => {
  const fill = (s, p = {}) => String(s).replace(/\{(\w+)\}/g, (_, k) => (k in p ? p[k] : `{${k}}`))
  const useT = () => ({ t: (k, p) => (k in es ? fill(es[k], p) : k), lang: 'es' })
  return { useT, useTFor: useT }
})

const { default: Hoy } = await import('./Hoy.jsx')
const { AppContext } = await import('../../../context/AppContext.jsx')
const { readAporte, saveAporte, commitAporte, APORTE_KEY } = await import('./aporteStore.js')
const demo = await import('../../../demo/demoInvestHoy.js')
const { demoInvestSnapshot } = await import('../../../demo/demoInvest.js')
const { portfolioTotals, currencyOf } = await import('../../../utils/investValuation.js')
const { cashBook } = await import('../../../utils/investCash.js')
const { historySymbol, scoreCloses, reviewToday, stripFadeOf } = await import('../../../utils/investHoy.js')
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
// Las pruebas de siempre miran la Vista completa; la esencial tiene las suyas.
const render = (data, settings = { currency: 'USD', language: 'es' }, view = 'completa') => renderToStaticMarkup(
  h(AppContext.Provider, { value: { settings, expenses: [], showToast: () => {} } },
    h(Hoy, { demo: true, onOpen: () => {}, onTab: () => {}, useData: () => data, view })),
)

describe('datos de ejemplo de Hoy', () => {
  it('suman lo mismo que el snapshot del demo (Panorama y Portafolio)', () => {
    const snap = demoInvestSnapshot()
    const T = portfolioTotals(demo.demoHoldings(), t => demo.demoQuotes()[t], t => currencyOf(t), {})
    expect(T.value).toBeCloseTo(snap.valueUsd)
    expect(T.cost).toBeCloseTo(snap.costUsd)
    expect(T.day).toBeCloseTo(snap.dayUsd, 0)
  })
  it('el libro de ejemplo cuadra (el mismo de Portafolio, QA I2): efectivo 1.062, aportado 12.000, ganancia = valor − aportado', () => {
    const B = cashBook(demo.demoOperations(), demo.demoHoldings(), { ccyOf: () => 'USD', priceOf: t => demo.demoQuotes()[t].price, toUsd: v => v })
    // 12.000 depositados − 11.400 en compras + 380 de la venta + 82 de dividendos.
    expect(B.cash).toBeCloseTo(1062)
    expect(B.contributed).toBeCloseTo(12000)
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

describe('<Hoy> en la vista esencial (por defecto)', () => {
  it('abre con Depositado frente a ganancia, sin cinta, sin riesgo al stop ni "Para revisar hoy"', () => {
    const out = text(render(sampleData(), { currency: 'USD', language: 'es' }, 'esencial'))
    // Primera lectura: el título (para lector de pantalla), el valor y lo depositado.
    expect(out.trim().indexOf('Depositado frente a ganancia')).toBe(0)
    expect(out.indexOf('Valor de tu portafolio')).toBeLessThan(out.search(/Depositado (US)?\$/))
    expect(out.indexOf('Valor de tu portafolio')).toBeLessThan(out.indexOf('Datos de ejemplo'))
    expect(out).toMatch(/Ganancia|Pérdida/)
    // La banda de valor de siempre no se repite debajo.
    expect(out.split('Valor de tu portafolio')).toHaveLength(2)
    expect(out).not.toMatch(/Pusiste|El mercado (sumó|restó)/)
    for (const k of ['Dow 30', 'Tu riesgo hoy', 'Para revisar hoy', 'Riesgo al stop', 'Resultado sobre el costo']) expect(out, k).not.toContain(k)
    // Lo demás sigue: gráfico de valor y posiciones; el efectivo, en la cabecera.
    for (const k of ['Valor en el tiempo', 'Tus posiciones', 'US$1.062,00 sin invertir']) expect(out, k).toContain(k)
  })
  it('orden de Resumen (propuesta 4): valor, tus posiciones, valor en el tiempo, tus reglas, mercado y pie', () => {
    const out = text(render(sampleData(), { currency: 'USD', language: 'es' }, 'esencial'))
    const order = ['Valor de tu portafolio', 'sin invertir', '¿De dónde viene la ganancia?', 'Tus posiciones', 'Valor en el tiempo', 'Tus reglas hoy', 'Ver mercado', 'Fuentes y licencias']
    let at = -1
    for (const k of order) {
      const i = out.indexOf(k)
      expect(i, k).toBeGreaterThan(at)
      at = i
    }
    // Salen las tarjetas repetidas: sus datos y accesos quedan en la cabecera y en "Tus reglas hoy".
    for (const k of ['Efectivo y aportes', '¿Cuánto puedes aportar este mes?']) expect(out, k).not.toContain(k)
    expect(out).not.toMatch(/<h2[^>]*>Tus tramos</)
    // El pie no repite "Datos de ejemplo" (queda el indicador de arriba y la nota del gráfico).
    expect(out.split('Datos de ejemplo: no son precios reales.').length - 1).toBeLessThanOrEqual(1)
  })
  it('la cabecera trae "sin invertir · Repartir" y "¿De dónde viene la ganancia?" plegado, con el detalle debajo', () => {
    const html = render(sampleData(), { currency: 'USD', language: 'es' }, 'esencial')
    expect(html).toMatch(/aria-label="Repartir US\$1\.062,00 en Planificar › Aportes"/)
    expect(html).toMatch(/aria-expanded="false" aria-controls="hoy-why"[^>]*>¿De dónde viene la ganancia\?/)
    expect(html).toMatch(/id="hoy-why"[^>]*hidden=""/)
    // El detalle (antes una tarjeta aparte) sigue en la página, plegado.
    const why = html.slice(html.indexOf('id="hoy-why"'))
    expect(text(why)).toContain('tus depósitos menos tus retiros')
    expect(text(why)).toContain('Precio')
    expect(text(why)).toContain('Dividendos')
    // Los dos párrafos largos ya no van dentro de la banda.
    expect(text(html)).not.toContain('El valor incluye US$1.062,00 de efectivo sin invertir.')
  })
  it('con pérdida, el enlace pregunta de dónde viene la pérdida', () => {
    const q = demo.demoQuotes()
    const low = Object.fromEntries(Object.entries(q).map(([k, v]) => [k, { ...v, price: v.price * 0.5 }]))
    expect(text(render(sampleData({ quotes: low }), { currency: 'USD', language: 'es' }, 'esencial'))).toContain('¿De dónde viene la pérdida?')
  })
  it('con el libro de ejemplo, Depositado es lo aportado (12.000, igual que Portafolio) y la ganancia es valor − aportado', () => {
    const out = text(render(sampleData(), { currency: 'USD', language: 'es' }, 'esencial'))
    expect(out).toMatch(/Depositado (US)?\$ ?12\.000,00/)
    expect(out).toContain('tus depósitos menos tus retiros')
    expect(out).not.toContain('Aún no registraste depósitos')
  })
  it('sin depósitos registrados lo dice y ofrece registrarlos (nunca llama "depositado" al costo)', () => {
    const out = text(render(sampleData({ ops: [] }), { currency: 'USD', language: 'es' }, 'esencial'))
    expect(out).toContain('Pagado por tus posiciones')
    expect(out).not.toMatch(/Depositado (US)?\$/)
    expect(out).toContain('Aún no registraste depósitos')
    expect(out).toContain('Registrar depósitos')
  })
  it('cada posición trae su minigráfico en el período del gráfico de valor', () => {
    const html = render(sampleData(), { currency: 'USD', language: 'es' }, 'esencial')
    expect(text(html)).toContain('Minigráficos: Último año')
    expect(html).toMatch(/role="img" aria-label="Precio, Último año: [+−-]/)
  })
  it('en otra moneda pregunta si le ganó al dólar; en US$ no (no hay inflación en dólares para comparar)', () => {
    const usd = text(render(sampleData(), { currency: 'USD', language: 'es' }, 'esencial'))
    expect(usd).not.toContain('¿Le ganaste')
    const clp = text(render(sampleData(), { currency: 'CLP', language: 'es' }, 'esencial'))
    expect(clp).toContain('¿Le ganaste al dólar?')
    expect(clp).not.toContain('inflación')
  })
})

describe('<Hoy>', () => {
  it('arma la pantalla completa en el orden de la propuesta 4, rotulada como ejemplo', () => {
    const out = text(render(sampleData()))
    const order = ['Depositado frente a ganancia', 'Valor de tu portafolio', 'Datos de ejemplo', 'Tus posiciones', 'Tu riesgo hoy', 'Para revisar hoy', 'Valor en el tiempo', 'Tus reglas hoy', 'Dow 30', 'Ver mercado']
    let at = -1
    for (const k of order) {
      const i = out.indexOf(k)
      expect(i, k).toBeGreaterThan(at)
      at = i
    }
    expect(out).toContain('S&P 500 (SPY)')
    // M12 (QA): Chile (ECH) solo para quien vive en Chile.
    expect(out).not.toContain('Chile (ECH)')
    expect(text(render(sampleData(), { currency: 'CLP', language: 'es', country: 'CL' }))).toContain('Chile (ECH)')
    for (const r of ['1S', '1M', '3M', 'YTD', '1A', 'Todo']) expect(out).toContain(r)
    // En la Vista completa, el resultado sobre el costo va aparte de la ganancia frente a lo depositado.
    expect(out).toContain('Resultado sobre el costo')
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
  it('el gráfico espera todas las historias: nada de serie parcial ni "Sin historial" por las que siguen cargando', () => {
    const late = historySymbol(demo.demoHoldings()[0])
    const out = text(render(sampleData({ historyOf: (sym, r = '1y') => (sym === late ? undefined : demo.demoHistory(sym, r)) })))
    expect(out).toContain(es['invest.hoy.pvh.loading'])
    expect(out).not.toContain('Sin historial en la fuente')
    expect(out).not.toMatch(/Entre el .+ el valor pasó de/)
  })
  it('sin posiciones y con aportes marcados en CLP, pide los tipos de cambio (needFx)', () => {
    const calls = []
    const data = { ...sampleData({ holdings: [], quotes: {}, ops: [] }), sample: false }
    const expenses = [{ inv: true, date: '2026-11-03', amount: 400000 }]
    const settings = { currency: 'CLP', language: 'es', activeMonth: '2026-11' }
    const out = text(renderToStaticMarkup(
      h(AppContext.Provider, { value: { settings, expenses, showToast: () => {} } },
        h(Hoy, { onOpen: () => {}, onTab: () => {}, useData: (o) => { calls.push(o); return data } })),
    ))
    expect(calls[0]).toMatchObject({ needFx: true })
    // Sin tasa: el aviso muestra el monto en su moneda, sin un "≈ US$" inventado.
    expect(out).toContain('Aportes de este mes en moyiq')
    expect(out).not.toContain('≈ US$')
    const usd = []
    renderToStaticMarkup(h(AppContext.Provider, { value: { settings: { ...settings, currency: 'USD' }, expenses, showToast: () => {} } },
      h(Hoy, { onOpen: () => {}, onTab: () => {}, useData: (o) => { usd.push(o); return data } })))
    expect(usd[0]).toMatchObject({ needFx: false })
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
  it('sin tipo de cambio (CLP) no guarda nada ni convierte 1:1: devuelve la moneda para avisar', () => {
    const store = new Map()
    const events = []
    globalThis.window = { dispatchEvent: (e) => events.push(e) }
    const r = commitAporte({ usd: null, ccy: 'CLP' }, (k, v) => store.set(k, v))
    expect(r).toMatchObject({ ok: false, saved: false, noRate: 'CLP' })
    expect(store.size).toBe(0)
    expect(events).toHaveLength(0)
  })
  it('en el ejemplo no guarda ni avisa a Planificar', () => {
    const store = new Map()
    const events = []
    globalThis.window = { dispatchEvent: (e) => events.push(e) }
    expect(commitAporte({ usd: 750, ccy: 'USD', sample: true }, (k, v) => store.set(k, v))).toMatchObject({ ok: true, saved: false, usd: 750 })
    expect(store.size).toBe(0)
    expect(events).toHaveLength(0)
  })
  it('con monto en US$ guarda y avisa', () => {
    const store = new Map()
    const events = []
    globalThis.window = { dispatchEvent: (e) => events.push(e) }
    globalThis.CustomEvent ??= class { constructor(type, init) { this.type = type; this.detail = init?.detail } }
    expect(commitAporte({ usd: 420.004, ccy: 'CLP' }, (k, v) => store.set(k, v))).toMatchObject({ ok: true, saved: true, usd: 420 })
    expect(store.get(APORTE_KEY)).toBe('420')
    expect(events[0].detail).toEqual({ usd: 420 })
  })
})

describe('degradados de la cinta', () => {
  it('a la derecha al inicio, a los dos lados en el medio, a la izquierda al final, ninguno si entra entera', () => {
    expect(stripFadeOf({ scrollLeft: 0, scrollWidth: 900, clientWidth: 300 })).toEqual({ l: false, r: true })
    expect(stripFadeOf({ scrollLeft: 200, scrollWidth: 900, clientWidth: 300 })).toEqual({ l: true, r: true })
    expect(stripFadeOf({ scrollLeft: 599, scrollWidth: 900, clientWidth: 300 })).toEqual({ l: true, r: false })
    expect(stripFadeOf({ scrollLeft: 0, scrollWidth: 300, clientWidth: 300 })).toEqual({ l: false, r: false })
    expect(stripFadeOf(null)).toEqual({ l: false, r: false })
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
