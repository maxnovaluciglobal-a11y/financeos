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
    if (d?.source === 'api' && validRate(d.oficial) && d.ts) return { rate: Number(d.oficial), at: Number(d.at ?? d.ts), source: 'bcv' }
  }
  if (cc === 'AR' && cur === 'ARS') {
    const d = parse(CACHE_KEYS.AR)
    if (d?.source === 'api' && validRate(d.oficial) && d.ts) return { rate: Number(d.oficial), at: Number(d.at ?? d.ts), source: 'oficial' }
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
    if (validRate(ve.oficial)) out.push({ source: 'bcv', rate: Number(ve.oficial), at: Number(ve.at ?? ve.ts) })
    if (ve.paraleloDisponible && validRate(ve.paralelo)) out.push({ source: 'paralelo', rate: Number(ve.paralelo), at: Number(ve.paraleloAt ?? ve.at ?? ve.ts) })
  }
  if (cc === 'AR' && cur === 'ARS' && ar?.source === 'api') {
    for (const k of ['oficial', 'blue', 'mep']) if (validRate(ar[k])) out.push({ source: k, rate: Number(ar[k]), at: Number(ar.at ?? ar.ts) })
  }
  if (out.length === 0 && fixer?.source === 'fixer' && validRate(fixer.rates?.[cur])) {
    out.push({ source: 'fixer', rate: Number(fixer.rates[cur]), at: Number(fixer.ts) })
  }
  return out
}

// Opción que queda elegida al consultar: en VE la tasa oficial del BCV
// (decisión 08-oct-2026); el paralelo y las demás quedan visibles para elegir.
// En el resto no se preselecciona nada: el usuario decide.
export function defaultRateOption(options = []) {
  return options.find(o => o.source === 'bcv') || null
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

// B1 (una sola tasa): cómo se describe una tasa, igual en el Inicio, en Ajustes
// y en los paneles. Fuente siempre; fecha o "sin fecha" (at null). Es la misma
// derivación de savedRate(): una tasa guardada sin usdRateAt es 'legacy'.
export function rateLabelParts(r) {
  if (!r || !validRate(r.rate)) return null
  return { sourceKey: SOURCE_LABEL[r.source] || SOURCE_LABEL.manual, at: Number(r.at) || null }
}

// B1: ¿hay una tasa más reciente que la que se está usando? Solo si la actual
// está vieja (isStale) o no tiene fecha, y la consultada es de una fecha
// posterior y de otro valor. Se prefiere la misma fuente que la actual (quien
// usa el paralelo ve el paralelo), después la oficial del BCV, después el
// dólar oficial de AR, después la primera. Nunca reemplaza nada sola: el
// usuario la elige con "Usar".
export function fresherRate(current, options = [], country, now = Date.now()) {
  if (!options || options.length === 0) return null
  if (current?.at && !isStale(current.at, country, now)) return null
  const pick = (current && options.find(o => o.source === current.source))
    || defaultRateOption(options)
    || options.find(o => o.source === 'oficial')
    || options[0]
  if (!pick || !validRate(pick.rate) || !(Number(pick.at) > 0)) return null
  if (current?.at && Number(pick.at) <= Number(current.at)) return null
  if (current && Number(pick.rate) === Number(current.rate)) return null
  return pick
}

// Lo que se guarda en settings al elegir una tasa consultada.
export function ratePatch(opt) {
  if (!opt || !validRate(opt.rate)) return null
  return { usdRate: Number(opt.rate), usdRateAt: Number(opt.at) || null, usdRateSource: opt.at ? (opt.source || 'manual') : null }
}

// ── Euro como moneda de referencia (rial #20, 30-oct-2026) ──────────────────
// settings.refCurrency: 'USD' (por defecto, y lo que vale si falta) | 'EUR'.
// Todo lo anterior (refEligible, savedRate, resolveRefRate, ratePatch) sigue
// siendo en US$: la tasa que el usuario escribe o consulta es SIEMPRE por 1 US$
// y se guarda en settings.usdRate como antes. El euro es una lente que se
// deriva encima, sin inventar nada:
// - VE/AR: sus fuentes locales son en dólares, así que Bs por 1 € = (Bs por
//   1 US$) ÷ (€ por 1 US$ de Fixer). La etiqueta lo dice: "Tasa BCV × EUR/USD
//   Fixer", con la fecha más vieja de las dos.
// - El resto: Fixer ya trae la moneda local por 1 € (rates[cur] ÷ rates.EUR,
//   porque la caché guarda todo "por 1 US$", ver api/fixer.js).
// Sin la cotización de Fixer en el dispositivo, la lente vuelve a US$ (y lo
// marca con `wanted: 'EUR'` para que la pantalla lo explique).
export const REF_CURRENCIES = ['USD', 'EUR']

// La moneda de la lente: la elegida, salvo que sea la misma moneda principal
// (una cuenta en euros no puede mirarse "en euros"): entonces US$.
export function lensCurrency(settings = {}) {
  const want = String(settings.refCurrency || '').toUpperCase() === 'EUR' ? 'EUR' : REF_CURRENCY
  const cur = String(settings.currency || '').toUpperCase()
  return want === 'EUR' && cur === 'EUR' ? REF_CURRENCY : want
}

// ¿Se ofrece elegir US$ | €? Solo si hay lente (refEligible) y la moneda
// principal no es ninguna de las dos.
export function eurSelectable(settings = {}) {
  const cur = String(settings.currency || '').toUpperCase()
  return refEligible(settings) && cur !== 'EUR'
}

// € por 1 US$ según la última consulta de Fixer guardada en caché, con SU fecha.
export function eurUsdRate(read = () => null) {
  try {
    const raw = read(CACHE_KEYS.FIXER)
    const f = raw ? JSON.parse(raw) : null
    if (f?.source !== 'fixer' || !validRate(f.rates?.EUR) || !f.ts) return null
    return { rate: Number(f.rates.EUR), at: Number(f.ts), rates: f.rates }
  } catch { return null }
}

// Tasa por 1 US$ → tasa por 1 €, cruzada con el € por 1 US$ de Fixer.
// La fecha es la más vieja de las dos (sin fecha si alguna no la tiene).
export function crossToEur(usd, eurUsd) {
  if (!usd || !validRate(usd.rate) || !eurUsd || !validRate(eurUsd.rate)) return null
  const at = usd.at && eurUsd.at ? Math.min(Number(usd.at), Number(eurUsd.at)) : null
  return {
    rate: Number(usd.rate) / Number(eurUsd.rate), at, source: usd.source, ref: 'EUR',
    via: { base: { rate: Number(usd.rate), at: usd.at || null, source: usd.source }, eurUsd: { rate: Number(eurUsd.rate), at: Number(eurUsd.at) } },
  }
}

// La tasa de la lente: { rate, at, source, ref } donde rate = moneda principal
// por 1 `ref`. `usd` es la tasa en US$ ya resuelta (resolveRefRate) si el
// llamador la tiene. Sin tasa en US$ no hay lente (ni en euros: en VE/AR el
// euro sale de ella; en el resto sí podría salir de Fixer, pero el Inicio pide
// primero la tasa en US$, igual que antes).
export function resolveLensRate(settings = {}, read = () => null, usd = resolveRefRate(settings, read)) {
  if (!usd || !validRate(usd.rate)) return null
  const asUsd = { ...usd, ref: REF_CURRENCY }
  if (lensCurrency(settings) !== 'EUR') return asUsd
  const cc = String(settings.country || '').toUpperCase()
  const cur = String(settings.currency || '').toUpperCase()
  const eu = eurUsdRate(read)
  let eur = null
  if ((cc === 'VE' && cur === 'VES') || (cc === 'AR' && cur === 'ARS')) {
    eur = crossToEur(usd, eu)
  } else if (eu && validRate(eu.rates?.[cur])) {
    eur = { rate: Number(eu.rates[cur]) / eu.rate, at: eu.at, source: 'fixer', ref: 'EUR' }
  }
  return eur || { ...asUsd, wanted: 'EUR' }
}

// Partes de la etiqueta de una tasa de la lente: como rateLabelParts, y para
// el cruce, la clave "{base} × EUR/USD Fixer" con la fuente base.
export function lensLabelParts(r) {
  const p = rateLabelParts(r)
  if (!p || !r.via) return p
  return { sourceKey: 'refcur.source.crossEur', baseKey: SOURCE_LABEL[r.via.base.source] || SOURCE_LABEL.manual, at: p.at }
}
