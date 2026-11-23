// Textos de APV fuera del diccionario principal (src/i18n/lazySection.js).
import { createSection } from '../../i18n/lazySection.js'
import es from './strings.es.js'

const apvSection = createSection(es, {
  en: () => import('./strings.en.js'),
  pt: () => import('./strings.pt.js'),
  de: () => import('./strings.de.js'),
})

export const ApvStringsGate = apvSection.Gate
export const apvStringsLoad = apvSection.load
