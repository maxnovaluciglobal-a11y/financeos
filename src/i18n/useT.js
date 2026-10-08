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
import { translate } from './translate.js'
// Caché de idiomas ya cargados, ahora compartida con utils/index.js (ver
// langCache.js) — antes vivía solo acá, pero utils/index.js (catLabel/
// recurrenceLabel) necesitaba el mismo diccionario del idioma activo y no
// puede usar este hook (se llama fuera de componentes React).
import { langCache, loadLang } from './langCache.js'

export function useT() {
  const { settings } = useApp()
  return useTFor(settings?.language || 'es')
}

// Mismo hook, pero con el idioma explícito: para pantallas que se montan fuera
// de AppContext/DemoProvider (ver DemoGate.jsx), donde useApp() no sirve.
export function useTFor(lang = 'es') {
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
    return translate(lang, key, vars)
  }

  return { t, lang }
}
