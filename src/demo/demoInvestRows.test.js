import { describe, it, expect } from 'vitest'
import { demoInvestRows, demoInvestSnapshot } from './demoInvest.js'

describe('posiciones de ejemplo del demo', () => {
  it('suman lo mismo que la tarjeta de Panorama', () => {
    const rows = demoInvestRows()
    const snap = demoInvestSnapshot(0)
    const sum = (k) => rows.reduce((a, r) => a + r[k], 0)
    expect(sum('valueUsd')).toBeCloseTo(snap.valueUsd, 6)
    expect(sum('costUsd')).toBeCloseTo(snap.costUsd, 6)
    expect(sum('dayUsd')).toBeCloseTo(snap.dayUsd, 6)
    expect(sum('weight')).toBeCloseTo(1, 6)
  })
})
