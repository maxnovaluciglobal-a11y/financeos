// Textos de las herramientas fiscales por país fuera del diccionario principal
// (src/i18n/lazySection.js): el español viaja con este módulo, que solo importan
// esas pantallas (diferidas); en/pt/de llegan con import() a demanda.
import { createSection } from '../lazySection.js'
import es from './strings.es.js'

const section = createSection(es, {
  en: () => import('./strings.en.js'),
  pt: () => import('./strings.pt.js'),
  de: () => import('./strings.de.js'),
})

export const CountryToolsStringsGate = section.Gate
