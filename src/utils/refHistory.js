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

// ── B2b (rial #29): historial de la tasa en el conversor ────────────────────
// Ventanas de 7, 30 y 90 días sobre el mismo histórico diario (o la foto
// mensual de la demo). Sin datos suficientes, null: la pantalla lo oculta.
export const HIST_WINDOWS = [7, 30, 90]
export const HIST_DEFAULT_WINDOW = 30

// 'YYYY-MM-DD' ± n días (aritmética en UTC: sin saltos por horario de verano).
export function shiftDate(date, n) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''))
  if (!m) return null
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n)).toISOString().slice(0, 10)
}

// Los puntos de la ventana [hoy − días, hoy]: la tasa vigente al empezar (la
// última publicada en o antes de ese día, con SU fecha) y las publicadas
// después. Devuelve primero/último/mín./máx. con fechas y la variación
// (fracción, para fmtPct). Menos de dos puntos: null.
export function historyWindow(rows, days, today) {
  if (!Array.isArray(rows) || !rows.length || !(days > 0)) return null
  const start = shiftDate(today, -days)
  if (!start) return null
  let baseIdx = -1
  for (let i = 0; i < rows.length && rows[i][0] <= start; i++) baseIdx = i
  const inside = rows.filter(([d]) => d > start && d <= today)
  const points = (baseIdx >= 0 ? [rows[baseIdx], ...inside] : inside).map(([date, value]) => ({ date, value }))
  if (points.length < 2) return null
  let min = points[0], max = points[0]
  for (const p of points) { if (p.value < min.value) min = p; if (p.value > max.value) max = p }
  const first = points[0], last = points[points.length - 1]
  return { days, start, end: today, points, first, last, min, max, change: last.value / first.value - 1 }
}

// Trazo SVG de la ventana: x por fecha (el punto de partida, que puede ser
// anterior a la ventana, se dibuja en el borde izquierdo), y de mín. a máx.
// con un margen de `pad` px. Una serie plana queda en el medio.
export function sparkPath(win, { width = 300, height = 64, pad = 4 } = {}) {
  if (!win || !win.points?.length) return ''
  const t0 = Date.parse(win.start + 'T00:00:00Z'), t1 = Date.parse(win.end + 'T00:00:00Z')
  const span = Math.max(1, t1 - t0)
  const lo = win.min.value, hi = win.max.value
  const x = (d) => pad + (Math.min(Math.max(Date.parse(d + 'T00:00:00Z'), t0), t1) - t0) / span * (width - 2 * pad)
  const y = (v) => (hi === lo ? height / 2 : pad + (hi - v) / (hi - lo) * (height - 2 * pad))
  return win.points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')
}
