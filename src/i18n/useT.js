// src/i18n/useT.js
// Hook de traducción. Lee settings.language del contexto activo (real o demo).
// Si falta una key en el idioma elegido, cae a español; si tampoco existe ahí,
// muestra la propia key (nunca undefined ni pantalla rota).
//
// Carga el diccionario del idioma activo con import() dinámico (src/i18n/<lang>.js)
// en vez de importar el objeto combinado de los 4 idiomas — así el bundle inicial
// solo trae español (fallback, siempre necesario) + el idioma que el usuario
// realmente tiene elegido, no los 4 juntos.

import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { es } from './es.js'

// Caché de idiomas ya cargados, en memoria (persiste mientras dure la sesión de la app).
// 'es' arranca precargado: es el fallback que useT() necesita siempre disponible
// de forma síncrona, y además es el idioma por defecto de la app.
const langCache = { es }
const langPromises = {}

// Mapa explícito en vez de import(`./${lang}.js`): con la variable, el plugin
// vite:dynamic-import-vars no puede resolver el chunk por separado (falla con
// "Variable imports cannot import their own directory" al estar en el mismo
// directorio) y termina metiendo los 4 idiomas en el bundle principal igual.
// Con una entrada literal por idioma, Vite sí genera un chunk propio por cada uno.
const loaders = {
  es: () => import('./es.js'),
  en: () => import('./en.js'),
  pt: () => import('./pt.js'),
  de: () => import('./de.js'),
}

function loadLang(lang) {
  if (langCache[lang]) return Promise.resolve(langCache[lang])
  if (!langPromises[lang]) {
    const loader = loaders[lang]
    langPromises[lang] = (loader ? loader() : Promise.resolve({}))
      .then((mod) => {
        langCache[lang] = mod[lang] ?? mod.default ?? es
        return langCache[lang]
      })
      .catch(() => {
        // Si falla la carga (red, chunk viejo tras deploy, etc.), no rompemos la UI:
        // nos quedamos en el fallback español hasta que un reintento (cambio de
        // idioma, recarga) consiga cargarlo.
        return es
      })
  }
  return langPromises[lang]
}

function interpolate(str, vars) {
  if (!vars) return str
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : `{${k}}`))
}

export function useT() {
  const { settings } = useApp()
  const lang = settings?.language || 'es'
  const [, forceRender] = useState(0)

  useEffect(() => {
    if (!langCache[lang]) {
      let cancelled = false
      loadLang(lang).then(() => {
        if (!cancelled) forceRender((n) => n + 1)
      })
      return () => {
        cancelled = true
      }
    }
  }, [lang])

  function t(key, vars) {
    const dict = langCache[lang]
    const str = dict?.[key] ?? es[key] ?? key
    return interpolate(str, vars)
  }

  return { t, lang }
}
