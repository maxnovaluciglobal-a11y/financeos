import { describe, it, expect } from 'vitest'
import { sampleCandles } from './Asset.jsx'

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
