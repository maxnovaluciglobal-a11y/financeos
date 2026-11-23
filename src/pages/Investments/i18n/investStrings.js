// Textos de Inversiones fuera del diccionario principal (src/i18n/lazySection.js):
// el español viaja con este módulo, que importan las dos entradas diferidas de
// la sección (index.jsx y Asset.jsx); en/pt/de llegan con import() al entrar.
import { createSection } from '../../../i18n/lazySection.js'
import es from './strings.es.js'

const section = createSection(es, {
  en: () => import('./strings.en.js'),
  pt: () => import('./strings.pt.js'),
  de: () => import('./strings.de.js'),
})

export const investStringsReady = section.ready
export const loadInvestStrings = section.load
export const InvestStringsGate = section.Gate
