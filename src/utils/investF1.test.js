// Lógica nueva de F1 (Portafolio): filas que suman el total con el tipo de
// cambio de compra, un solo resultado realizado, dividendos con meses reales,
// objetivos con sus reglas y CSV sin fórmulas ni monedas mezcladas.
import { describe, it, expect } from 'vitest'
import { positionRows, concentrationAlternative, allocation, quoteLists } from './investPositions.js'
import { portfolioTotals, toUsd, currencyOf } from './investValuation.js'
import { realizedSells, tradeStats, costTable, dividendsReceived, mergeLots, sortOpsDesc, filterOps, nextSeq, applyTrade } from './investLedger.js'
import { projectDividends, scheduleFor, freqFromCount } from './investDividends.js'
import { rebalanceBase, rebalanceTrades, currentTargets, sumTargets, targetsReady, driftHint, clampTarget, roundTo100 } from './investRebalance.js'
import { parseHoldingsCsv, parseNum, holdingsCsv, operationsCsv, buildBackup, parseBackup, backupJson, exportName, splitLine } from './investCsv.js'

const RATES = { CLP: 1000, BRL: 5 }
const usd = (v, c) => toUsd(v, c, RATES)

describe('Posiciones: las filas suman el total (tipo de cambio de compra)', () => {
  const holdings = [
    { id: '1', t: 'AAPL', type: 'Stock', sh: 10, cost: 100 },
    { id: '2', t: 'SQM-B.SN', type: 'Stock', sh: 100, cost: 50000, fxCost: 800 }, // compra a 800, hoy 1000
    { id: '3', t: 'VALE3.SA', type: 'Stock', sh: 20, cost: 60 }, // sin fxCost
    { id: '4', t: 'XYZ.ZZ', type: 'Stock', sh: 5, cost: 10 }, // sufijo desconocido: sin tasa
    { id: '5', t: 'NOPX', type: 'ETF', sh: 3, cost: 40 }, // sin precio
  ]
  const quotes = {
    AAPL: { price: 120, changePct: 0.01 },
    'SQM-B.SN': { price: 60000, changePct: -0.02, currency: 'CLP' },
    'VALE3.SA': { price: 70, changePct: 0, currency: 'BRL' },
  }
  const { rows, totals } = positionRows(holdings, quotes, RATES)
  it('el pie es la suma de las filas y coincide con portfolioTotals', () => {
    const counted = rows.filter(r => r.valueUsd != null)
    const sum = (k) => counted.reduce((a, r) => a + r[k], 0)
    expect(sum('valueUsd')).toBeCloseTo(totals.value, 9)
    expect(sum('costUsd')).toBeCloseTo(totals.cost, 9)
    expect(sum('plUsd')).toBeCloseTo(totals.pl, 9)
    const T = portfolioTotals(holdings, t => quotes[t] || null, t => currencyOf(t, quotes[t]?.currency), RATES)
    expect(totals.value).toBeCloseTo(T.value, 9)
    expect(totals.cost).toBeCloseTo(T.cost, 9)
    expect(totals.pl).toBeCloseTo(T.total, 9)
    expect(totals.fxEffect).toBeCloseTo(T.fxEffect, 9)
    expect(totals.day).toBeCloseTo(T.day, 9)
  })
  it('la fila chilena usa el costo al tipo de cambio de compra', () => {
    const sqm = rows.find(r => r.t === 'SQM-B.SN')
    expect(sqm.costUsd).toBeCloseTo(100 * 50000 / 800)
    expect(sqm.valueUsd).toBeCloseTo(100 * 60000 / 1000)
    expect(sqm.fxEffectUsd).toBeCloseTo(100 * 50000 / 1000 - 100 * 50000 / 800)
  })
  it('sin tasa queda fuera, al final, y se cuenta', () => {
    expect(rows[rows.length - 1].t).toBe('XYZ.ZZ')
    expect(rows[rows.length - 1].status).toBe('nofx')
    expect(totals.excluded).toBe(1)
    expect(totals.fxUnknown).toBe(1) // VALE3 sin tipo de cambio de compra
    expect(totals.fxKnown).toBe(1)
  })
  it('sin precio vale su costo y su resultado es 0', () => {
    const r = rows.find(x => x.t === 'NOPX')
    expect(r.status).toBe('cost')
    expect(r.plUsd).toBe(0)
    expect(totals.unpriced).toBe(1)
  })
  it('pesos y límite de concentración por ticker (lotes sumados)', () => {
    const { rows: r2, totals: t2 } = positionRows([{ id: 'a', t: 'AAPL', sh: 1, cost: 1 }, { id: 'b', t: 'AAPL', sh: 1, cost: 1 }, { id: 'c', t: 'MSFT', sh: 2, cost: 1 }], { AAPL: { price: 10 }, MSFT: { price: 10 } }, {}, { limit: 40 })
    expect(r2.find(r => r.id === 'a').weight).toBeCloseTo(0.25)
    expect(r2.find(r => r.id === 'a').tickerWeight).toBeCloseTo(0.5)
    expect(r2.find(r => r.id === 'a').overLimit).toBe(true)
    expect(t2.top).toEqual({ t: 'AAPL', weight: 0.5 })
  })
  it('riesgo al stop: con stop propio suma, sin stop no; estimación −8 % sin la columna', () => {
    const h = [{ t: 'AAPL', sh: 10, cost: 100, stop: 110 }, { t: 'MSFT', sh: 1, cost: 100 }]
    const q = { AAPL: { price: 120 }, MSFT: { price: 100 } }
    const a = positionRows(h, q, {})
    expect(a.totals.risk).toBeCloseTo(100)
    expect(a.totals.noStop).toBe(1)
    const b = positionRows(h, q, {}, { estimate: true })
    expect(b.totals.risk).toBeCloseTo(100 + 8)
    expect(b.rows.find(r => r.t === 'MSFT').riskEstimated).toBe(true)
    // Stop sobre el precio: riesgo 0, nunca negativo.
    expect(positionRows([{ t: 'X', sh: 1, cost: 1, stop: 50 }], { X: { price: 40 } }, {}).totals.risk).toBe(0)
  })
  it('alternativa de concentración y reparto por tipo', () => {
    expect(concentrationAlternative(100, 50, 10000, 25)).toEqual({ units: 25, weight: 0.25 })
    expect(concentrationAlternative(100, 10, 10000, 25)).toBeNull()
    const al = allocation([{ type: 'ETF', valueUsd: 3 }, { type: 'Bond', valueUsd: 1 }, { type: 'Stock', valueUsd: null }])
    expect(al.map(a => a.type)).toEqual(['ETF', 'Otro'])
    expect(quoteLists([{ t: 'BTC-USD', type: 'Crypto' }, { t: 'AAPL', type: 'Stock' }])).toEqual({ stocks: ['AAPL'], crypto: ['BTC-USD'] })
  })
})

describe('Movimientos: un solo resultado realizado', () => {
  const ops = [
    { id: 1, uid: 'u1', type: 'buy', ticker: 'AAPL', date: '2026-01-02', qty: 10, price: 100, amount: 1000 },
    { id: 2, uid: 'u2', type: 'buy', ticker: 'AAPL', date: '2026-02-02', qty: 10, price: 200, amount: 2000 },
    { id: 3, uid: 'u3', type: 'sell', ticker: 'AAPL', date: '2026-03-02', qty: 10, price: 180, amount: 1800 }, // sin pnl: promedio 150 → +300
    { id: 4, uid: 'u4', type: 'buy', ticker: 'AAPL', date: '2026-04-02', qty: 10, price: 90, amount: 900 }, // promedio corrido (1500 + 900) / 20 = 120
    { id: 5, uid: 'u5', type: 'sell', ticker: 'AAPL', date: '2026-05-02', qty: 5, price: 100, amount: 500 }, // −100
    { id: 6, uid: 'u6', type: 'sell', ticker: 'MSFT', date: '2026-05-03', qty: 1, price: 50, amount: 50, pnl: -25 }, // pnl guardado manda
    { id: 7, uid: 'u7', type: 'sell', ticker: 'SQM-B.SN', date: '2026-05-04', qty: 1, price: 70000, amount: 70000, pnl: 10000 },
  ]
  const sells = realizedSells(ops, currencyOf)
  it('venta sin pnl: costo promedio corrido del libro (las ventas no cambian el promedio)', () => {
    expect(sells.find(s => s.uid === 'u3')).toMatchObject({ pnl: 300, source: 'average' })
    expect(sells.find(s => s.uid === 'u5').pnl).toBeCloseTo(-100)
    expect(sells.find(s => s.uid === 'u6')).toMatchObject({ pnl: -25, source: 'stored' })
  })
  it('la banda, las estadísticas y la tabla por activo dan la misma cifra', () => {
    const st = tradeStats(sells, usd)
    const table = costTable(ops, currencyOf, usd)
    const tableSum = table.reduce((a, r) => a + (r.realized || 0), 0)
    expect(st.total).toBeCloseTo(300 - 100 - 25 + 10)
    expect(tableSum).toBeCloseTo(st.total)
    expect(st.byTicker.reduce((a, b) => a + b.pnl, 0)).toBeCloseTo(st.total)
  })
  it('estadísticas: acierto, factor de beneficio, promedios y mayor caída', () => {
    const st = tradeStats(sells, usd)
    expect(st.n).toBe(4)
    expect(st.wins).toBe(2)
    expect(st.winRate).toBeCloseTo(0.5)
    expect(st.profitFactor).toBeCloseTo(310 / 125)
    expect(st.avgWin).toBeCloseTo(155)
    expect(st.avgLoss).toBeCloseTo(-62.5)
    expect(st.maxDD).toBeCloseTo(125)
    expect(tradeStats([], usd)).toMatchObject({ n: 0, total: 0 })
  })
  it('una venta sin tipo de cambio queda fuera y se cuenta', () => {
    const st = tradeStats([{ t: 'X.ZZ', ccy: null, pnl: 5 }], usd)
    expect(st).toMatchObject({ n: 0, excluded: 1 })
  })
  it('applyTrade guarda el mismo pnl que realizedSells toma como "stored"', () => {
    const a = applyTrade({ sh: 10, cost: 150 }, { type: 'sell', qty: 4, price: 200, amount: 800 })
    const s2 = realizedSells([{ id: 1, uid: 'x', type: 'sell', ticker: 'A', date: '2026-01-01', qty: 4, price: 200, amount: 800, pnl: a.pnl }], () => 'USD')
    expect(s2[0].pnl).toBeCloseTo(200)
  })
  it('dividendos cobrados por ticker, con el tipo de cambio del día si lo hay', () => {
    const d = dividendsReceived([
      { type: 'dividend', ticker: 'AAPL', amount: 10 },
      { type: 'dividend', ticker: 'AAPL', amount: 5 },
      { type: 'dividend', ticker: 'SQM-B.SN', amount: 1000, fx: 500 },
      { type: 'dividend', ticker: 'XYZ.ZZ', amount: 1 },
    ], currencyOf, usd)
    expect(d.rows).toEqual([{ t: 'AAPL', n: 2, usd: 15 }, { t: 'SQM-B.SN', n: 1, usd: 2 }])
    expect(d.excluded).toBe(1)
  })
  it('lotes del mismo ticker se ven como una posición para aplicar una operación', () => {
    expect(mergeLots([{ id: 'a', sh: 1, cost: 10, fxCost: 800 }, { id: 'b', sh: 3, cost: 20, fxCost: 800 }])).toMatchObject({ sh: 4, cost: 17.5, fxCost: 800, lots: 2 })
    expect(mergeLots([{ sh: 1, cost: 10, fxCost: 800 }, { sh: 1, cost: 10 }]).fxCost).toBeNull()
    expect(mergeLots([])).toBeNull()
  })
  it('orden, filtros y número siguiente', () => {
    expect(sortOpsDesc(ops)[0].uid).toBe('u7')
    expect(filterOps(ops, { ticker: 'AAPL', type: 'sell' }).map(o => o.uid)).toEqual(['u3', 'u5'])
    expect(nextSeq(ops)).toBe(8)
    expect(nextSeq([])).toBe(1)
  })
})

describe('Dividendos: frecuencia y meses reales, nunca inventados', () => {
  const now = Date.UTC(2026, 10, 20)
  it('frecuencia por cantidad de pagos', () => {
    expect([12, 4, 2, 1, 7, 0].map(freqFromCount)).toEqual(['monthly', 'quarterly', 'semiannual', 'annual', 'irregular', 'unknown'])
  })
  it('sin datos de la fuente ni historial: sin calendario', () => {
    expect(scheduleFor('AAPL', { dividendYield: 0.01 }, [], now)).toEqual({ freq: 'unknown', months: null, source: null })
  })
  it('meses de la fuente si los informa', () => {
    expect(scheduleFor('AAPL', { payMonths: [2, 5, 8, 11, 13] }, [], now)).toMatchObject({ freq: 'quarterly', months: [2, 5, 8, 11], source: 'api' })
  })
  it('meses del historial de la persona (últimos 12 meses)', () => {
    const ops = ['2026-03-15', '2026-06-15', '2026-09-15', '2025-06-01'].map(date => ({ type: 'dividend', ticker: 'VOO', date, amount: 5 }))
    expect(scheduleFor('VOO', {}, ops, now)).toEqual({ freq: 'quarterly', months: [3, 6, 9], source: 'history' })
  })
  it('proyección: reparte solo lo que tiene calendario; el resto va aparte', () => {
    const rows = [
      { t: 'VOO', sh: 10, ccy: 'USD', price: 500, avgCost: 400, valueUsd: 5000 },
      { t: 'AAPL', sh: 10, ccy: 'USD', price: 200, avgCost: 100, valueUsd: 2000 },
      { t: 'BTC-USD', sh: 1, ccy: 'USD', price: 3000, avgCost: 1, valueUsd: 3000 },
      { t: 'SQM-B.SN', sh: 1, ccy: 'CLP', price: 100000, valueUsd: 100 },
    ]
    const ops = ['2026-03-20', '2026-06-20', '2026-09-20', '2025-12-20'].map(date => ({ type: 'dividend', ticker: 'VOO', date, amount: 15 }))
    const p = projectDividends({ rows, fundamentals: { VOO: { dividendYield: 0.012 }, AAPL: { dividendYield: 0.005 }, 'SQM-B.SN': { dividendYield: 0.05 } }, ops, toUsd: usd, now })
    expect(p.positions).toBe(4)
    expect(p.noReply).toBe(1) // BTC sin respuesta
    expect(p.paying).toBe(3)
    expect(p.totalUsd).toBeCloseTo(60 + 10 + 5)
    const voo = p.rows.find(r => r.t === 'VOO')
    expect(voo).toMatchObject({ freq: 'quarterly', months: [3, 6, 9, 12], source: 'history' })
    expect(p.months[0].ym).toBe('2026-11')
    expect(p.months.find(m => m.ym === '2026-12').usd).toBeCloseTo(15)
    expect(p.months.find(m => m.ym === '2027-01').usd).toBe(0)
    expect(p.scheduledUsd).toBeCloseTo(60)
    expect(p.unscheduledUsd).toBeCloseTo(15)
    expect(p.months.reduce((a, m) => a + m.usd, 0)).toBeCloseTo(p.scheduledUsd)
    expect(p.yieldPct).toBeCloseTo(75 / 10100)
  })
  it('la moneda del activo sin tasa: fuera de la proyección y contada', () => {
    const p = projectDividends({ rows: [{ t: 'XYZ.ZZ', sh: 1, ccy: null, price: 10, valueUsd: null }], fundamentals: { 'XYZ.ZZ': { dividendYield: 0.1 } }, toUsd: usd, now })
    expect(p.excluded).toBe(1)
    expect(p.totalUsd).toBe(0)
  })
})

describe('Objetivos y "Ajustes para llegar"', () => {
  const rows = [
    { t: 'AAPL', type: 'Stock', sh: 10, valueUsd: 1000 },
    { t: 'MSFT', type: 'Stock', sh: 20, valueUsd: 1000 },
    { t: 'BTC-USD', type: 'Crypto', sh: 0.01, valueUsd: 500 },
    { t: 'NOFX', type: 'Stock', sh: 1, valueUsd: null },
  ]
  const base = rebalanceBase(rows)
  it('base por ticker, sin las posiciones sin tipo de cambio', () => {
    expect(base.map(b => b.t)).toEqual(['AAPL', 'MSFT', 'BTC-USD'])
    expect(base[0].priceUsd).toBe(100)
  })
  it('objetivos iniciales: pesos actuales que suman 100', () => {
    const tg = currentTargets(base)
    expect(sumTargets(base, tg)).toBe(100)
    expect(roundTo100([1, 1, 1])).toEqual([34, 33, 33])
  })
  it('sin sumar 100 ±0,5 no propone ajustes', () => {
    expect(rebalanceTrades(base, { AAPL: 50, MSFT: 30, 'BTC-USD': 19 }).status).toBe('sum')
    expect(rebalanceTrades(base, { AAPL: 50, MSFT: 30, 'BTC-USD': 19.6 }).status).not.toBe('sum')
    expect(targetsReady(100.5)).toBe(true)
    expect(targetsReady(100.6)).toBe(false)
  })
  it('un objetivo de un ticker vendido no cuenta en la suma', () => {
    expect(sumTargets(base, { AAPL: 40, MSFT: 40, 'BTC-USD': 20, VIEJO: 30 })).toBe(100)
  })
  it('unidades enteras en acciones, fracciones en cripto, nunca vender más de lo que hay', () => {
    const r = rebalanceTrades(base, { AAPL: 60, MSFT: 40, 'BTC-USD': 0 })
    expect(r.status).toBe('trades')
    const aapl = r.trades.find(x => x.t === 'AAPL')
    expect(aapl).toMatchObject({ buy: true, shares: 5, usd: 500 })
    const btc = r.trades.find(x => x.t === 'BTC-USD')
    expect(btc.shares).toBeCloseTo(-0.01)
    expect(-btc.shares).toBeLessThanOrEqual(0.01)
    expect(r.trades.find(x => x.t === 'MSFT')).toBeUndefined() // ya está en 40
  })
  it('nada por debajo de US$10, ni después de redondear', () => {
    const b2 = rebalanceBase([{ t: 'A', type: 'Stock', sh: 1, valueUsd: 1000 }, { t: 'B', type: 'Stock', sh: 100, valueUsd: 1000 }])
    // A pide +15 (0,015 unidades → 0 enteras): se omite.
    expect(rebalanceTrades(b2, { A: 50.75, B: 49.25 }).trades.find(x => x.t === 'A')).toBeUndefined()
    expect(rebalanceTrades(b2, { A: 50.4, B: 49.6 }).status).toBe('aligned')
  })
  it('aviso de desvío ≥ 2 puntos y límites del control', () => {
    expect(driftHint(base, {})).toBeNull()
    expect(driftHint(base, { AAPL: 30, MSFT: 40, 'BTC-USD': 30 })).toEqual({ count: 2, top: { t: 'AAPL', pts: 10 } })
    expect([clampTarget(-3), clampTarget(120), clampTarget('12.34'), clampTarget('x')]).toEqual([0, 100, 12.3, 0])
  })
})

describe('CSV y copia de seguridad', () => {
  it('parseNum entiende es-CL y en-US', () => {
    expect(parseNum('1.234,56')).toBeCloseTo(1234.56)
    expect(parseNum('1,234.56')).toBeCloseTo(1234.56)
    expect(parseNum('$172.50')).toBeCloseTo(172.5)
    expect(parseNum('')).toBeNaN()
  })
  it('importar: el CSV de Invest, separador ;, inglés, errores con código', () => {
    const csv = '﻿"Ticker","Tipo","Unidades","Entrada","Precio Actual"\n"AAPL","Stock","16","205.40","234.12"\n"TOTAL","","","",""'
    expect(parseHoldingsCsv(csv)).toEqual({ rows: [{ t: 'AAPL', type: 'Stock', sh: 16, cost: 205.4 }], errors: [] })
    const r = parseHoldingsCsv('symbol;shares;avg cost;type;stop\nmsft;12;445,00;stock;410\nbtc-usd;0,5;60000;crypto;')
    expect(r.rows[1]).toEqual({ t: 'BTC-USD', type: 'Crypto', sh: 0.5, cost: 60000 })
    expect(parseHoldingsCsv('ticker,precio\nAAPL,200').errors).toEqual([{ code: 'missing_columns' }])
    expect(parseHoldingsCsv('ticker,unidades,entrada\nAAPL,0,200\nNVDA,5,120\n$$,1,1').errors.map(e => e.code)).toEqual(['shares', 'ticker'])
    expect(parseHoldingsCsv('').errors).toEqual([{ code: 'empty' }])
    expect(parseHoldingsCsv('ticker,unidades,entrada\n').errors).toEqual([{ code: 'no_rows' }])
  })
  const labelsFor = {
    es: { ticker: 'Ticker', type: 'Tipo', ccy: 'Moneda', shares: 'Unidades', entry: 'Entrada', price: 'Precio', stop: 'Stop', fxCost: 'Tipo de cambio de compra', value: 'Valor', pnl: 'Resultado', ret: 'Retorno', weight: 'Peso', noFx: 'sin tipo de cambio' },
    en: { ticker: 'Ticker', type: 'Type', ccy: 'Currency', shares: 'Units', entry: 'Entry', price: 'Price', stop: 'Stop', fxCost: 'FX at cost', value: 'Value', pnl: 'Result', ret: 'Return', weight: 'Weight', noFx: 'no exchange rate' },
    pt: { ticker: 'Ticker', type: 'Tipo', ccy: 'Moeda', shares: 'Quantidade', entry: 'Preço médio', price: 'Preço', stop: 'Stop', fxCost: 'Câmbio da compra', value: 'Valor', pnl: 'Resultado', ret: 'Retorno', weight: 'Peso', noFx: 'sem câmbio' },
    de: { ticker: 'Ticker', type: 'Typ', ccy: 'Währung', shares: 'Stück', entry: 'Einstand', price: 'Kurs', stop: 'Stop', fxCost: 'Wechselkurs beim Kauf', value: 'Wert', pnl: 'Ergebnis', ret: 'Rendite', weight: 'Gewicht', noFx: 'kein Wechselkurs' },
  }
  const { rows } = positionRows([
    { t: 'AAPL', type: 'Stock', sh: 2, cost: 100, stop: 90 },
    { t: 'SQM-B.SN', type: 'Stock', sh: 10, cost: 50000, fxCost: 800 },
    { t: 'XYZ.ZZ', type: 'Stock', sh: 1, cost: 5 },
  ], { AAPL: { price: 150 }, 'SQM-B.SN': { price: 60000, currency: 'CLP' } }, RATES)
  it('exportar posiciones: una moneda por fila, TOTAL solo en USD, sin fórmulas', () => {
    const text = holdingsCsv([...rows, { ...rows[0], t: '=HYPERLINK("x")' }], labelsFor.es)
    expect(text.startsWith('﻿')).toBe(true)
    const lines = text.slice(1).split('\n')
    expect(lines[0]).toContain('"Valor (USD)"')
    expect(lines.find(l => l.startsWith('"SQM-B.SN"'))).toContain('"CLP"')
    const total = lines[lines.length - 1]
    // Valor total en USD: 600 (SQM) + 300 (AAPL) + 600 (la fila copiada); la
    // sin tasa no suma. Nunca CLP + USD.
    expect(total).toBe('"TOTAL","","USD","","","","","","1500","50","3.45","100"')
    expect(text).toContain('"\'=HYPERLINK(""x"")"')
    expect(lines.find(l => l.startsWith('"XYZ.ZZ"'))).toContain('"sin tipo de cambio"')
  })
  for (const lang of Object.keys(labelsFor)) {
    it(`lo exportado en ${lang} se vuelve a importar tal cual`, () => {
      const back = parseHoldingsCsv(holdingsCsv(rows, labelsFor[lang]))
      expect(back.errors).toEqual([])
      expect(back.rows).toEqual([
        { t: 'SQM-B.SN', type: 'Stock', sh: 10, cost: 50000, fxCost: 800 },
        { t: 'AAPL', type: 'Stock', sh: 2, cost: 100, stop: 90 },
        { t: 'XYZ.ZZ', type: 'Stock', sh: 1, cost: 5 },
      ])
    })
  }
  it('el apóstrofo de protección se quita al leer', () => {
    expect(splitLine('"\'=X",1', ',')).toEqual(['=X', '1'])
  })
  it('exportar operaciones: moneda por fila y notas sin fórmulas', () => {
    const text = operationsCsv([{ id: 1, type: 'deposit', date: '2026-01-01', currency: 'CLP', amount: 100000, note: '+cmd', cash: null }], {
      id: 'ID', date: 'Fecha', ticker: 'Ticker', type: 'Tipo', ccy: 'Moneda', price: 'Precio', qty: 'Unidades', amount: 'Monto', fx: 'TC', pnl: 'Resultado', rsi: 'RSI', note: 'Nota', cash: 'Efectivo', reinvested: 'Reinvertido', edited: 'Editado', source: 'Origen', yes: 'Sí', no: 'No', types: { deposit: 'Depósito' },
    })
    const line = text.slice(1).split('\n')[1]
    expect(line).toContain('"Depósito"')
    expect(line).toContain('"CLP"')
    expect(line).toContain('"\'+cmd"')
  })
  it('copia JSON: ida y vuelta sin duplicar posiciones que ya están', () => {
    const json = backupJson({ holdings: [{ t: 'AAPL', sh: 1, cost: 10 }, { t: 'VOO', sh: 2, cost: 400 }], operations: [{ uid: 'u', id: 1, type: 'deposit', date: '2026-01-01', amount: 5 }], capital: 1000, now: 0 })
    const p = parseBackup(json, { existingTickers: ['aapl'] })
    expect(p.ok).toBe(true)
    expect(p.holdings.map(h => h.t)).toEqual(['VOO'])
    expect(p.skippedHoldings).toEqual(['AAPL'])
    expect(p.operations).toHaveLength(1)
    expect(buildBackup({ now: 0 }).exportedAt).toBe('1970-01-01T00:00:00.000Z')
    expect(parseBackup('{').error).toBe('invalid_json')
    expect(parseBackup('{"a":1}').error).toBe('not_backup')
    expect(parseBackup(JSON.stringify({ portfolio: [{ t: 'MSFT', sh: 1, cost: 1 }], trades: [] })).holdings[0].t).toBe('MSFT')
  })
  it('nombre del archivo con fecha local', () => {
    expect(exportName('moyiq-posiciones', new Date(2026, 0, 5))).toBe('moyiq-posiciones-2026-01-05')
  })
})
