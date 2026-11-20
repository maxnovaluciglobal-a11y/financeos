// Textos de la ficha: español en el chunk de la ficha, en/pt/de a demanda.
import { createLazyDict, useLazyDict } from '../../../i18n/lazyDict.js'
import es from './strings.es.js'

export const assetDict = createLazyDict(es, {
  en: () => import('./strings.en.js'),
  pt: () => import('./strings.pt.js'),
  de: () => import('./strings.de.js'),
})

export const useAssetT = () => useLazyDict(assetDict)
