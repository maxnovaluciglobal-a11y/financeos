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
import { useAppOptional } from '../context/AppContext.jsx'
import { translate } from './translate.js'
// Caché de idiomas ya cargados, ahora compartida con utils/index.js (ver
// langCache.js) — antes vivía solo acá, pero utils/index.js (catLabel/
// recurrenceLabel) necesitaba el mismo diccionario del idioma activo y no
// puede usar este hook (se llama fuera de componentes React).
import { langCache, loadLang, waitForLang } from './langCache.js'

export function useT() {
  // Sin provider (panel ?admin=crm → AuthGate) no hay ajustes: español.
  const settings = useAppOptional()?.settings
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

// V4: true cuando ya se puede pintar sin mostrar español a quien usa otro idioma
// (ver waitForLang). Vale solo para el primer pintado: una vez en true no vuelve
// a false, así cambiar de idioma en Ajustes no desmonta la app. `settled` en
// false mientras el idioma guardado todavía no se conoce.
export function useLangReady(lang = 'es', settled = true) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!settled || ready) return
    let cancelled = false
    waitForLang(lang).then(() => { if (!cancelled) setReady(true) })
    return () => { cancelled = true }
  }, [lang, settled, ready])

  return ready || (settled && !!langCache[lang])
}
