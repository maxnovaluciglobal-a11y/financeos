// src/utils/refRate.js — moneda de referencia del Inicio (R12), lógica pura.
//
// "Te queda" puede mostrarse en US$ además de la moneda principal. La tasa
// NUNCA se inventa: sale (1) de la que el usuario guardó (settings.usdRate,
// con fecha y fuente desde R12) o (2) de la última consulta que la app ya
// hizo y dejó en caché (tasaVE.js / tasaAR.js / tasaFixer.js), con SU fecha
// aunque esté vencida. Los valores fijos de respaldo (FALLBACK de tasaVE/AR,
// DEFAULT_USD_RATES) no se usan acá: no tienen fecha real y en VES están
// muy desactualizados.
//
// Una tasa es "unidades de la moneda principal por 1 US$".

import { RATE_TOOL_BY_COUNTRY } from '../components/layout/navConfig.js'

export const REF_CURRENCY = 'USD'
export const REF_COUNTRIES = ['VE', 'AR']

// Cachés que la app ya escribe (mismas claves que los loaders).
export const CACHE_KEYS = { VE: 'fnos_tasa_ve_v1', AR: 'fnos_tasa_ar_v1', FIXER: 'fnos_tasa_fixer_v1' }

// Fuentes posibles → clave i18n de su nombre corto.
export const SOURCE_LABEL = {
  manual: 'refcur.source.manual',
  bcv: 'refcur.source.bcv',
  paralelo: 'refcur.source.paralelo',
  oficial: 'refcur.source.oficial',
  blue: 'refcur.source.blue',
  mep: 'refcur.source.mep',
  fixer: 'refcur.source.fixer',
  legacy: 'refcur.source.legacy',
}

// ¿Se ofrece la moneda de referencia en el Inicio?
// VE/AR siempre (salvo que la moneda principal ya sea USD); el resto solo si
// activó "Mostrar equivalente en USD" en Ajustes (datos multimoneda).
export function refEligible(settings = {}) {
  const cur = String(settings.currency || '').toUpperCase()
  if (!cur || cur === REF_CURRENCY) return false
  const cc = String(settings.country || '').toUpperCase()
  return REF_COUNTRIES.includes(cc) || !!settings.showDualCurrency
}

const validRate = (n) => Number.isFinite(Number(n)) && Number(n) > 0

// Tasa guardada por el usuario (o elegida desde una consulta) en settings.
export function savedRate(settings = {}) {
  if (!validRate(settings.usdRate)) return null
  const at = Number(settings.usdRateAt) || null
  // Antes de R12 la tasa se guardaba sin fecha ni fuente: se muestra igual,
  // pero dicha como "sin fecha" para que el usuario la revise.
  const source = at ? (settings.usdRateSource || 'manual') : 'legacy'
  return { rate: Number(settings.usdRate), at, source }
}

// Última tasa consultada y guardada en caché por la app, para la moneda dada.
// `read(key)` devuelve el JSON crudo de localStorage (inyectable en tests).
export function cachedRate({ country, currency }, read) {
  const cc = String(country || '').toUpperCase()
  const cur = String(currency || '').toUpperCase()
  const parse = (key) => { try { const raw = read(key); return raw ? JSON.parse(raw) : null } catch { return null } }
  if (cc === 'VE' && cur === 'VES') {
    const d = parse(CACHE_KEYS.VE)
    if (d?.source === 'api' && validRate(d.oficial) && d.ts) return { rate: Number(d.oficial), at: Number(d.ts), source: 'bcv' }
  }
  if (cc === 'AR' && cur === 'ARS') {
    const d = parse(CACHE_KEYS.AR)
    if (d?.source === 'api' && validRate(d.oficial) && d.ts) return { rate: Number(d.oficial), at: Number(d.ts), source: 'oficial' }
  }
  const f = parse(CACHE_KEYS.FIXER)
  if (f?.source === 'fixer' && validRate(f.rates?.[cur]) && f.ts) return { rate: Number(f.rates[cur]), at: Number(f.ts), source: 'fixer' }
  return null
}

// La tasa que usa el Inicio: primero la del usuario, después la caché.
export function resolveRefRate(settings = {}, read = () => null) {
  return savedRate(settings) || cachedRate(settings, read)
}

export function toRef(amount, rate) {
  if (!validRate(rate)) return null
  return (Number(amount) || 0) / Number(rate)
}

// Antigüedad en días enteros (para avisar "tasa de hace N días").
export function rateAgeDays(at, now = Date.now()) {
  if (!at) return null
  return Math.max(0, Math.floor((now - at) / 86400000))
}

// Más de 1 día en VE/AR o 7 en el resto se marca como vieja.
export function isStale(at, country, now = Date.now()) {
  const d = rateAgeDays(at, now)
  if (d == null) return true
  return d > (REF_COUNTRIES.includes(String(country || '').toUpperCase()) ? 1 : 7)
}

// Opciones que se pueden consultar desde la hoja "Tasa de referencia", a
// partir del resultado de los loaders existentes. Un resultado 'fallback'
// (sin red) NO produce opciones: esas cifras no son de hoy.
export function rateOptions({ country, currency }, { ve, ar, fixer } = {}) {
  const cc = String(country || '').toUpperCase()
  const cur = String(currency || '').toUpperCase()
  const out = []
  if (cc === 'VE' && cur === 'VES' && ve?.source === 'api') {
    if (validRate(ve.oficial)) out.push({ source: 'bcv', rate: Number(ve.oficial), at: Number(ve.ts) })
    if (ve.paraleloDisponible && validRate(ve.paralelo)) out.push({ source: 'paralelo', rate: Number(ve.paralelo), at: Number(ve.ts) })
  }
  if (cc === 'AR' && cur === 'ARS' && ar?.source === 'api') {
    for (const k of ['oficial', 'blue', 'mep']) if (validRate(ar[k])) out.push({ source: k, rate: Number(ar[k]), at: Number(ar.ts) })
  }
  if (out.length === 0 && fixer?.source === 'fixer' && validRate(fixer.rates?.[cur])) {
    out.push({ source: 'fixer', rate: Number(fixer.rates[cur]), at: Number(fixer.ts) })
  }
  return out
}

// ¿Qué loaders hay que llamar para esta moneda? (VE/AR usan su API dedicada,
// ya usada por Multimoneda/MultiDolarAR; el resto, el proxy propio /api/fixer.)
export function loadersFor({ country, currency }) {
  const cc = String(country || '').toUpperCase()
  const cur = String(currency || '').toUpperCase()
  if (cc === 'VE' && cur === 'VES') return ['ve']
  if (cc === 'AR' && cur === 'ARS') return ['ar']
  return ['fixer']
}

// Herramienta de tasa por país (R13): la calculadora que ya existe. El mapa
// vive en navConfig.js (el Menú la usa igual).
export function rateToolFor(country) {
  return RATE_TOOL_BY_COUNTRY[String(country || '').toUpperCase()] || null
}
