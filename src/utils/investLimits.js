// src/utils/investLimits.js — límites de Inversiones para Starter (modelo A,
// decisión del 26-nov-2026). Construidos y APAGADOS: el único interruptor es
// config.features.investStarterLimits (false). Con el interruptor apagado,
// Pro, el demo o sin saber el plan, no hay límite (null).
//
// Son límites de la app (como ProGate): el día que se enciendan, hace falta
// también el lado del servidor si se quiere que nadie los salte con la API
// (pendiente, ver el informe del 26-nov).
import config from '../config.js'
import { hasProEntitlement } from './licenseValidator.js'

export const STARTER_INVEST_LIMITS = Object.freeze({
  portfolios: 1,     // un portafolio (la app hoy tiene uno solo)
  positions: 10,     // posiciones en ese portafolio
  watchlist: 10,     // activos en Siguiendo
  tramos: 3,         // activos que calcula Tus tramos
  importFile: false, // importar posiciones desde CSV o Excel
  alertPush: false,  // las alertas de precio se ven en la app, sin aviso push
})

export const INVEST_LIMIT_KINDS = Object.freeze(['positions', 'watchlist', 'tramos', 'import', 'alerts'])

export function investLimitsEnabled(features = config.features) {
  return features?.investStarterLimits === true
}

// null = sin límites.
export function investLimitsFor({ enabled = investLimitsEnabled(), isPro = false, isDemo = false } = {}) {
  if (!enabled || isPro || isDemo) return null
  return STARTER_INVEST_LIMITS
}

function isDemoUrl() {
  return typeof window !== 'undefined' && /(?:^|[?&])demo=true(?:&|$)/.test(window.location.search.slice(1))
}

// Los de esta cuenta en este dispositivo, ahora.
export function currentInvestLimits({ enabled = investLimitsEnabled(), isPro = hasProEntitlement(), isDemo = isDemoUrl() } = {}) {
  return investLimitsFor({ enabled, isPro, isDemo })
}

// ¿Se puede sumar uno más? `count` = los que ya hay.
export function canAddMore(kind, count, limits = currentInvestLimits()) {
  if (!limits) return true
  const max = kind === 'positions' ? limits.positions : kind === 'watchlist' ? limits.watchlist : kind === 'tramos' ? limits.tramos : Infinity
  return (Number(count) || 0) < max
}

export function canImportFile(limits = currentInvestLimits()) {
  return !limits || limits.importFile === true
}

export function canPushAlerts(limits = currentInvestLimits()) {
  return !limits || limits.alertPush === true
}

// Los primeros `limits.tramos` activos entran en Tus tramos; el resto queda
// aparte (se muestra con el aviso del límite, sin cálculo).
export function splitForTramos(list, limits = currentInvestLimits()) {
  const arr = Array.isArray(list) ? list : []
  if (!limits) return { shown: arr, locked: [] }
  return { shown: arr.slice(0, limits.tramos), locked: arr.slice(limits.tramos) }
}

// Aviso contextual: Inversiones muestra una hoja con qué abre Pro y el camino
// gratis (InvestLimitSheet). Se dispara desde los datos o desde la pantalla.
export const INVEST_LIMIT_EVENT = 'fnos:invest-limit'
export function announceInvestLimit(kind) {
  if (!INVEST_LIMIT_KINDS.includes(kind)) return
  try {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(INVEST_LIMIT_EVENT, { detail: { kind } }))
  } catch { /* sin window: nada que mostrar */ }
}
