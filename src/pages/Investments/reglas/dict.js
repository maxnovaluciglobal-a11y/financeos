// Textos de "Tus reglas hoy": español en el chunk de Inversiones, en/pt/de a
// demanda (src/i18n/lazyDict.js), así no pesan en la carga inicial. Los tests
// de textos los revisan por src/i18n/withSections.js (sección `reglas`).
import { createLazyDict, useLazyDict } from '../../../i18n/lazyDict.js'
import es from './strings.es.js'

export const reglasDict = createLazyDict(es, {
  en: () => import('./strings.en.js'),
  pt: () => import('./strings.pt.js'),
  de: () => import('./strings.de.js'),
})

export const useReglasT = () => useLazyDict(reglasDict)
