// src/i18n/translations.js
// Diccionario de traducción, dividido por idioma en es.js/en.js/pt.js/de.js. Este
// archivo agrega los 4 en un solo objeto y hoy nadie lo importa: ningún módulo
// de la app debe importarlo, ni importar en.js/pt.js/de.js directamente,
// porque eso mete esos idiomas en el chunk que lo importe (build.js lo rechaza,
// ver scripts/bundleBudget.js). El idioma activo se carga con import() desde
// langCache.js; el español es el fallback síncrono de toda la app.
//
// Convención de keys: 'seccion.subseccion.campo'. Si una key falta en el idioma
// activo, useT() cae a español, y si tampoco existe ahí, muestra la propia key
// (nunca un error ni una pantalla en blanco).

import { es } from './es.js'
import { en } from './en.js'
import { pt } from './pt.js'
import { de } from './de.js'

export const translations = { es, en, pt, de }

export const SUPPORTED_LANGUAGES = ['es', 'en', 'pt', 'de']
