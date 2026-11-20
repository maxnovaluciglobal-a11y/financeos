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

// Posiciones de ejemplo para la pantalla de Inversiones. Suman lo mismo que
// demoInvestSnapshot (valor 12.500, costo 11.000, hoy +50) para que la
// pantalla y la tarjeta de Panorama no se contradigan.
export function demoInvestRows() {
  const row = (t, type, sh, avgCost, price, dayUsd, name) => {
    const valueUsd = sh * price
    const costUsd = sh * avgCost
    return {
      t, type, sh, ccy: 'USD', avgCost, price, name, status: 'live',
      valueUsd, costUsd, plUsd: valueUsd - costUsd, plPct: (valueUsd - costUsd) / costUsd,
      dayUsd, dayPct: dayUsd / (valueUsd - dayUsd),
    }
  }
  const rows = [
    row('VOO', 'ETF', 12, 450, 550, 30, 'Vanguard S&P 500 ETF'),
    row('AAPL', 'Stock', 12, 200, 200, 12, 'Apple Inc.'),
    row('BTC-USD', 'Crypto', 0.025, 64000, 84000, 10, 'Bitcoin'),
    row('MSFT', 'Stock', 4, 400, 350, -2, 'Microsoft Corp.'),
  ]
  const total = rows.reduce((a, r) => a + r.valueUsd, 0)
  for (const r of rows) r.weight = r.valueUsd / total
  return rows
}
