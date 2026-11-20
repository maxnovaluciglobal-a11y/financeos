// src/core/investBridge.js — lee el portafolio de Invest (módulo Inversiones).
//
// moyiq guarda sus datos en el dispositivo; Invest, en el servidor. Este puente
// solo LEE: `portfolio_holdings` de la propia cuenta con `authClient` (RLS por
// auth.uid()) y los precios de la API pública de Invest. No manda al servidor
// nada de lo que moyiq tiene en el dispositivo. El resultado se guarda como
// totales en una clave `fos_*`, que es de la cuenta (core/deviceOwner.js).
import { authClient } from './authClient.js'
import { arsRate, buildSnapshot, currencyOf, holdingFromRow, holdingRows, quoteBatches, realRates, SNAPSHOT_VERSION } from '../utils/investValuation.js'

export const INVEST_ORIGIN = (import.meta.env.VITE_INVEST_URL || 'https://invest.moyiq.app').replace(/\/$/, '')
export const SNAPSHOT_KEY = 'fos_invest_snapshot_v1'
export const SNAPSHOT_TTL_MS = 5 * 60 * 1000
const FETCH_TIMEOUT_MS = 6000
const HOLDINGS_TIMEOUT_MS = 8000

export function readSnapshot(storage = localStorage) {
  try {
    const s = JSON.parse(storage.getItem(SNAPSHOT_KEY) || 'null')
    return s && s.v === SNAPSHOT_VERSION ? s : null
  } catch { return null }
}

function writeSnapshot(snap, storage) {
  try { storage.setItem(SNAPSHOT_KEY, JSON.stringify(snap)) } catch { /* almacenamiento o API del navegador no disponible: se sigue sin ello */ }
}

function withTimeout(promise, ms) {
  let id
  const timeout = new Promise((_, reject) => { id = setTimeout(() => reject(new Error('timeout')), ms) })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(id))
}

async function getJson(path, fetchImpl) {
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null
  const id = ctrl ? setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS) : null
  try {
    const res = await fetchImpl(`${INVEST_ORIGIN}${path}`, ctrl ? { signal: ctrl.signal } : undefined)
    return res.ok ? await res.json() : null
  } catch { return null } finally { if (id) clearTimeout(id) }
}

// Un fallo de precios o de tipo de cambio no es un fallo del portafolio: queda
// sin esa cotización y buildSnapshot aplica el costo o la exclusión.
async function fetchQuotes(holdings, fetchImpl) {
  const { stocks, crypto } = quoteBatches(holdings)
  const replies = await Promise.all([
    ...stocks.map(b => getJson(`/api/quote?ticker=${b.map(encodeURIComponent).join(',')}`, fetchImpl)),
    ...crypto.map(b => getJson(`/api/crypto?symbols=${b.map(encodeURIComponent).join(',')}`, fetchImpl)),
  ])
  const quotes = {}
  for (const data of replies) {
    for (const [t, q] of Object.entries(data || {})) if (t !== '_errors' && q?.price > 0) quotes[t] = q
  }
  return quotes
}

async function fetchRates(holdings, quotes, fetchImpl) {
  const data = await getJson('/api/fx-latam', fetchImpl)
  const rates = realRates(data?.rates, data?.sources)
  if (holdings.some(h => currencyOf(h.t, quotes[h.t]?.currency) === 'ARS')) {
    const ars = await getJson('/api/fx-ars', fetchImpl)
    const r = arsRate(ars?.mep, rates.ARS)
    if (r) rates.ARS = r; else delete rates.ARS
  }
  return { rates, at: data?.updatedAt ? Date.parse(data.updatedAt) || null : null }
}

const defaultFetch = (...a) => fetch(...a)

// Un solo pedido a la vez (coherencia 360 I-20): al abrir Inversiones, la
// pantalla (fetchPortfolioDetail) y el snapshot de Panorama/Patrimonio
// (loadSnapshot) pedían el portafolio dos veces y el total y las filas podían
// salir de respuestas distintas. Si llega otro pedido con el mismo cliente
// mientras uno está en vuelo, comparten la misma respuesta.
let rawInflight = null
function fetchRaw({ client = authClient, fetchImpl = defaultFetch } = {}) {
  if (rawInflight && rawInflight.client === client && rawInflight.fetchImpl === fetchImpl) return rawInflight.p
  const p = fetchRawOnce({ client, fetchImpl })
  const entry = { client, fetchImpl, p }
  rawInflight = entry
  const clear = () => { if (rawInflight === entry) rawInflight = null }
  p.then(clear, clear)
  return p
}

async function fetchRawOnce({ client, fetchImpl }) {
  if (!client) throw new Error('auth_unavailable')
  const { data: sess } = await withTimeout(client.auth.getSession(), HOLDINGS_TIMEOUT_MS)
  const uid = sess?.session?.user?.id
  if (!uid) throw new Error('session_required')
  const { data, error } = await withTimeout(
    client.from('portfolio_holdings').select('id,ticker,asset_type,shares,avg_cost,fx_at_cost').eq('user_id', uid),
    HOLDINGS_TIMEOUT_MS,
  )
  if (error) throw new Error('holdings_failed')
  const holdings = (data || []).map(holdingFromRow).filter(h => h.t && h.sh > 0)
  if (holdings.length === 0) return { uid, holdings, quotes: {}, rates: {}, ratesAt: null }
  const quotes = await fetchQuotes(holdings, fetchImpl)
  const { rates, at } = await fetchRates(holdings, quotes, fetchImpl)
  return { uid, holdings, quotes, rates, ratesAt: at }
}

export async function fetchSnapshot({ now = Date.now, ...deps } = {}) {
  const raw = await fetchRaw(deps)
  return buildSnapshot({ ...raw, now: now() })
}

// Pantalla de Inversiones: totales + una fila por posición. Las filas quedan
// solo en memoria (los tickers no se guardan en el dispositivo); el snapshot
// de totales sí se guarda y avisa a la tarjeta de Panorama y a Patrimonio.
export async function fetchPortfolioDetail({ now = Date.now, storage = localStorage, ...deps } = {}) {
  const raw = await fetchRaw(deps)
  const snapshot = buildSnapshot({ ...raw, now: now() })
  writeSnapshot(snapshot, storage)
  for (const fn of listeners) fn(snapshot)
  return { snapshot, rows: holdingRows(raw.holdings, raw.quotes, raw.rates) }
}

// Una sola carga a la vez: Panorama monta la tarjeta y Patrimonio juntas.
let inflight = null
const listeners = new Set()

export function subscribeSnapshot(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function loadSnapshot({ force = false, storage = localStorage, ...deps } = {}) {
  const cached = readSnapshot(storage)
  if (!force && cached && Date.now() - cached.at < SNAPSHOT_TTL_MS) return Promise.resolve(cached)
  if (!inflight) {
    inflight = fetchSnapshot(deps)
      .then((snap) => {
        writeSnapshot(snap, storage)
        for (const fn of listeners) fn(snap)
        return snap
      })
      .finally(() => { inflight = null })
  }
  return inflight
}
