import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { expiringTrialsPath, trialDaysLeft } from './trialQuery.ts'

describe('send-push: solo licencias en prueba (BIZ-N4)', () => {
  const now = new Date('2026-11-19T12:00:00.000Z')
  it('filtra por is_trial y por trial_ends_at, no por expires_at', () => {
    const path = expiringTrialsPath(now)
    expect(path).toContain('is_trial=eq.true')
    expect(path).toContain('status=eq.active')
    expect(path).toContain('trial_ends_at=gt.2026-11-19T12:00:00.000Z')
    expect(path).toContain('trial_ends_at=lte.2026-11-22T12:00:00.000Z')
    expect(path).not.toContain('expires_at')
  })
  it('modelo A: deja afuera la prueba sin tarjeta (sin suscripción de Stripe)', () => {
    expect(expiringTrialsPath(now)).toContain('stripe_subscription_id=not.is.null')
  })
  it('días restantes, mínimo 1', () => {
    expect(trialDaysLeft('2026-11-21T11:00:00.000Z', now)).toBe(2)
    expect(trialDaysLeft('2026-11-19T13:00:00.000Z', now)).toBe(1)
  })
  it('index.ts usa la consulta de pruebas', () => {
    const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
    expect(src).toContain('expiringTrialsPath(')
    expect(src).not.toMatch(/licenses\?select=key_hash,expires_at/)
  })
})
