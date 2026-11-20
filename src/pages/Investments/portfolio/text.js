// src/pages/Investments/portfolio/text.js — textos de Portafolio (F1) en los
// 4 idiomas de moyiq. Viven aquí, dentro del chunk diferido de Inversiones, y
// no en src/i18n/*.js: así no pesan en la carga inicial (scripts/bundleBudget.js).
// El español va en el chunk (es el respaldo); en/pt/de se piden aparte y solo
// el idioma de la persona, igual que src/i18n/langCache.js. Misma regla que
// useT: si falta una clave en el idioma elegido, español; si tampoco, la clave.
import { useEffect, useState } from 'react'
import { useAppOptional } from '../../../context/AppContext.jsx'
import { interpolate } from '../../../i18n/translate.js'
import { langCache } from '../../../i18n/langCache.js'
import { es } from './text.es.js'

const loaders = {
  en: () => import('./text.en.js').then(m => m.en),
  pt: () => import('./text.pt.js').then(m => m.pt),
  de: () => import('./text.de.js').then(m => m.de),
}
const loaded = { es }
const pending = {}

export function loadPT(lang) {
  if (loaded[lang]) return Promise.resolve(loaded[lang])
  if (!loaders[lang]) return Promise.resolve(es)
  if (!pending[lang]) pending[lang] = loaders[lang]().then(d => (loaded[lang] = d)).catch(() => { delete pending[lang]; return es })
  return pending[lang]
}
// Al llegar este chunk, el idioma que moyiq ya cargó se pide enseguida: casi
// siempre está listo antes de que se pinte la pestaña.
for (const l of Object.keys(langCache)) if (loaders[l]) loadPT(l)

export function ptFor(lang = 'es') {
  const dict = loaded[lang] || es
  const t = (key, vars) => interpolate(dict[key] ?? es[key] ?? key, vars)
  return { t, lang: loaded[lang] ? lang : 'es' }
}

export function usePT() {
  const lang = useAppOptional()?.settings?.language || 'es'
  const [, force] = useState(0)
  useEffect(() => {
    if (loaded[lang] || !loaders[lang]) return undefined
    let cancelled = false
    loadPT(lang).then(() => { if (!cancelled) force(n => n + 1) })
    return () => { cancelled = true }
  }, [lang])
  return ptFor(lang)
}
