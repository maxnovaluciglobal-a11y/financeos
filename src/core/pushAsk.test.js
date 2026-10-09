import { describe, it, expect } from 'vitest'
import { shouldAskPush } from './pushAsk.js'

const base = { supported: true, enabled: false, asked: false, hasLicense: true, isDemo: false, movementCount: 3 }

describe('shouldAskPush (R09)', () => {
  it('aparece después del 3.er movimiento', () => {
    expect(shouldAskPush({ ...base, movementCount: 2 })).toBe(false)
    expect(shouldAskPush(base)).toBe(true)
    expect(shouldAskPush({ ...base, movementCount: 40 })).toBe(true)
  })
  it('una sola vez', () => {
    expect(shouldAskPush({ ...base, asked: true })).toBe(false)
  })
  it('nunca si el navegador no soporta push o ya están activados', () => {
    expect(shouldAskPush({ ...base, supported: false })).toBe(false)
    expect(shouldAskPush({ ...base, enabled: true })).toBe(false)
  })
  it('nunca sin licencia ni en el demo', () => {
    expect(shouldAskPush({ ...base, hasLicense: false })).toBe(false)
    expect(shouldAskPush({ ...base, isDemo: true })).toBe(false)
  })
})
