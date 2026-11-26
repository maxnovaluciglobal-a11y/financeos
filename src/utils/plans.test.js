import { describe, it, expect } from 'vitest'
import { PAID_PLANS, isPaidPlan, planLabel } from './plans.js'
import { PAID_PLANS as NAV_PAID } from '../components/layout/navConfig.js'

// Inconsistencias 1e y 1f del modelo A (26-nov-2026): 'enterprise' es pago en todas
// las pantallas y las licencias de pago único ('personal') conservan todo Pro.
describe('planes que abren Pro', () => {
  it('pro, enterprise y personal son pagos; starter y vacío no', () => {
    expect(PAID_PLANS).toEqual(['pro', 'enterprise', 'personal'])
    for (const p of ['pro', 'enterprise', 'personal', 'PRO', ' enterprise ']) expect(isPaidPlan(p), p).toBe(true)
    for (const p of ['starter', '', null, undefined, 'free']) expect(isPaidPlan(p), String(p)).toBe(false)
  })
  it('la navegación usa la misma lista', () => {
    expect(NAV_PAID).toBe(PAID_PLANS)
  })
  it('nombre visible: el plan de pago único se muestra como Pro', () => {
    expect(planLabel('personal')).toBe('Pro')
    expect(planLabel('pro')).toBe('Pro')
    expect(planLabel('enterprise')).toBe('Enterprise')
    expect(planLabel('starter')).toBe('Starter')
  })
  it("ninguna pantalla compara el plan con === 'pro' (usa isPaidPlan)", async () => {
    const { readFileSync } = await import('node:fs')
    for (const f of ['../pages/Settings/PlanScreen.jsx', '../pages/More/index.jsx', '../pages/Settings/DeleteAccountSection.jsx', '../pages/Settings/index.jsx']) {
      const src = readFileSync(new URL(f, import.meta.url), 'utf8')
      expect(src, f).not.toMatch(/getLicensePlan\(\)\s*[!=]==\s*'pro'/)
    }
  })
})
