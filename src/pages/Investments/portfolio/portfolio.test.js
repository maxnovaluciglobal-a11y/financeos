// Portafolio (F1): lógica de pantalla, textos en 4 idiomas, ejemplo coherente
// con demoInvestSnapshot/demoInvestRows y la pantalla de Posiciones pintada.
import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initialDisplayCcy, movementTotals, aporteOffer, priceSources, fundamentalSources, capitalLine, riskShare, monthsSummary, tickersOf } from './view.js'
import { ptFor, loadPT } from './text.js'
import { es as ES } from './text.es.js'
import { en as EN } from './text.en.js'
import { pt as PT } from './text.pt.js'
import { de as DE } from './text.de.js'
import { costTable, realizedSells, book } from '../../../utils/investLedger.js'
import { positionRows } from '../../../utils/investPositions.js'
import { parseHoldingsCsv, holdingsCsv, parseBackup, backupJson } from '../../../utils/investCsv.js'
import { toUsd, currencyOf } from '../../../utils/investValuation.js'
import { createDemoInvestStore, demoInvestHoldings, demoInvestOps, demoInvestQuotes } from '../../../demo/demoInvestBook.js'
import { demoInvestRows, demoInvestSnapshot } from '../../../demo/demoInvest.js'

const DIR = dirname(fileURLToPath(import.meta.url))
const RATES = { CLP: 1000 }
const usd = (v, c) => toUsd(v, c, RATES)
const ccyOf = (t) => currencyOf(t)

describe('moneda de las cifras', () => {
  it('la guardada, si no la de moyiq, si no USD', () => {
    expect(initialDisplayCcy('CLP', 'MXN')).toBe('CLP')
    expect(initialDisplayCcy(null, 'mxn')).toBe('MXN')
    expect(initialDisplayCcy('EUR', 'VES')).toBe('USD')
    expect(initialDisplayCcy(undefined, undefined)).toBe('USD')
  })
})

describe('Movimientos: banda y tabla dan el mismo resultado realizado', () => {
  const op = (id, type, ticker, f = {}) => ({ id, uid: `u${id}`, type, ticker, date: `2026-0${id}-01`, amount: 0, ...f })
  const ops = [
    op(1, 'deposit', null, { amount: 5000 }),
    op(2, 'buy', 'AAPL', { qty: 10, price: 100, amount: 1000, cash: true }),
    op(3, 'buy', 'AAPL', { qty: 10, price: 200, amount: 2000, cash: true }),
    op(4, 'sell', 'AAPL', { qty: 5, price: 180, amount: 900, cash: true }), // sin pnl: promedio 150 → +150
    op(5, 'sell', 'AAPL', { qty: 5, price: 120, amount: 600, cash: true, pnl: -100 }), // pnl guardado
    op(6, 'dividend', 'AAPL', { amount: 12 }),
    op(7, 'buy', 'SQM-B.SN', { qty: 10, price: 50000, amount: 500000, currency: 'CLP', cash: false }),
  ]
  const mt = movementTotals(ops, ccyOf, usd)
  it('realizado = suma de la tabla de costo promedio', () => {
    const table = costTable(ops, ccyOf, usd).reduce((a, r) => a + (r.realized || 0), 0)
    expect(mt.realized).toBeCloseTo(50, 6)
    expect(mt.realized).toBeCloseTo(table, 6)
    expect(mt.sells).toBe(2)
  })
  it('invertido suma las compras en USD (la chilena a su tasa) y cuenta los dividendos', () => {
    expect(mt.invested).toBeCloseTo(1000 + 2000 + 500, 6)
    expect(mt.buys).toBe(3)
    expect(mt.dividends).toBe(12)
    expect(mt.dividendPays).toBe(1)
  })
  it('una compra sin tipo de cambio no entra y se cuenta', () => {
    const m2 = movementTotals([op(1, 'buy', 'VALE3.SA', { qty: 1, price: 10, amount: 10, currency: 'BRL' })], (t) => currencyOf(t), usd)
    expect(m2.invested).toBe(0)
    expect(m2.excluded).toBe(1)
  })
  it('sin ventas no hay resultado (no es 0)', () => {
    expect(movementTotals([ops[1]], ccyOf, usd).realized).toBeNull()
  })
  it('tickers de los filtros', () => {
    expect(tickersOf(ops, [{ t: 'MSFT' }])).toEqual(['AAPL', 'MSFT', 'SQM-B.SN'])
  })
})

describe('puente desde los gastos de moyiq', () => {
  const expenses = [
    { inv: true, amount: 300, date: '2026-11-03' },
    { inv: true, amount: 110, date: '2026-11-20' },
    { inv: true, amount: 999, date: '2026-10-03' }, // otro mes
    { inv: true, amount: 50, date: '2026-11-04', project: 'Depto' }, // flujo de una propiedad
    { amount: 77, date: '2026-11-05' },
  ]
  it('propone lo del mes que falta registrar, en la moneda de la persona', () => {
    const o = aporteOffer({ expenses, month: '2026-11', settings: { currency: 'CLP' }, rate: { rate: 1000 }, ops: [] })
    expect(o).toEqual({ amount: 410, ccy: 'CLP', n: 2 })
  })
  it('no cuenta dos veces lo ya registrado desde moyiq', () => {
    const ops = [{ type: 'deposit', source: 'moyiq', currency: 'CLP', amount: 300, date: '2026-11-05' }]
    expect(aporteOffer({ expenses, month: '2026-11', settings: { currency: 'CLP' }, rate: null, ops }).amount).toBe(110)
    const all = [{ type: 'deposit', source: 'moyiq', currency: 'CLP', amount: 410, date: '2026-11-05' }]
    expect(aporteOffer({ expenses, month: '2026-11', settings: { currency: 'CLP' }, rate: null, ops: all })).toBeNull()
  })
  it('una moneda que el libro no maneja va en US$ con la tasa con fecha; sin tasa, nada', () => {
    expect(aporteOffer({ expenses, month: '2026-11', settings: { currency: 'VES' }, rate: { rate: 41 }, ops: [] })).toEqual({ amount: 10, ccy: 'USD', n: 2 })
    expect(aporteOffer({ expenses, month: '2026-11', settings: { currency: 'VES' }, rate: null, ops: [] })).toBeNull()
  })
  it('sin gastos marcados, nada', () => {
    expect(aporteOffer({ expenses: [], month: '2026-11', settings: { currency: 'USD' }, rate: { rate: 1 }, ops: [] })).toBeNull()
  })
})

describe('fuentes y cifras auxiliares', () => {
  it('atribuye solo las fuentes que se usan; el ejemplo, a ninguna', () => {
    const rows = [{ t: 'AAPL', type: 'Stock' }, { t: 'BTC-USD', type: 'Crypto' }]
    expect(priceSources(rows, { AAPL: {} })).toEqual({ yahoo: true, coingecko: false })
    expect(priceSources(rows, { AAPL: {}, 'BTC-USD': {} })).toEqual({ yahoo: true, coingecko: true })
    expect(priceSources(rows, { AAPL: {} }, { demo: true })).toEqual({ yahoo: false, coingecko: false })
    expect(fundamentalSources({ A: { source: 'finnhub' }, B: { source: 'fmp' }, C: {} })).toEqual(['Finnhub', 'Financial Modeling Prep'])
  })
  it('capital y riesgo', () => {
    expect(capitalLine(null, 100)).toBeNull()
    expect(capitalLine(1000, 1200)).toEqual({ capital: 1000, free: -200, over: true })
    expect(riskShare(50, 1000, 5000)).toEqual({ pct: 0.05, onCapital: true })
    expect(riskShare(50, null, 500)).toEqual({ pct: 0.1, onCapital: false })
    expect(riskShare(50, null, 0)).toBeNull()
  })
  it('resumen de los meses para el lector de pantalla', () => {
    expect(monthsSummary([{ ym: '2026-11', usd: 0 }, { ym: '2026-12', usd: 5 }], (x) => x, (v) => `$${v}`)).toBe('2026-12: $5')
  })
})

// ── Textos ──
const PF_TEXT = { es: ES, en: EN, pt: PT, de: DE }
await Promise.all(['en', 'pt', 'de'].map(loadPT))
const KEYS_ES = Object.keys(PF_TEXT.es)
const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',')

describe('textos de Portafolio en es/en/pt/de', () => {
  for (const lang of ['en', 'pt', 'de']) {
    it(`${lang} tiene las mismas claves y variables que es`, () => {
      const d = PF_TEXT[lang]
      expect(Object.keys(d).sort()).toEqual([...KEYS_ES].sort())
      for (const k of KEYS_ES) expect(vars(d[k]), `${lang} ${k}`).toBe(vars(PF_TEXT.es[k]))
    })
  }
  it('español neutro, sin voseo', () => {
    const VOSEO = /\b(tenés|podés|querés|sabés|elegí|revisá|escribí|mirá|tocá|agregá|ingresá|confirmá|definí|ajustá|guardá|vos)\b/i
    for (const k of KEYS_ES) expect(PF_TEXT.es[k], k).not.toMatch(VOSEO)
  })
  it('toda clave que usan las pantallas existe (con las dinámicas)', () => {
    const files = readdirSync(DIR).filter(f => f.endsWith('.jsx'))
    const used = new Set()
    for (const f of files) for (const m of readFileSync(join(DIR, f), 'utf8').matchAll(/'(pf\.[A-Za-z0-9_.]+)'/g)) used.add(m[1])
    const dynamic = [
      ...['Stock', 'ETF', 'Crypto', 'Bond'].map(x => `pf.type.${x}`),
      ...['Stock', 'ETF', 'Crypto', 'Otro'].map(x => `pf.alloc.${x}`),
      ...['posiciones', 'movimientos', 'dividendos', 'objetivos'].map(x => `pf.tab.${x}`),
      ...['buy', 'sell', 'deposit', 'withdrawal', 'dividend', 'bonus'].flatMap(x => [`pf.op.${x}`, `pf.trade.type.${x}`, `pf.ops.filter.${x}`]),
      ...['monthly', 'quarterly', 'semiannual', 'annual', 'irregular', 'unknown'].map(x => `pf.freq.${x}`),
      ...['empty', 'missing_columns', 'no_rows', 'ticker', 'shares', 'cost', 'too_many', 'too_big', 'read', 'invalid_json', 'not_backup'].map(x => `pf.csv.err.${x}`),
      // validateHolding, planTrade y validateOperation
      ...['ticker_required', 'ticker_invalid', 'type_invalid', 'shares_invalid', 'cost_invalid', 'stop_invalid', 'fx_invalid', 'note_too_long',
        'qty_required', 'price_required', 'drip_required', 'amount_required', 'bonus_required', 'rsi_invalid', 'date_required', 'date_future',
        'ticker_currency', 'uid_invalid', 'ticker_not_allowed', 'date_invalid', 'price_invalid', 'qty_invalid', 'amount_invalid', 'currency_invalid',
        'source_invalid', 'qty_or_amount_required', 'sell_over', 'sell_none'].map(x => `pf.err.${x}`),
    ]
    for (const k of [...used, ...dynamic]) expect(PF_TEXT.es[k], k).toBeTypeOf('string')
  })
  it('idioma desconocido cae a español; clave desconocida se muestra tal cual', () => {
    expect(ptFor('xx').t('pf.save')).toBe('Guardar')
    expect(ptFor('en').t('pf.save')).toBe('Save')
    expect(ptFor('de').t('pf.nope')).toBe('pf.nope')
    expect(ptFor('pt').t('pf.csv.more', { n: 3 })).toBe('e mais 3')
  })
  it('el CSV que exporta Inversiones se vuelve a importar tal cual, en los 4 idiomas', () => {
    const { rows } = positionRows([{ id: 1, t: 'AAPL', type: 'ETF', sh: 2.5, cost: 100, stop: 90 }, { id: 2, t: 'SQM-B.SN', type: 'Stock', sh: 3, cost: 50000, fxCost: 900 }], { AAPL: { price: 110 } }, RATES)
    for (const lang of ['es', 'en', 'pt', 'de']) {
      const { t } = ptFor(lang)
      const L = { ticker: t('pf.csv.h.ticker'), type: t('pf.csv.h.type'), ccy: t('pf.csv.h.ccy'), shares: t('pf.csv.h.shares'), entry: t('pf.csv.h.entry'), price: t('pf.csv.h.price'), value: t('pf.csv.h.value'), pnl: t('pf.csv.h.pnl'), ret: t('pf.csv.h.ret'), weight: t('pf.csv.h.weight'), stop: t('pf.csv.h.stop'), fxCost: t('pf.csv.h.fxCost'), noFx: t('pf.noFx') }
      const back = parseHoldingsCsv(holdingsCsv(rows, L))
      expect(back.errors, lang).toEqual([])
      const byT = Object.fromEntries(back.rows.map(r => [r.t, r]))
      expect(byT.AAPL, lang).toMatchObject({ type: 'ETF', sh: 2.5, cost: 100, stop: 90 })
      expect(byT['SQM-B.SN'], lang).toMatchObject({ sh: 3, cost: 50000, fxCost: 900 })
    }
  })
})

describe('copia JSON con objetivos', () => {
  it('los objetivos vuelven, solo con tickers y pesos válidos', () => {
    const json = backupJson({ holdings: [], operations: [], targets: { AAPL: 60, MSFT: 40 } })
    expect(parseBackup(json).targets).toEqual({ AAPL: 60, MSFT: 40 })
    const bad = JSON.stringify({ kind: 'moyiq-invest-backup', v: 1, holdings: [], operations: [], targets: { '=CMD': 10, AAPL: 140, msft: 30 } })
    expect(parseBackup(bad).targets).toEqual({ MSFT: 30 })
  })
})

// ── Ejemplo coherente con la tarjeta de Panorama ──
describe('portafolio de ejemplo (demo)', () => {
  const now = Date.UTC(2026, 10, 5, 12)
  const holdings = demoInvestHoldings()
  const quotes = demoInvestQuotes()
  const ops = demoInvestOps(now)
  it('las posiciones suman lo mismo que demoInvestSnapshot', () => {
    const { totals } = positionRows(holdings, quotes, {})
    const snap = demoInvestSnapshot(now)
    expect(totals.value).toBeCloseTo(snap.valueUsd, 6)
    expect(totals.cost).toBeCloseTo(snap.costUsd, 6)
    expect(holdings.map(h => h.t)).toEqual(demoInvestRows().map(r => r.t))
  })
  it('el libro cuadra con las posiciones: sin huérfanas ni posiciones sin operaciones', () => {
    const L = book(ops, holdings, { ccyOf: () => 'USD', priceOf: (t) => quotes[t].price, toUsd: (v) => v })
    expect(L.orphans).toEqual([])
    expect(L.openingCount).toBe(0)
    expect(L.cash).toBeGreaterThan(0)
    expect(L.gain).toBeCloseTo(L.value - L.contributed, 6)
  })
  it('la venta de ejemplo guarda el mismo resultado que el costo promedio', () => {
    const s = realizedSells(ops.map(o => ({ ...o, pnl: o.type === 'sell' ? null : o.pnl })), () => 'USD')
    expect(s[0].pnl).toBeCloseTo(ops.find(o => o.type === 'sell').pnl, 6)
  })
  it('ninguna operación de ejemplo tiene fecha futura', () => {
    const today = new Date(now).toISOString().slice(0, 10)
    for (const o of ops) expect(o.date <= today).toBe(true)
  })
  it('la tienda de ejemplo cambia solo en memoria', async () => {
    const store = createDemoInvestStore({ now: () => now })
    const a = await store.addHolding({ t: 'nvda', type: 'Stock', sh: 1, cost: 10 })
    expect(a.data.t).toBe('NVDA')
    await store.updateHolding(a.data, { sh: 2 })
    expect((await store.listHoldings()).data.find(h => h.t === 'NVDA').sh).toBe(2)
    await store.deleteHolding(a.data.id)
    expect((await store.listHoldings()).data.some(h => h.t === 'NVDA')).toBe(false)
    const op = ops[0]
    await store.deleteOperations([op.uid])
    expect((await store.listOperations()).data.some(o => o.uid === op.uid)).toBe(false)
    await store.saveOperations([op])
    expect((await store.listOperations()).data.some(o => o.uid === op.uid)).toBe(true)
    store.clear()
    expect((await store.listHoldings()).data.length).toBe(4)
  })
})

// ── Posiciones pintada (sin red: un libro listo de mentira) ──
vi.mock('../../../components/Money.jsx', () => ({ default: ({ children }) => children, useMoney: () => ({ m: (x) => x, hidden: false }) }))
const { default: Positions } = await import('./Positions.jsx')
const { makeFmt } = await import('./format.js')

function fakeBook({ demo = false } = {}) {
  const holdings = [
    { id: 1, t: 'AAPL', type: 'Stock', sh: 10, cost: 100, stop: 90, fxCost: null, note: '' },
    { id: 2, t: 'BTC-USD', type: 'Crypto', sh: 0.1, cost: 50000, stop: null, fxCost: null, note: '' },
  ]
  const quotes = { AAPL: { price: 120, changePct: 0.01 }, 'BTC-USD': { price: 60000, changePct: 0 } }
  return {
    phase: 'ready', holdings, ops: [], opsState: 'ready', capital: null, rule: { risk: 2, limit: 25 },
    market: { phase: 'ready', quotes, latam: null, ars: null, at: 1 }, rates: { rates: {}, ars: null }, arsKind: 'MEP',
    positions: positionRows(holdings, quotes, {}, { limit: 25 }), columns: { stop: true, fx: true }, demo,
    reload() {}, setArsKind() {}, setCapital: async () => ({ ok: true }),
  }
}
const actions = new Proxy({ dispCcy: 'USD' }, { get: (o, k) => (k in o ? o[k] : () => {}) })

describe('pantalla Posiciones', () => {
  const render = (demo, view = 'completa') => {
    const { t } = ptFor('es')
    const pb = fakeBook({ demo })
    const fmt = makeFmt({ disp: { ccy: 'USD', rate: 1 }, currency: 'USD', language: 'es' })
    return renderToStaticMarkup(h(Positions, { pb, fmt, disp: { ccy: 'USD', rate: 1 }, demo, t, actions, targets: null, view }))
  }
  it('vista esencial: Depositado y Ganancia (o Pérdida) primero, como en Resumen, sin riesgo al stop ni capital de referencia', () => {
    const html = render(false, 'esencial')
    // Mismas palabras que Resumen (25-nov-2026): con el libro, "Depositado"; sin él, "Pagado por tus posiciones".
    const put = Math.max(html.indexOf('Depositado'), html.indexOf('Pagado por tus posiciones'))
    expect(put).toBeGreaterThan(-1)
    expect(put).toBeLessThan(html.indexOf('Resumen del portafolio'))
    expect(html).toMatch(/Ganancia|Pérdida/)
    expect(html).not.toMatch(/Pusiste|El mercado (sumó|restó)/)
    expect(html).not.toContain('Riesgo al stop')
    expect(html).toContain('Supera tu límite de 25 %') // el peso sigue: no es jerga
  })
  it('banda, filas con flecha y texto, fuentes con atribución de CoinGecko', () => {
    const html = render(false)
    expect(html).toContain('Riesgo al stop')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('Precios: Yahoo Finance, CoinGecko')
    expect(html).toContain('Powered by CoinGecko API')
    expect(html).toContain('Datos y licencias')
    expect(html).toContain('no instrucciones de compra o venta')
    expect(html).toContain('Supera tu límite de 25 %') // BTC pesa 6.000 de 7.200
  })
  it('en el ejemplo no se atribuyen fuentes y dice que no se guarda', () => {
    const html = render(true)
    expect(html).not.toContain('Precios: Yahoo')
    expect(html).toContain('ejemplo, no se guarda')
  })
})

describe('Dividendos: etiquetas del gráfico de 12 meses (26-nov-2026)', async () => {
  const { compactMoney, pickBarLabels } = await import('./Dividends.jsx')
  it('monto corto que no se corta', () => {
    expect(compactMoney('$352.430')).toBe('$352K')
    expect(compactMoney('$49.120')).toBe('$49K')
    expect(compactMoney('$8.120.000')).toBe('$8,1M')
    expect(compactMoney('US$1.234,56')).toBe('US$1,2K')
    expect(compactMoney('US$88,40')).toBe('US$88')
    expect(compactMoney('—')).toBe('—')
  })
  it('solo barras altas y nunca dos vecinas con etiqueta', () => {
    const v = [5, 0, 88, 5, 0, 88, 5, 0, 88, 5, 0, 88]
    expect([...pickBarLabels(v)].sort((a, b) => a - b)).toEqual([2, 5, 8, 11])
    const monthly = [10, 10, 10, 10]
    const got = [...pickBarLabels(monthly)].sort((a, b) => a - b)
    expect(got).toEqual([0, 2])
    for (const i of got) expect(got.includes(i + 1)).toBe(false)
    expect(pickBarLabels([0, 0]).size).toBe(0)
  })
})
