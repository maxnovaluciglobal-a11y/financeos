import { describe, it, expect } from 'vitest'
import { assetView, sampleCandles } from './Asset.jsx'

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
    }
  })
})

describe('qué muestra la ficha', () => {
  it('mientras se revisa la cuenta: cargando, no "falta el activo"', () => {
    expect(assetView({ full: true, demo: false, status: 'loading', picked: 'AAPL' })).toBe('loading')
    expect(assetView({ full: true, demo: false, status: 'granted', picked: 'AAPL' })).toBe('ready')
    expect(assetView({ full: true, demo: true, status: 'loading', picked: 'AAPL' })).toBe('ready')
    expect(assetView({ full: true, demo: false, status: 'needs-profile', picked: 'AAPL' })).toBe('missing')
    expect(assetView({ full: true, demo: false, status: 'loading', picked: null })).toBe('missing')
    expect(assetView({ full: false, demo: true, status: 'granted', picked: 'AAPL' })).toBe('missing')
  })
})
