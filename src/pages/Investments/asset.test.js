import { describe, it, expect } from 'vitest'
import { assetGate } from './Asset.jsx'
import { DEMO_WATCH, demoRow, sampleCandles, sampleEarnings, sampleFundamentals, sampleNews, sampleQuote } from '../../demo/demoInvestAsset.js'
import { demoInvestRows } from '../../demo/demoInvest.js'
import { scoreAsset, chartData, hasFundamentals, earningsSummary, filterNews } from '../../utils/investAsset.js'

describe('velas de ejemplo del demo', () => {
  it('deterministas por ticker, solo días hábiles y velas coherentes', () => {
    const a = sampleCandles('AAPL'), b = sampleCandles('AAPL'), c = sampleCandles('MSFT')
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
    for (const k of a) {
      const day = new Date(`${k.date}T00:00:00Z`).getUTCDay()
      expect(day).not.toBe(0); expect(day).not.toBe(6)
      expect(k.high).toBeGreaterThanOrEqual(Math.max(k.open, k.close))
      expect(k.low).toBeLessThanOrEqual(Math.min(k.open, k.close))
      expect(k.low).toBeGreaterThan(0)
      expect(k.volume).toBeGreaterThan(0)
    }
  })
  it('alcanzan para el rango de 3 años (756 velas) y para la media de 200', () => {
    const c = sampleCandles('VOO')
    expect(c.length).toBeGreaterThanOrEqual(756)
    expect(chartData(c, 756).has200).toBe(true)
    expect(scoreAsset(c.slice(-252))).not.toBeNull()
  })
})

describe('demo de la ficha, coherente con demoInvestRows', () => {
  for (const r of demoInvestRows()) {
    it(`${r.t}: el último cierre es su precio y el cambio del día es el mismo`, () => {
      const c = sampleCandles(r.t)
      const last = c[c.length - 1], prev = c[c.length - 2]
      expect(last.close).toBeCloseTo(r.price, 6)
      expect(last.close / prev.close - 1).toBeCloseTo(r.dayPct, 9)
      const q = sampleQuote(r.t)
      expect(q.price).toBe(r.price)
      expect(q.changePct).toBeCloseTo(r.dayPct, 12)
      expect(q.name).toBe(r.name)
      expect(q.sample).toBe(true)
      expect(demoRow(r.t)).toMatchObject({ t: r.t })
    })
  }
  it('fundamentales y resultados de ejemplo rotulados; cripto sin fundamentales', () => {
    expect(hasFundamentals(sampleFundamentals('AAPL'))).toBe(true)
    expect(sampleFundamentals('AAPL').sample).toBe(true)
    expect(sampleFundamentals('BTC-USD')).toBeNull()
    const e = earningsSummary(sampleEarnings('MSFT'))
    expect(e.quarters).toHaveLength(4)
    expect(e.beat).toBe(3)
    expect(sampleEarnings('VOO')).toBeNull()
  })
  it('titulares de ejemplo: sin enlace ni fuente, y pasan el filtro del ticker', () => {
    const n = sampleNews('AAPL')
    expect(n.every(x => x.link == null && x.source == null && x.sample)).toBe(true)
    expect(filterNews(n, 'AAPL')).toHaveLength(2)
  })
  it('la lista de ejemplo no repite activos del portafolio de ejemplo', () => {
    const held = new Set(demoInvestRows().map(r => r.t))
    expect(DEMO_WATCH.some(t => held.has(t))).toBe(false)
  })
})

describe('qué muestra la ficha', () => {
  it('mientras se revisa la cuenta: cargando, no "falta el activo"', () => {
    expect(assetGate({ full: true, demo: false, status: 'loading', picked: 'AAPL' })).toBe('loading')
    expect(assetGate({ full: true, demo: false, status: 'granted', picked: 'AAPL' })).toBe('ready')
    expect(assetGate({ full: true, demo: true, status: 'loading', picked: 'AAPL' })).toBe('ready')
    expect(assetGate({ full: true, demo: false, status: 'needs-profile', picked: 'AAPL' })).toBe('missing')
    expect(assetGate({ full: true, demo: false, status: 'loading', picked: null })).toBe('missing')
    expect(assetGate({ full: false, demo: true, status: 'granted', picked: 'AAPL' })).toBe('missing')
  })
})
