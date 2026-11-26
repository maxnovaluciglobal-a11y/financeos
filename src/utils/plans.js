// src/utils/plans.js — qué planes abren Pro (fuente única).
// 'personal' es el plan de pago único de antes del 12-sep-2026: esas licencias
// de por vida conservan todo Pro (decisión conservadora del 26-nov-2026, modelo A).
// 'enterprise' es pago. Nada más abre Pro: Starter, vacío o un valor raro no.
export const PAID_PLANS = Object.freeze(['pro', 'enterprise', 'personal'])

export function isPaidPlan(plan) {
  return PAID_PLANS.includes(String(plan || '').trim().toLowerCase())
}

// Nombre visible del plan: las licencias de pago único se muestran como Pro.
export function planLabel(plan) {
  const p = String(plan || '').trim().toLowerCase()
  if (p === 'enterprise') return 'Enterprise'
  return isPaidPlan(p) ? 'Pro' : 'Starter'
}
