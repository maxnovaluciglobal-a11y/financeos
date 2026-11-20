import { describe, it, expect } from 'vitest'
import {
  ASSET_RANGES, DEFAULT_RANGE, rangeOf, historyRangeFor, visibleTabs, pickTab, cleanCandles, chartData, rangeSummary,
  buildReadings, scoreAsset, normalizeFundamentals, fundTags, hasFundamentals, FUND_METRICS, fundMetrics, capParts,
  range52, earningsSummary, minePosition, DEFAULT_STOP_PCT, filterNews, safeLink, compareStats, corrBand, compareWith, shareParts,
} from './investAsset.js'

// Serie de prueba: n días hábiles con un precio que sube de a 1.
function candles(n, { start = 100, step = 1, volume = 1000, from = Date.UTC(2024, 0, 1) } = {}) {
  const out = []
  let d = from, px = start
  while (out.length < n) {
    const day = new Date(d)
    if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6) {
      out.push({ date: day.toISOString().slice(0, 10), open: px, high: px + 0.5, low: px - 0.5, close: px + step * 0.5, volume })
      px += step
    }
    d += 86400000
  }
  return out
}

describe('rangos y pestañas', () => {
  it('los 5 rangos de Invest; 3A pide la serie de 5 años', () => {
    expect(ASSET_RANGES.map(r => [r.key, r.n])).toEqual([['1M', 21], ['3M', 63], ['6M', 126], ['1A', 252], ['3A', 756]])
    expect(DEFAULT_RANGE).toBe('6M')
    expect(rangeOf('nada').key).toBe('6M')
    expect(historyRangeFor('1A')).toBe('1y')
    expect(historyRangeFor('3A')).toBe('5y')
  })
  it('"Mi posición" solo con unidades; una pestaña oculta cae en Indicadores', () => {
    expect(visibleTabs(false)).toEqual(['ind', 'fund', 'news'])
    expect(visibleTabs(true)).toEqual(['ind', 'fund', 'mine', 'news'])
    expect(pickTab('mine', false)).toBe('ind')
    expect(pickTab('news', false)).toBe('news')
  })
})

describe('velas e indicadores del gráfico', () => {
  it('cleanCandles ordena, quita repetidas y velas sin OHLC positivo', () => {
    const c = cleanCandles([
      { date: '2026-01-03', open: 1, high: 2, low: 1, close: 2, volume: '5' },
      { date: '2026-01-02', open: 1, high: 1, low: 1, close: 1 },
      { date: '2026-01-02', open: 9, high: 9, low: 9, close: 9 },
      { date: '2026-01-04', open: 0, high: 1, low: 1, close: 1 },
      { date: 'x', open: 1, high: 1, low: 1, close: 1 },
    ])
    expect(c.map(k => k.date)).toEqual(['2026-01-02', '2026-01-03'])
    expect(c[1].volume).toBe(5)
    expect(c[0].volume).toBeNull()
  })
  it('las medias se calculan sobre la serie completa y se recorta el rango (la de 200 llega al primer día visible)', () => {
    const rows = candles(260)
    const d = chartData(rows, 21)
    expect(d.candles).toHaveLength(21)
    expect(d.sma20).toHaveLength(21)
    expect(d.sma200).toHaveLength(21)
    expect(d.sma200[0].time).toBe(d.candles[0].date)
    expect(d.bbUpper).toHaveLength(21)
    expect(d.bbUpper.every((p, i) => p.value >= d.bbLower[i].value)).toBe(true)
    expect(d.volume).toHaveLength(21)
    expect(d.rsi).toHaveLength(21)
    expect(d.macdHist).toHaveLength(21)
    expect(d.has200).toBe(true)
    expect(d.total).toBe(260)
  })
  it('sin 200 cierres no hay media de 200; sin volumen no hay histograma', () => {
    const d = chartData(candles(120, { volume: null }), 63)
    expect(d.has200).toBe(false)
    expect(d.sma200).toEqual([])
    expect(d.volume).toEqual([])
    expect(d.sma50.length).toBeGreaterThan(0)
  })
  it('rangeSummary: inicio, fin, variación, mínimo y máximo del rango', () => {
    const s = rangeSummary(candles(3))
    expect(s).toMatchObject({ from: 100.5, to: 102.5, low: 99.5, high: 102.5, days: 3 })
    expect(s.pct).toBeCloseTo(102.5 / 100.5 - 1, 12)
    expect(rangeSummary([])).toBeNull()
  })
})

describe('lecturas (deScoreTicker de Invest)', () => {
  it('menos de 30 velas: sin lectura', () => {
    expect(scoreAsset(candles(29))).toBeNull()
  })
  it('serie que sube: tendencia UP, sobre sus medias, RSI alto y todas las lecturas', () => {
    const s = scoreAsset(candles(252))
    expect(s.trend).toBe('UP')
    expect(s.rsi).toBeGreaterThanOrEqual(70)
    expect(s.readings.map(r => r.key)).toEqual(['sma200', 'sma50', 'rsi', 'macd', 'vol', 'high52', 'atr'])
    const by = Object.fromEntries(s.readings.map(r => [r.key, r]))
    expect(by.sma200.reading).toBe('up')
    expect(by.rsi.reading).toBe('high')
    expect(by.vol.reading).toBe('usual')
    expect(by.high52.reading).toBe('near')
  })
  it('sin volumen en las últimas 20 velas no inventa la lectura de volumen', () => {
    const s = scoreAsset(candles(60, { volume: null }))
    expect(s.readings.find(r => r.key === 'vol')).toBeUndefined()
    expect(s.s200).toBeNull()
  })
  it('MACD: positivo que se debilita y negativo que se recupera', () => {
    const r = (h, p) => buildReadings({ macdHist: h, macdPrev: p }).find(x => x.key === 'macd').reading
    expect(r(1, 2)).toBe('posFading')
    expect(r(1, 0.5)).toBe('pos')
    expect(r(-1, -2)).toBe('negRecovering')
    expect(r(-1, -0.5)).toBe('neg')
  })
  it('volumen 20 % sobre o bajo el promedio', () => {
    const v = (x) => buildReadings({ volRatio: x })[0].reading
    expect(v(1.25)).toBe('high')
    expect(v(0.75)).toBe('low')
    expect(v(1.1)).toBe('usual')
  })
})

describe('fundamentales', () => {
  it('Finnhub en %, FMP en fracción, fuente desconocida por tamaño', () => {
    expect(normalizeFundamentals({ source: 'finnhub', roe: 25 }).roe).toBe(0.25)
    expect(normalizeFundamentals({ source: 'fmp', roe: 0.25 }).roe).toBe(0.25)
    expect(normalizeFundamentals({ roe: 25, netMargin: 0.1 })).toMatchObject({ roe: 0.25, netMargin: 0.1 })
    expect(normalizeFundamentals({ source: 'fmp', grossMargin: 'x' }).grossMargin).toBeNull()
  })
  it('etiquetas sin repetidas ni vacías', () => {
    expect(fundTags({ sector: 'Technology', industry: 'technology', country: ' US ' })).toEqual(['Technology', 'US'])
  })
  it('una respuesta vacía o solo con la fuente no cuenta como dato', () => {
    expect(hasFundamentals({ source: 'fmp' })).toBe(false)
    expect(hasFundamentals({ beta: 1 })).toBe(true)
    expect(hasFundamentals(null)).toBe(false)
  })
  it('las 12 métricas de Invest en su orden; dividendo "No paga" y capitalización de la cotización', () => {
    expect(FUND_METRICS.map(m => m[0])).toEqual(['pe', 'fpe', 'eps', 'pb', 'roe', 'gross', 'net', 'revg', 'beta', 'de', 'div', 'cap'])
    const m = Object.fromEntries(fundMetrics({ source: 'finnhub', peRatio: 20, roe: 30, dividendYield: 0 }, { marketCap: 5e9 }).map(x => [x.key, x]))
    expect(m.pe.v).toBe(20)
    expect(m.roe.v).toBeCloseTo(0.3, 12)
    expect(m.div).toMatchObject({ v: null, none: true })
    expect(m.cap.v).toBe(5e9)
    expect(m.beta.v).toBeNull()
  })
  it('capitalización abreviada', () => {
    expect(capParts(2.85e12)).toEqual({ n: 2.85, unit: 'T' })
    expect(capParts(4e9)).toEqual({ n: 4, unit: 'B' })
    expect(capParts(7e6)).toEqual({ n: 7, unit: 'M' })
    expect(capParts(0)).toBeNull()
  })
})

describe('rango de 52 semanas', () => {
  it('de la cotización o, si falta, de las velas (y lo dice)', () => {
    expect(range52(150, { low52: 100, high52: 200 }, null)).toEqual({ low: 100, high: 200, p: 0.5, from: 'quote' })
    expect(range52(250, {}, { low52: 100, high52: 200 })).toMatchObject({ p: 1, from: 'candles' })
    expect(range52(null, { low52: 100, high52: 200 })).toBeNull()
    expect(range52(10, { low52: 5, high52: 5 })).toBeNull()
  })
})

describe('resultados trimestrales', () => {
  it('cuenta los que superaron sobre los que tienen dato', () => {
    const e = earningsSummary({ nextDate: '2027-01-29', source: 'finnhub', quarters: [
      { date: '2026-10-30', eps: 1.1, epsEst: 1, beat: true },
      { date: '2026-07-30', eps: 0.9, epsEst: 1, beat: false },
      { date: '2026-04-30', eps: null, epsEst: 1 },
      { eps: 1 },
    ] })
    expect(e.quarters).toHaveLength(3)
    expect(e).toMatchObject({ beat: 1, total: 2, nextDate: '2027-01-29', source: 'finnhub' })
  })
  it('sin trimestres: solo la próxima fecha, o nada', () => {
    expect(earningsSummary({ quarters: [], nextDate: '2027-01-01' })).toMatchObject({ quarters: [], total: 0 })
    expect(earningsSummary({ quarters: [] })).toBeNull()
    expect(earningsSummary(null)).toBeNull()
  })
})

describe('mi posición (drawerMinePane)', () => {
  it('suma los lotes, costo promedio, resultado y riesgo al stop', () => {
    const m = minePosition([{ sh: 10, cost: 100, stop: 90 }, { sh: 10, cost: 120 }], 130, { weight: 0.3, limit: 25 })
    expect(m).toMatchObject({ sh: 20, avgCost: 110, value: 2600, cost: 2200, pl: 400, stop: 90, risk: -800, riskKind: 'stop', overLimit: true, lots: 2, editableStop: false })
    expect(m.plPct).toBeCloseTo(400 / 2200, 12)
  })
  it('sin stop dice "sin stop"; sin columna stop estima −8 %', () => {
    expect(minePosition([{ sh: 1, cost: 1 }], 100).riskKind).toBe('noStop')
    const e = minePosition([{ sh: 2, cost: 1 }], 100, { stopColumn: false })
    expect(e.riskKind).toBe('estimate')
    expect(e.risk).toBeCloseTo(-100 * DEFAULT_STOP_PCT * 2, 12)
    expect(e.editableStop).toBe(false)
  })
  it('sin precio: valor al costo y sin resultado; sin unidades: null', () => {
    const m = minePosition([{ sh: 2, cost: 50 }], null)
    expect(m).toMatchObject({ value: 100, pl: null, priced: false, editableStop: true })
    expect(minePosition([{ sh: 0, cost: 5 }], 1)).toBeNull()
  })
})

describe('noticias', () => {
  it('del ticker o con el ticker como palabra en el título, hasta 8', () => {
    const items = [
      { title: 'Apple sube', tickers: ['AAPL'] },
      { title: 'AAPL and peers' },
      { title: 'SNAAPLE drinks' },
      { title: 'nada', tickers: ['MSFT'] },
      ...Array.from({ length: 10 }, (_, i) => ({ title: `AAPL ${i}` })),
    ]
    const f = filterNews(items, 'aapl')
    expect(f).toHaveLength(8)
    expect(f[0].title).toBe('Apple sube')
    expect(f.some(n => n.title === 'SNAAPLE drinks')).toBe(false)
  })
  it('solo enlaces http(s)', () => {
    expect(safeLink('https://example.com/a')).toBe('https://example.com/a')
    expect(safeLink('javascript:alert(1)')).toBeNull()
    expect(safeLink('data:text/html,x')).toBeNull()
    expect(safeLink(null)).toBeNull()
  })
})

describe('comparar', () => {
  it('rendimiento, volatilidad, Sharpe y correlación sobre el mismo rango', () => {
    const a = candles(80), b = candles(80, { start: 50, step: 0.5 })
    const s = compareStats(a, b, 63)
    expect(s.a.days).toBe(63)
    expect(s.a.ret).toBeGreaterThan(0)
    expect(s.b.vol).toBeGreaterThanOrEqual(0)
    expect(s.corr).not.toBeNull()
    expect(compareStats([], b, 63).a).toBeNull()
  })
  it('bandas de correlación y contra quién se compara', () => {
    expect(corrBand(0.8)).toBe('high')
    expect(corrBand(0.5)).toBe('mid')
    expect(corrBand(0.1)).toBe('low')
    expect(corrBand(null)).toBeNull()
    expect(compareWith('aapl')).toBe('SPY')
    expect(compareWith('SPY')).toBe('QQQ')
  })
})

describe('compartir', () => {
  it('solo ticker, nombre, precio y cambio del día; nunca la posición', () => {
    const p = shareParts('aapl', { name: ' Apple ', priceText: 'US$ 200', pctText: '+1 %', sh: 10, cost: 5 })
    expect(p).toEqual({ t: 'AAPL', name: 'Apple', price: 'US$ 200', pct: '+1 %' })
  })
})
