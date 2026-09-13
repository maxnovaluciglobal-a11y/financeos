// src/i18n/langCache.js
// Caché compartida de diccionarios de idioma cargados dinámicamente por
// import() — extraída de useT.js para que módulos que NO pueden usar hooks de
// React (utils/index.js, llamado también fuera de componentes) puedan leer el
// idioma activo ya cargado, sin forzar un import estático de los 4 idiomas.
//
// 'es' arranca precargado: es el fallback que toda la app necesita disponible
// de forma síncrona, y además es el idioma por defecto.

import { es } from './es.js'

export const langCache = { es }
const langPromises = {}

// Mapa explícito en vez de import(`./${lang}.js`): con la variable, el plugin
// vite:dynamic-import-vars no puede resolver el chunk por separado (falla con
// "Variable imports cannot import their own directory" al estar en el mismo
// directorio) y termina metiendo los 4 idiomas en el bundle principal igual.
const loaders = {
  es: () => import('./es.js'),
  en: () => import('./en.js'),
  pt: () => import('./pt.js'),
  de: () => import('./de.js'),
}

export function loadLang(lang) {
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
