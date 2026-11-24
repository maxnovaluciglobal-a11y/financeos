import { describe, it, expect } from 'vitest'
import { nextPaymentOn } from './subscriptionNext.js'

describe('nextPaymentOn (QA I13)', () => {
  it('una fecha ya pasada avanza al próximo cobro (Netflix 5-nov visto el 23-nov → 5-dic)', () => {
    expect(nextPaymentOn('2026-11-05', 'monthly', '2026-11-23')).toBe('2026-12-05')
    expect(nextPaymentOn('2026-11-11', 'monthly', '2026-11-23')).toBe('2026-12-11')
  })
  it('hoy o futura queda igual', () => {
    expect(nextPaymentOn('2026-11-23', 'monthly', '2026-11-23')).toBe('2026-11-23')
    expect(nextPaymentOn('2027-01-02', 'annual', '2026-11-23')).toBe('2027-01-02')
  })
  it('semanal, trimestral, anual y fin de mes', () => {
    expect(nextPaymentOn('2026-11-01', 'weekly', '2026-11-23')).toBe('2026-11-29')
    expect(nextPaymentOn('2026-08-15', 'quarterly', '2026-11-23')).toBe('2027-02-15')
    expect(nextPaymentOn('2025-03-10', 'annual', '2026-11-23')).toBe('2027-03-10')
    expect(nextPaymentOn('2026-01-31', 'monthly', '2026-11-23')).toBe('2026-11-30')
  })
})
