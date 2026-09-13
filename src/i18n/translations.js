// src/i18n/translations.js
// Diccionario de traducción, ahora dividido por idioma en es.js/en.js/pt.js/de.js
// (antes vivían los 4 acá mismo, en un solo objeto que se bundleaba completo aunque
// el usuario solo usara un idioma). Este archivo agrega los 4 en un solo objeto
// SOLO para los consumidores que todavía necesitan acceso síncrono a más de un
// idioma a la vez (goalSuggestions.js, financialScore.js, utils/index.js,
// coachRules.js) — todos importan estáticamente, así que igual bundlean los 4.
//
// El hook principal (useT.js) YA NO importa este archivo: hace import() dinámico
// del idioma activo directamente desde su archivo individual, así que la mayoría
// de la app solo carga el idioma que realmente usa. Ver useT.js.
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
