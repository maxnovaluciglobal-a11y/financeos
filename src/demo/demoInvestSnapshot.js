// src/demo/demoInvestSnapshot.js — el total de Inversiones del demo para
// Panorama, Patrimonio, Inicio, Reportes y Modo Asesor, valorado IGUAL que la
// pantalla de Inversiones (QA pre-tiendas 23-nov-2026, I1).
//
// Antes la tarjeta usaba un total fijo (US$12.500) con los tipos de cambio
// fijos de moyiq (COP 4.100), mientras Inversiones ya valoraba el mismo
// portafolio a precios y tipos de cambio reales (US$15.639,63; COP ~3.526):
// dos cifras para lo mismo. Ahora las dos salen de las mismas posiciones
// (demoInvestHoldings), de la misma fuente (demoMarketApi: real primero,
// ejemplo marcado si falla, con su caché en memoria) y de la misma regla de
// valuación que usa la app con sesión (buildSnapshot, core/investBridge.js).
import { demoInvestHoldings, demoInvestFx } from './demoInvestBook.js'
import { demoMarketApi, isSample, mergePrices } from './demoMarketApi.js'
import { buildSnapshot, realRates } from '../utils/investValuation.js'
import { quoteLists } from '../utils/investPositions.js'

export async function buildDemoInvestSnapshot({ api = demoMarketApi, now = Date.now() } = {}) {
  const holdings = demoInvestHoldings()
  const { stocks, crypto } = quoteLists(holdings)
  const [q, c, fx] = await Promise.all([
    stocks.length ? api.quotes(stocks) : {},
    crypto.length ? api.crypto(crypto) : {},
    api.fxLatam(),
  ])
  const quotes = mergePrices(q, c)
  // Mismo criterio que Portafolio (usePortfolioBook): sin tasas reales, las
  // fijas de moyiq marcadas como respaldo.
  const fxSample = isSample(fx) || !fx?.rates
  const latam = fxSample ? demoInvestFx() : fx
  const rates = fxSample ? { ...latam.rates } : realRates(latam.rates, latam.sources)
  const at = latam.updatedAt ? Date.parse(latam.updatedAt) || now : now
  const snap = buildSnapshot({ holdings, quotes, rates, ratesAt: at, now })
  return { ...snap, demo: true, sample: Object.values(quotes).some(x => x?.sample) || fxSample, pricesAt: snap.pricesAt || now }
}

// Una sola carga por sesión del demo (cinco minutos, como el snapshot real).
let cached = null
export function loadDemoInvestSnapshot({ force = false, ttl = 5 * 60 * 1000, ...deps } = {}) {
  if (!force && cached && Date.now() - cached.at < ttl) return cached.p
  const p = buildDemoInvestSnapshot(deps)
  cached = { at: Date.now(), p }
  p.catch(() => { if (cached?.p === p) cached = null })
  return p
}
export function _resetDemoInvestSnapshot() { cached = null }
