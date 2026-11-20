// Formato de cifras de la ficha (puro: se prueba en asset/format.test.js).
// Precios en la moneda del activo: "US$" para USD y el código para el resto
// (Invest: pxT). Signo con U+2212, nunca "-".
import { fmtAmount, fmtDecimal, fmtPct, moneyLocale, MINUS } from '../../../utils/index.js'
import { decimalsFor } from '../../../utils/investValuation.js'

export function pxDecimals(n, ccy) {
  const d = decimalsFor(ccy)
  const a = Math.abs(Number(n) || 0)
  if (a > 0 && a < 1) return 4
  return d
}
export function fmtPx(n, ccy = 'USD', { decimals } = {}) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  const c = ccy || 'USD'
  const d = decimals ?? pxDecimals(n, c)
  const body = fmtAmount(Math.abs(Number(n)), d)
  const sign = Number(n) < 0 && /[1-9]/.test(body) ? MINUS : ''
  return `${sign}${c === 'USD' ? 'US$' : `${c} `}${body}`
}
export function fmtPxSigned(n, ccy, opts) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  const s = fmtPx(n, ccy, opts)
  return Number(n) > 0 && !s.startsWith(MINUS) ? `+${s}` : s
}
// Utilidad por acción: en la moneda del reporte; sin "$" fuera de US$.
export function fmtEps(n, ccy) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return ccy === 'USD' ? fmtPx(n, 'USD', { decimals: 2 }) : fmtDecimal(n, 2)
}
export const fmtNum = (n, d = 2) => (n == null || !Number.isFinite(Number(n)) ? '—' : fmtDecimal(n, d))
export const fmtUnits = (n) => (n == null ? '—' : Number(n).toLocaleString(moneyLocale(), { maximumFractionDigits: 8 }))
export const pct = (v, o) => (v == null || !Number.isFinite(Number(v)) ? '—' : fmtPct(v, o))

// AAAA-MM-DD → fecha corta en el idioma del dinero ("30 oct 2026").
export function fmtDay(iso, locale = moneyLocale()) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(iso || ''))) return String(iso || '—')
  try {
    return new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  } catch { return String(iso).slice(0, 10) }
}
export function fmtStamp(ms, locale = moneyLocale()) {
  const n = Number(ms)
  if (!(n > 0)) return null
  try { return new Date(n).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return null }
}

// Hora del último precio en la zona de la persona, 24 h ("14:05"). Si el
// precio no es de hoy, con la fecha corta delante ("18 nov 14:05").
export function fmtClock(ms, { now = Date.now(), locale = moneyLocale() } = {}) {
  const n = Number(ms)
  if (!(n > 0)) return null
  try {
    const d = new Date(n)
    const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    if (d.toDateString() === new Date(now).toDateString()) return time
    return `${d.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} ${time}`
  } catch { return null }
}

// Hoy en la zona de la persona, AAAA-MM-DD (para el campo de fecha).
export function localDay(d = new Date()) {
  const z = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}

// Código de error de investData → clave de texto general.
export function errorKey(code) {
  if (code === 'demo') return 'asset.err.demo'
  if (code === 'session_required' || code === 'auth_unavailable') return 'asset.err.session'
  if (code === 'timeout' || code === 'network') return 'asset.err.network'
  return 'asset.err.save'
}

export const isCryptoTicker = (t, type) => type === 'Crypto' || /-USD$/.test(String(t || '').toUpperCase())
