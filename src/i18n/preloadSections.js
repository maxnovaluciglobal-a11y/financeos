// src/i18n/preloadSections.js — precarga, en reposo, los textos de las
// secciones diferidas (src/i18n/lazySection.js) del idioma activo. Lo pide
// langCache.loadLang cuando llega el diccionario principal de en/pt/de: así el
// Registro rápido, Primeros pasos, Por revisar o los avisos no esperan dos
// descargas seguidas (su chunk y después el de su idioma) la primera vez.
// Este módulo nunca entra al JS inicial (solo se importa con import()).
import { categoryStringsLoad } from './categories/index.js'
import { guideStringsLoad } from './guide/index.js'
import { aheadStringsLoad } from './ahead/index.js'
import { loadExtrasStrings } from '../extras/strings.js'

export const SECTION_LOADERS = [categoryStringsLoad, guideStringsLoad, aheadStringsLoad, loadExtrasStrings]

/** @param {string} lang */
export default function preloadSections(lang) {
  return Promise.all(SECTION_LOADERS.map(load => load(lang)))
}
