// src/pages/Investments/portfolio/format.js — cifras de Portafolio (F1).
// Agregados en la moneda de pantalla (USD → elegida, con su tasa); precios en
// la moneda de cada activo ("CLP 63.190", "US$234,12"). Signo menos
// tipográfico. Nunca se muestra un número sin su moneda.
import { currencySymbol, fmtAmount, fmtPct, moneyLocale, dateLocale } from '../../../utils/index.js'
import { decimalsFor, toDisplay } from '../../../utils/investValuation.js'
import { fmtUsd } from '../../../utils/investNetWorth.js'

export const MINUS = '−'
const ZERO_DEC = new Set(['CLP', 'COP', 'ARS', 'JPY', 'KRW'])

export function makeFmt({ disp, currency, language }) {
  const dccy = disp?.ccy || 'USD'
  const sym = dccy === 'USD' ? null : currencySymbol(dccy, language)
  const dDec = ZERO_DEC.has(dccy) ? 0 : 2
  const signOf = (n, signed) => (n < 0 ? MINUS : signed && n > 0 ? '+' : '')
  // Cifra en USD → moneda de pantalla.
  function money(usd, { signed = false } = {}) {
    if (usd == null || !Number.isFinite(Number(usd))) return '—'
    const v = toDisplay(usd, disp || { rate: 1 })
    if (v == null) return '—'
    const body = dccy === 'USD' ? fmtUsd(v, currency) : `${sym}${fmtAmount(Math.abs(v), dDec)}`
    return signOf(v, signed) + body
  }
  // Monto en una moneda cualquiera (efectivo por moneda, depósitos).
  function inCcy(n, ccy, { signed = false } = {}) {
    if (n == null || !Number.isFinite(Number(n))) return '—'
    const c = ccy || 'USD'
    if (c === 'USD') return signOf(n, signed) + fmtUsd(n, currency)
    return `${signOf(n, signed)}${c} ${fmtAmount(Math.abs(n), decimalsFor(c))}`
  }
  // Precio del activo en su moneda: decimales de más para precios chicos.
  function native(n, ccy) {
    if (n == null || !Number.isFinite(Number(n))) return '—'
    const c = ccy || 'USD'
    const dec = Math.abs(n) > 0 && Math.abs(n) < 1 ? 6 : decimalsFor(c)
    const body = Number(Math.abs(n)).toLocaleString(moneyLocale(), { minimumFractionDigits: dec === 6 ? 2 : dec, maximumFractionDigits: dec })
    return signOf(n) + (c === 'USD' ? `${currency === 'USD' ? '$' : 'US$'}${body}` : `${c} ${body}`)
  }
  const pct = (n, { signed = false, decimals = 1 } = {}) => (n == null || !Number.isFinite(Number(n)) ? '—' : fmtPct(n, { signed, decimals }).replace('-', MINUS))
  const pts = (n) => `${signOf(n, true)}${Math.abs(n).toLocaleString(moneyLocale(), { maximumFractionDigits: 1 })}`
  const units = (n) => (n == null ? '—' : Number(n).toLocaleString(moneyLocale(), { maximumFractionDigits: 8 }))
  function date(iso) {
    if (!iso) return '—'
    try { return new Date(`${iso}T12:00:00Z`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) } catch { return iso }
  }
  function monthShort(ym) {
    try { return new Date(`${ym}-15T12:00:00Z`).toLocaleDateString(dateLocale(), { month: 'short', timeZone: 'UTC' }).replace('.', '') } catch { return ym }
  }
  function monthLong(ym) {
    try { return new Date(`${ym}-15T12:00:00Z`).toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }) } catch { return ym }
  }
  return { money, inCcy, native, pct, pts, units, date, monthShort, monthLong, dccy }
}

export const toneOf = (n) => (n > 0 ? 'up' : n < 0 ? 'down' : 'flat')

// Descarga un archivo de texto generado en el momento (no queda copia en la app).
export function downloadText(name, text, mime) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Número escrito por la persona: "1.234,5" o "1234.5".
export function parseInput(v) {
  if (v == null || v === '') return NaN
  const s = String(v).trim().replace(/\s/g, '')
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.')
  if (lc > ld) return parseFloat(s.replace(/\./g, '').replace(',', '.'))
  return parseFloat(s.replace(/,/g, ''))
}
