// Textos de la vista esencial: español en el chunk de Inversiones, en/pt/de a
// demanda (src/i18n/lazyDict.js), así no pesan en la carga inicial.
import { createLazyDict, useLazyDict } from '../../../i18n/lazyDict.js'
import es from './strings.es.js'

export const essDict = createLazyDict(es, {
  en: () => import('./strings.en.js'),
  pt: () => import('./strings.pt.js'),
  de: () => import('./strings.de.js'),
})

export const useEssT = () => useLazyDict(essDict)
