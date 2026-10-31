// src/demo/demoInvest.js — portafolio de ejemplo del módulo Inversiones en el
// demo: no hay sesión ni servidor. Cifras redondas y fijas, ficticias a la vista.
import { DEFAULT_USD_RATES } from '../pages/shared/constants.js'

export function demoInvestSnapshot(now = Date.now()) {
  return {
    v: 1,
    uid: null,
    at: now,
    demo: true,
    status: 'live',
    positions: 4,
    priced: 4,
    missing: 0,
    excluded: 0,
    valueUsd: 12500,
    costUsd: 11000,
    dayUsd: 50,
    dayPct: 0.004,
    totalUsd: 1500,
    totalPct: 0.1364,
    pricesAt: now,
    yahoo: false, // cifras inventadas: no se atribuyen a ninguna fuente
    coingecko: false,
    fx: { rates: DEFAULT_USD_RATES, at: now },
  }
}
