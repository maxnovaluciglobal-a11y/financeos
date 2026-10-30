// src/utils/refHistory.js — B5 (R5b, D-D; plan consolidado W5), 30-oct-2026.
// Variación del mes EN DÓLARES para Venezuela: con la misma tasa en los dos
// meses el porcentaje queda igual al nominal ((A/r)/(B/r) = A/B) y no corrige
// la inflación. Hace falta la tasa de CADA período. Fuente: histórico diario
// de ve.dolarapi.com (BCV desde 2023; paralelo desde feb-2026), ya permitido en
// la CSP. Se cachea en el dispositivo 12 h. Sin red ni caché: null y el Inicio
// sigue mostrando el monto en bolívares (A1). Argentina: sin fuente aprobada
// (W5), no aplica.
export const HIST_COUNTRIES = ['VE']
const LS_PREFIX = 'fos_ve_hist_v1_'
const TTL_MS = 12 * 60 * 60 * 1000
const URLS = {
  oficial: 'https://ve.dolarapi.com/v1/historicos/dolares/oficial',
  paralelo: 'https://ve.dolarapi.com/v1/historicos/dolares/paralelo',
}

// Fuente del histórico según la tasa que eligió el usuario (BCV por defecto).
export const histFuente = (usdRateSource) => (usdRateSource === 'paralelo' ? 'paralelo' : 'oficial')

// [{ fecha:'2026-10-29', promedio: 888.89 }, …] → [['2026-10-29', 888.89], …] ordenado.
export function parseHistory(json) {
  if (!Array.isArray(json)) return []
  return json
    .map(r => [String(r?.fecha || '').slice(0, 10), Number(r?.promedio)])
    .filter(([f, v]) => /^\d{4}-\d{2}-\d{2}$/.test(f) && Number.isFinite(v) && v > 0)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
}

// Última tasa publicada en o antes de `date` ('YYYY-MM-DD'); null si no hay.
export function rateOnOrBefore(rows, date) {
  if (!Array.isArray(rows) || !rows.length || !date) return null
  let lo = 0, hi = rows.length - 1, hit = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (rows[mid][0] <= date) { hit = mid; lo = mid + 1 } else hi = mid - 1
  }
  return hit >= 0 ? rows[hit][1] : null
}

// Historia sintética de la demo: una tasa por mes (VE_RATES), fechada el día 1.
export function historyFromMonthly(monthly = {}, key = 'bcv') {
  return Object.entries(monthly)
    .map(([ym, r]) => [`${ym}-01`, Number(r?.[key])])
    .filter(([, v]) => Number.isFinite(v) && v > 0)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
}

function readCache(fuente, storage, now) {
  try {
    const raw = storage?.getItem(LS_PREFIX + fuente)
    if (!raw) return null
    const c = JSON.parse(raw)
    if (!c || !Array.isArray(c.rows)) return null
    return { rows: c.rows, fresh: now - (Number(c.at) || 0) < TTL_MS }
  } catch { return null }
}

export async function loadHistory(fuente = 'oficial', {
  fetchFn = globalThis.fetch, storage = globalThis.localStorage, now = Date.now(),
} = {}) {
  const cached = readCache(fuente, storage, now)
  if (cached?.fresh) return cached.rows
  try {
    const res = await fetchFn(URLS[fuente] || URLS.oficial)
    if (!res?.ok) throw new Error('http ' + res?.status)
    const rows = parseHistory(await res.json())
    if (rows.length) {
      try { storage?.setItem(LS_PREFIX + fuente, JSON.stringify({ at: now, rows })) } catch { /* sin espacio o modo privado: se usa en memoria */ }
      return rows
    }
  } catch { /* sin red: se usa la caché vieja si existe */ }
  return cached?.rows || null
}
