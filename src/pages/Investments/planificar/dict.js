// Textos de Planificar: español en el chunk de Planificar, en/pt/de a demanda
// (src/i18n/lazyDict.js), así no pesan en la carga inicial.
import { createLazyDict, useLazyDict } from '../../../i18n/lazyDict.js'
import es from './strings.es.js'

export const planDict = createLazyDict(es, {
  en: () => import('./strings.en.js'),
  pt: () => import('./strings.pt.js'),
  de: () => import('./strings.de.js'),
})

export const usePlanT = () => useLazyDict(planDict)
