// Textos de Ajustes › Inversiones (F7): español en el chunk de la pantalla,
// en/pt/de a demanda (src/i18n/lazyDict.js), fuera de la carga inicial.
import { createLazyDict, useLazyDict } from '../../../i18n/lazyDict.js'
import es from './strings.es.js'

export const invSetDict = createLazyDict(es, {
  en: () => import('./strings.en.js'),
  pt: () => import('./strings.pt.js'),
  de: () => import('./strings.de.js'),
})

export const useInvSetT = () => useLazyDict(invSetDict)
