// src/i18n/translate.js
// Traducción PURA, sin React ni contexto: la usa useT() por dentro y la pueden
// usar pantallas que se montan FUERA de AppContext/DemoProvider (DemoGate), donde
// useApp() lanza. Mismo comportamiento que siempre tuvo useT(): si falta la key
// en el idioma activo cae a español, y si tampoco existe muestra la propia key.

import { es } from './es.js'
import { langCache } from './langCache.js'

export const SUPPORTED_LANGS = ['es', 'en', 'pt', 'de']

export function interpolate(str, vars) {
  if (!vars) return str
  return String(str).replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : `{${k}}`))
}

// Como interpolate, pero devuelve las partes en un array para poder intercalar
// nodos de React (una cifra con <Amount>) sin perder el orden de cada idioma:
// interpolateParts("Te quedan {left} de {total}", { left: <A/>, total: <B/> })
// → ["Te quedan ", <A/>, " de ", <B/>]. Una variable que falta queda como texto.
export function interpolateParts(str, vars = {}) {
  return String(str).split(/(\{\w+\})/g).filter(p => p !== '').map(p => {
    const m = /^\{(\w+)\}$/.exec(p)
    return m && vars[m[1]] != null ? vars[m[1]] : p
  })
}

// Usa solo lo que ya está en langCache (cargado con loadLang); si el idioma
// todavía no terminó de cargar, cae a español.
export function translate(lang, key, vars) {
  const dict = langCache[lang]
  const str = dict?.[key] ?? es[key] ?? key
  return interpolate(str, vars)
}

// Idioma del navegador -> uno de los 4 soportados (default 'es').
// Acepta un string ('pt-BR') o una lista (navigator.languages).
export function detectLanguage(input) {
  let list = input
  if (list == null && typeof navigator !== 'undefined') {
    list = navigator.languages?.length ? navigator.languages : [navigator.language]
  }
  if (!Array.isArray(list)) list = [list]
  for (const l of list) {
    const base = String(l || '').toLowerCase().split(/[-_]/)[0]
    if (SUPPORTED_LANGS.includes(base)) return base
  }
  return 'es'
}
