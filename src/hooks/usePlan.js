// src/hooks/usePlan.js
// El plan activo se toma del plan de la LICENCIA validada (getLicensePlan del
// validador, cacheado en fnos_license_v2 tras validar contra Supabase).
// - Modo demo (?demo=true): se muestran todas las features (showcase) → 'pro'.
// - Fallback si no hay licencia cacheada: config.plan.
//
// Reemplaza la lógica vieja que leía settings.licenseKey (nunca se seteaba) y
// derivaba el plan del prefijo de la clave (imposible con FNOS-XXXX-XXXX-XXXX).

import { useEffect, useReducer } from 'react'
import { getLicensePlan, PLAN_EVENT } from '../utils/licenseValidator.js'
import config from '../config.js'
import { isPaidPlan } from '../utils/plans.js'

export function usePlan() {
  // Empezar o terminar la prueba cambia el plan sin recargar: se vuelve a leer.
  const [, refresh] = useReducer(x => x + 1, 0)
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    window.addEventListener(PLAN_EVENT, refresh)
    return () => window.removeEventListener(PLAN_EVENT, refresh)
  }, [])
  const isDemo = typeof window !== 'undefined' && window.location.search.includes('demo=true')
  const plan = isDemo ? 'pro' : (getLicensePlan() || config.plan || 'starter')

  return {
    plan,
    // Pro pagado, Enterprise, la licencia de pago único de antes y la prueba de
    // 14 días sin tarjeta (una licencia Pro con vencimiento) abren lo mismo.
    isPro: isPaidPlan(plan),
    isEnterprise: plan === 'enterprise',
    isStarter: plan === 'starter',
  }
}
