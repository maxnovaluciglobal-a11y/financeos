// src/extras/strings.js — textos de avisos locales, Transparencias, Invita y
// Puntos y millas fuera del diccionario
// principal (src/i18n/lazySection.js): el español viaja con este módulo, que
// solo importan chunks diferidos; en/pt/de llegan con import() a demanda.
import { createSection } from '../i18n/lazySection.js'
import es from './strings.es.js'

const section = createSection(es, {
  en: () => import('./strings.en.js'),
  pt: () => import('./strings.pt.js'),
  de: () => import('./strings.de.js'),
})

export const extrasStringsReady = section.ready
export const loadExtrasStrings = section.load
export const ExtrasStringsGate = section.Gate
