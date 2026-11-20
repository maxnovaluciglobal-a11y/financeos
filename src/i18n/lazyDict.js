// src/i18n/lazyDict.js — textos de una pantalla diferida, por idioma y a demanda.
//
// Los diccionarios de la app (es.js y el idioma activo) van en el JS inicial o
// en su chunk de idioma. Una pantalla pesada que se carga con lazy() (la ficha
// del activo de Inversiones) trae sus propios textos: el español dentro de su
// chunk (fallback síncrono) y en/pt/de con import() solo si hacen falta. Así
// el JS inicial no crece con textos que la mayoría no abre
// (scripts/bundleBudget.js).
//
// Orden de búsqueda: diccionario de la pantalla en el idioma activo → el de la
// pantalla en español → el `t` general de la app (claves compartidas).
import { useEffect, useState } from 'react'
import { useT } from './useT.js'
import { interpolate } from './translate.js'

export function createLazyDict(es, loaders = {}) {
  const cache = { es }
  const pending = {}
  function load(lang) {
    if (cache[lang]) return Promise.resolve(cache[lang])
    const loader = loaders[lang]
    if (!loader) return Promise.resolve(es)
    if (!pending[lang]) {
      pending[lang] = loader()
        .then((mod) => { cache[lang] = mod.default || mod.strings || es; return cache[lang] })
        .catch(() => { delete pending[lang]; return es })
    }
    return pending[lang]
  }
  function lookup(lang, key) {
    const d = cache[lang]
    if (d && Object.prototype.hasOwnProperty.call(d, key)) return d[key]
    if (Object.prototype.hasOwnProperty.call(es, key)) return es[key]
    return null
  }
  return { cache, load, lookup }
}

export function useLazyDict(dict) {
  const { t: tApp, lang } = useT()
  const [, bump] = useState(0)
  useEffect(() => {
    if (dict.cache[lang]) return undefined
    let alive = true
    dict.load(lang).then(() => { if (alive) bump(n => n + 1) })
    return () => { alive = false }
  }, [dict, lang])
  function t(key, vars) {
    const s = dict.lookup(lang, key)
    return s == null ? tApp(key, vars) : interpolate(s, vars)
  }
  return { t, lang }
}
