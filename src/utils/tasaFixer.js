// src/utils/tasaFixer.js
// Tasas de cambio en vivo (Fixer, vía api/fixer.js) para el campo usdRate de
// Settings — el único lugar de la app que hoy usa DEFAULT_USD_RATES como
// valor 100% estático, para las 8 monedas soportadas.
// Cache localStorage 6h · Fallback explícito a DEFAULT_USD_RATES si offline
// o la API falla — mismo patrón que tasaAR.js/tasaVE.js/indicadores.js.

import { DEFAULT_USD_RATES } from '../pages/shared/constants.js'
import { apiBase } from '../native/platform.js'

const LS_KEY = 'fnos_tasa_fixer_v1'
const TTL_MS = 6 * 60 * 60 * 1000
const URL = '/api/fixer'

function getCached() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (Date.now() - data.ts > TTL_MS) return null
    return data
  } catch { return null }
}

export async function loadFixerRates() {
  const cached = getCached()
  if (cached) return cached

  try {
    // En la app nativa el origen es local: /api va al dominio real (apiBase).
    const res = await fetch(apiBase() + URL)
    const json = await res.json()
    if (!res.ok || !json.rates) throw new Error(json.error || 'sin datos')
    const result = { rates: json.rates, ts: Date.now(), source: 'fixer' }
    localStorage.setItem(LS_KEY, JSON.stringify(result))
    return result
  } catch {
    return { rates: DEFAULT_USD_RATES, ts: Date.now(), source: 'fallback' }
  }
}
