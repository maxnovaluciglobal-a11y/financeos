// Lógica pura de la pestaña Hoy (F2): mismas cifras que invest-web y los dos
// errores de "Para revisar hoy" corregidos, más los pedidos de historia
// agrupados (Invest hacía ~50 en una visita con 20 posiciones).
import { describe, it, expect } from 'vitest'
import {
  quoteFreshness, summarizeFreshness, computeRiskAtStop, heaviest, scoreCloses, reviewToday,
  dayKey, buildSeries, withLivePoint, sliceRange, rebase, change, niceStep, axisTicks, cursorKey,
  regimeOf, vixLevel, historySymbol, fxSymbol, historyPlan, runLimited, topPositions,
  validateAporte, aporteUsd, aportePending, stripFormat, STRIP_SYMS, DEFAULT_STOP_PCT,
} from './investHoy.js'
import { normalizeQuote } from '../core/investApi.js'

const MIN = 60000
const day = (s) => Date.parse(`${s}T00:00:00Z`) / 1000
const rowsOf = (start, closes) => closes.map((c, i) => ({ ts: day(start) + i * 86400, close: c }))
const ramp = (n, from, step) => Array.from({ length: n }, (_, i) => from + i * step)

describe('frescura de precios (readings.js)', () => {
  const now = Date.parse('2026-11-20T15:00:00Z')
  it('al día ≤ 2 min, con retraso, mercado cerrado y sin hora', () => {
    expect(quoteFreshness({ marketTime: now - MIN }, now).state).toBe('live')
    expect(quoteFreshness({ marketTime: now - 15 * MIN }, now)).toMatchObject({ state: 'delayed', minutes: 15 })
    expect(quoteFreshness({ marketTime: now - 60 * MIN, tradingEnd: now - 30 * MIN }, now).state).toBe('closed')
    expect(quoteFreshness({ fetchedAt: now }, now)).toMatchObject({ state: 'unknown', time: now })
    expect(quoteFreshness({ marketTime: now }, now, true).state).toBe('offline')
  })
  it('una cotización real normalizada, un sábado, dice "Mercado cerrado" y no "Retraso ~2.900 min"', () => {
    // Respuesta de /api/quote (invest-web api/quote.js): sesión regular del viernes
    // 20-nov-2026 (14:30–21:00 UTC), último precio al cierre; ahora es sábado 12:00 UTC.
    const fri = Date.parse('2026-11-21T00:00:00Z')
    const raw = { ticker: 'AAPL', price: 190.12, prevClose: 188, changePct: 0.011, currency: 'USD', source: 'yahoo',
      marketTime: fri - 3 * 3600000, tradingStart: fri - 9.5 * 3600000, tradingEnd: fri - 3 * 3600000, fetchedAt: fri + 36 * 3600000 }
    const sat = fri + 36 * 3600000
    expect(quoteFreshness(normalizeQuote(raw, 'AAPL'), sat)).toMatchObject({ state: 'closed', minutes: null })
    expect(summarizeFreshness([normalizeQuote(raw, 'AAPL')], sat).state).toBe('closed')
  })
  it('resume con el peor caso entre los mercados abiertos', () => {
    const qs = [{ marketTime: now - 2 * MIN }, { marketTime: now - 20 * MIN }, { marketTime: now - 90 * MIN, tradingEnd: now - MIN }]
    expect(summarizeFreshness(qs, now)).toMatchObject({ state: 'delayed', minutes: 20 })
    expect(summarizeFreshness([qs[2]], now).state).toBe('closed')
    expect(summarizeFreshness([], now).state).toBe('loading')
    expect(summarizeFreshness(qs, now, true)).toMatchObject({ state: 'offline', time: now - 2 * MIN })
  })
})

describe('Tu riesgo hoy (risk.js)', () => {
  const port = [
    { id: 'a', t: 'AAA', sh: 10, cur: 100, stop: 90 },
    { id: 'b', t: 'BBB', sh: 5, cur: 200, stop: null },
    { id: 'c', t: 'CCC', sh: 1, cur: 1000, stop: 1200 },
  ]
  it('sin columna stop: −8 % estimado y un stop sobre el precio se ignora', () => {
    const r = computeRiskAtStop(port, 0)
    expect(r.rows[0]).toMatchObject({ stop: 90, stopIsDefault: false, riskAtStop: 100 })
    expect(r.rows[1].stopIsDefault).toBe(true)
    expect(r.rows[1].riskAtStop).toBeCloseTo(5 * 200 * DEFAULT_STOP_PCT)
    expect(r.rows[2].stopIsDefault).toBe(true)
    expect(r.totalRisk).toBeCloseTo(100 + 80 + 80)
    expect(r.base).toBe('portfolio')
    expect(r.totalRiskPct).toBeCloseTo(260 / 3000)
  })
  it('con columna stop: sin stop no suma y un stop sobre el precio da 0', () => {
    const r = computeRiskAtStop(port, 6000, 0.25, { estimateMissing: false })
    expect(r.noStopCount).toBe(1)
    expect(r.rows[1]).toMatchObject({ noStop: true, riskAtStop: null })
    expect(r.rows[2].riskAtStop).toBe(0)
    expect(r.totalRisk).toBe(100)
    expect(r.base).toBe('capital')
    expect(r.totalRiskPct).toBeCloseTo(100 / 6000)
  })
  it('límite de concentración: por defecto 25 % y el de la regla de la persona', () => {
    const r = computeRiskAtStop(port, 0)
    expect(heaviest(r).t).toBe('AAA')
    expect(r.rows.map(x => x.overLimit)).toEqual([true, true, true])
    expect(computeRiskAtStop(port, 0, 0.4).rows.map(x => x.overLimit)).toEqual([false, false, false])
  })
})

describe('Para revisar hoy', () => {
  it('lee tendencia y RSI de Wilder de una serie', () => {
    const up = scoreCloses(ramp(250, 100, 1))
    expect(up).toMatchObject({ sig: 'UP', has200: true })
    expect(up.rsi).toBe(100)
    const down = scoreCloses(ramp(250, 400, -1))
    expect(down.sig).toBe('DOWN')
    expect(down.rsi).toBe(0)
    const short = scoreCloses(ramp(60, 100, -0.5))
    expect(short).toMatchObject({ has200: false, s200: null, sig: 'DOWN' })
    expect(scoreCloses([1])).toBeNull()
  })
  it('sin tickers no queda "calculando": dice que no hay nada que leer', () => {
    expect(reviewToday({ holdings: [], watch: [] }).state).toBe('empty')
  })
  it('una cuenta solo con cripto también se lee (Invest quedaba cargando para siempre)', () => {
    const scores = { 'BTC-USD': scoreCloses(ramp(250, 400, -1)) }
    const r = reviewToday({ holdings: [{ t: 'BTC-USD' }], watch: [], scores })
    expect(r.state).toBe('ready')
    expect(r.below.map(x => x.t)).toEqual(['BTC-USD'])
    expect(r.rsiOut.map(x => x.t)).toEqual(['BTC-USD'])
  })
  it('cargando mientras falta todo; si todo falla lo dice', () => {
    expect(reviewToday({ holdings: [{ t: 'A' }], scores: {}, pending: 1 }).state).toBe('loading')
    const f = reviewToday({ holdings: [{ t: 'A' }], watch: ['B'], scores: { A: null, B: null } })
    expect(f).toMatchObject({ state: 'failed', failed: ['A', 'B'] })
  })
  it('separa "bajo sus dos medias" de "bajo su media de 50 sin 200 días"; la lista solo cuenta para el RSI', () => {
    const scores = { A: scoreCloses(ramp(250, 400, -1)), B: scoreCloses(ramp(60, 100, -0.5)), W: scoreCloses(ramp(250, 400, -1)), C: null }
    const r = reviewToday({ holdings: [{ t: 'A' }, { t: 'B' }, { t: 'C' }], watch: ['W'], scores })
    expect(r.below.map(x => x.t)).toEqual(['A'])
    expect(r.belowShort.map(x => x.t)).toEqual(['B'])
    expect(r.rsiOut.map(x => x.t)).toContain('W')
    expect(r.failed).toEqual(['C'])
  })
})

describe('Valor en el tiempo (portfolio-history.js)', () => {
  it('suma unidades de hoy × cierre / tasa del día desde que todas tienen dato', () => {
    const h = { A: rowsOf('2026-01-01', [10, 11, 12, 13]), B: rowsOf('2026-01-02', [100, 100, 110]) }
    const fx = { CLP: rowsOf('2026-01-01', [1000, 1000, 1000, 1000]) }
    const s = buildSeries([{ t: 'A', sh: 2, ccy: 'USD' }, { t: 'B', sh: 10, ccy: 'CLP' }], h, fx)
    expect(s.points.map(p => dayKey(p.ts))).toEqual(['2026-01-02', '2026-01-03', '2026-01-04'])
    expect(s.points.map(p => p.v)).toEqual([22 + 1, 24 + 1, 26 + 1.1])
    expect(s.included).toEqual(['A', 'B'])
  })
  it('sin historia de la tasa usa la de hoy y lo informa; sin tasa queda fuera', () => {
    const h = { A: rowsOf('2026-01-01', [10, 20]), B: rowsOf('2026-01-01', [5, 5]) }
    const s = buildSeries([{ t: 'A', sh: 1, ccy: 'MXN' }, { t: 'B', sh: 1, ccy: 'BRL' }], h, {}, { fxNow: { MXN: 20 } })
    expect(s.fxApprox).toEqual(['MXN'])
    expect(s.missing).toEqual(['B'])
    expect(s.points.map(p => p.v)).toEqual([0.5, 1])
  })
  it('saca fines de semana si hay algo que no es cripto', () => {
    const h = { A: rowsOf('2026-11-13', [1, 2, 3, 4]) } // vie, sáb, dom, lun
    expect(buildSeries([{ t: 'A', sh: 1 }], h, {}, { weekdaysOnly: true }).points.map(p => p.v)).toEqual([1, 4])
  })
  it('el último punto se cambia por el valor en vivo', () => {
    const pts = rowsOf('2026-11-18', [1, 2]).map(r => ({ ts: r.ts, v: r.close }))
    expect(withLivePoint(pts, 9, day('2026-11-19') + 3600).at(-1).v).toBe(9)
    expect(withLivePoint(pts, 9, day('2026-11-20') + 3600)).toHaveLength(3)
  })
  it('recorta los 5 períodos y rebasa el índice al mismo punto de partida', () => {
    const pts = Array.from({ length: 400 }, (_, i) => ({ ts: day('2025-10-01') + i * 86400, v: 100 + i }))
    const last = pts.at(-1).ts
    expect(sliceRange(pts, '1M')[0].ts).toBe(last - 31 * 86400)
    expect(sliceRange(pts, '3M')[0].ts).toBe(last - 92 * 86400)
    expect(sliceRange(pts, '1A')[0].ts).toBe(last - 366 * 86400)
    expect(dayKey(sliceRange(pts, 'YTD')[0].ts)).toBe('2026-01-01')
    expect(sliceRange(pts, 'MAX')).toHaveLength(400)
    const ix = rebase(pts.slice(0, 3).map(p => ({ ts: p.ts, close: 50 * (1 + (p.v - 100) / 10) })), pts.slice(0, 3))
    ix.forEach((p, i) => expect(p.v).toBeCloseTo([100, 110, 120][i]))
    expect(change(pts.slice(0, 2))).toMatchObject({ abs: 1, pct: 0.01 })
  })
  it('marcas lindas del eje y teclas del cursor', () => {
    expect(niceStep(90)).toBe(50)
    expect(axisTicks([1020, 1180]).ticks).toEqual([1000, 1100, 1200])
    expect(axisTicks([1020, 1120]).ticks).toEqual([1000, 1050, 1100, 1150])
    expect(cursorKey('ArrowLeft', null, 10)).toBe(8)
    expect(cursorKey('ArrowRight', 9, 10)).toBe(9)
    expect(cursorKey('PageUp', 5, 30)).toBe(0)
    expect(cursorKey('End', 0, 30)).toBe(29)
    expect(cursorKey('Escape', 3, 30)).toBeNull()
    expect(cursorKey('a', 3, 30)).toBeUndefined()
  })
})

describe('régimen y VIX', () => {
  it('sin 200 cierres no hay régimen (Invest usaba una media más corta)', () => {
    expect(regimeOf(ramp(150, 100, 1))).toBeNull()
  })
  it('alcista, bajista y en transición', () => {
    expect(regimeOf(ramp(250, 100, 1)).regime).toBe('risk_on')
    expect(regimeOf(ramp(250, 400, -1)).regime).toBe('risk_off')
    const flat = [...ramp(200, 100, 0.5), ...ramp(50, 200, -1.5)]
    expect(regimeOf(flat).regime).toBe('neutral')
  })
  it('niveles del VIX', () => {
    expect([12, 18, 30, 40].map(vixLevel)).toEqual(['low', 'normal', 'high', 'extreme'])
    expect(vixLevel(null)).toBeNull()
  })
})

describe('pedidos de historia agrupados', () => {
  it('cripto con su par en dólares y monedas con su par de Yahoo', () => {
    expect(historySymbol({ t: 'BTC', type: 'Crypto' })).toBe('BTC-USD')
    expect(historySymbol({ t: 'BTC-USD', type: 'Crypto' })).toBe('BTC-USD')
    expect(historySymbol({ t: 'AAPL', type: 'Stock' })).toBe('AAPL')
    expect(fxSymbol('USD')).toBeNull()
    expect(fxSymbol('CLP')).toEqual({ sym: 'CLP=X', mult: 1 })
    expect(fxSymbol('GBp')).toEqual({ sym: 'GBP=X', mult: 100 })
  })
  it('20 posiciones + 5 de la lista: una serie por activo y nada repetido (Invest: ~50)', () => {
    const holdings = Array.from({ length: 20 }, (_, i) => ({ t: `T${i}`, type: 'Stock' }))
    const watch = ['T0', 'W1', 'W2', 'W3', 'W4']
    const plan = historyPlan({ holdings, watch, ccys: ['CLP'], range: '1A', cmp: 'SPY' })
    // 20 posiciones + 4 de la lista que no están en el portafolio + CLP + SPY (régimen y comparación a la vez).
    expect(plan).toHaveLength(26)
    expect(new Set(plan.map(r => `${r.sym}|${r.range}`)).size).toBe(plan.length)
    expect(plan.filter(r => r.sym === 'SPY')).toEqual([{ sym: 'SPY', range: '1y' }])
    const max = historyPlan({ holdings: holdings.slice(0, 2), range: 'MAX', cmp: 'ECH' })
    expect(max).toEqual(expect.arrayContaining([{ sym: 'T0', range: '5y' }, { sym: 'T0', range: '1y' }, { sym: 'ECH', range: '5y' }, { sym: 'SPY', range: '1y' }]))
  })
  it('runLimited respeta el tope, deja cada resultado en su lugar y no corta por un error', async () => {
    let live = 0, peak = 0
    const tasks = Array.from({ length: 9 }, (_, i) => async () => {
      live++; peak = Math.max(peak, live)
      await new Promise(r => setTimeout(r, 2))
      live--
      if (i === 4) throw new Error('x')
      return i * 2
    })
    const out = await runLimited(tasks, 3)
    expect(peak).toBe(3)
    expect(out).toEqual([0, 2, 4, 6, null, 10, 12, 14, 16])
  })
})

describe('top 5, aporte y cinta', () => {
  it('las 5 de mayor valor, con su riesgo por id; sin tipo de cambio no entran', () => {
    const rows = [1, 7, 3, null, 9, 5, 2].map((v, i) => ({ id: `r${i}`, t: `T${i}`, valueUsd: v }))
    const risk = { rows: rows.map(r => ({ id: r.id, riskAtStop: 1 })) }
    const top = topPositions(rows, risk)
    expect(top.map(r => r.t)).toEqual(['T4', 'T1', 'T5', 'T2', 'T6'])
    expect(top[0].risk).toEqual({ id: 'r4', riskAtStop: 1 })
  })
  it('valida el aporte como Invest (vacío, ≤ 0, centavos)', () => {
    expect(validateAporte('')).toEqual({ ok: false, error: 'empty' })
    expect(validateAporte('0')).toEqual({ ok: false, error: 'invalid' })
    expect(validateAporte('-3')).toEqual({ ok: false, error: 'invalid' })
    expect(validateAporte('abc')).toEqual({ ok: false, error: 'invalid' })
    expect(validateAporte('410,555')).toEqual({ ok: true, value: 410.56 })
  })
  it('el aporte en US$ nunca se convierte 1:1 y lo ya depositado se descuenta', () => {
    expect(aporteUsd({ amount: 400000, ccy: 'CLP', usd: null })).toBeNull()
    expect(aporteUsd({ amount: 400000, ccy: 'CLP', usd: 420 })).toBe(420)
    expect(aporteUsd({ amount: 300, ccy: 'USD' })).toBe(300)
    const ops = [
      { type: 'deposit', source: 'moyiq', currency: 'CLP', date: '2026-11-03', amount: 150000 },
      { type: 'deposit', source: 'moyiq', currency: 'CLP', date: '2026-10-28', amount: 999 },
      { type: 'deposit', currency: 'CLP', date: '2026-11-05', amount: 999 },
    ]
    expect(aportePending({ amount: 400000, ccy: 'CLP' }, ops, '2026-11')).toEqual({ amount: 250000, ccy: 'CLP' })
  })
  it('la cinta tiene los 10 instrumentos de Invest y su formato', () => {
    expect(STRIP_SYMS).toHaveLength(10)
    expect(stripFormat('EURUSD=X', 1.08)).toEqual({ kind: 'fx4', decimals: 4 })
    expect(stripFormat('^TNX', 4.3).kind).toBe('yield')
    expect(stripFormat('BTC-USD', 84000)).toEqual({ kind: 'usd', decimals: 0 })
    expect(stripFormat('^GSPC', 6000)).toEqual({ kind: 'index', decimals: 0 })
    expect(stripFormat('^RUT', 980).decimals).toBe(2)
  })
})
