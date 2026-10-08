// src/i18n/region.js
// Valores de primer arranque a partir del navegador. Solo se usan cuando el
// dispositivo todavía no tiene ajustes guardados (ver getSettings en
// core/db/index.js): nunca pisan lo que el usuario ya eligió.
//
//   idioma  → detectLanguage() (el mismo que usa el demo)
//   país    → la región del primer locale que traiga región ('en-US' → US),
//             solo si ese país existe en COUNTRIES. La moneda sale de
//             suggestedCurrency(). Sin región reconocible: si el idioma no es
//             español se arranca en 'OTHER' (USD) en vez de Chile; si es
//             español no se toca y queda el default de siempre.

import { detectLanguage } from './translate.js'
import { COUNTRIES, suggestedCurrency } from '../data/countries.js'

const KNOWN = new Set(COUNTRIES.map(c => c.code).filter(c => c !== 'OTHER'))

// Idioma que sugiere cada país del onboarding. 'OTHER' no sugiere nada.
const LANG_BY_COUNTRY = { US: 'en', DE: 'de', PT: 'pt' }

export function languageForCountry(code) {
  if (!code || code === 'OTHER') return null
  if (LANG_BY_COUNTRY[code]) return LANG_BY_COUNTRY[code]
  return KNOWN.has(code) ? 'es' : null
}

function browserLocales() {
  if (typeof navigator === 'undefined') return []
  return navigator.languages?.length ? [...navigator.languages] : [navigator.language].filter(Boolean)
}

// Región ISO de dos letras de un tag BCP 47 ('es-419' y 'zh-Hant' no la tienen).
function regionOf(tag) {
  const parts = String(tag || '').split(/[-_]/).slice(1)
  const r = parts.find(p => /^[a-z]{2}$/i.test(p))
  return r ? r.toUpperCase() : null
}

export function regionDefaults(input) {
  let list = input == null ? browserLocales() : input
  if (!Array.isArray(list)) list = [list]
  const language = detectLanguage(list)
  const firstRegion = list.map(regionOf).find(Boolean)
  if (firstRegion && KNOWN.has(firstRegion)) {
    return { language, country: firstRegion, currency: suggestedCurrency(firstRegion) }
  }
  if (language !== 'es') return { language, country: 'OTHER', currency: suggestedCurrency('OTHER') }
  return { language }
}
