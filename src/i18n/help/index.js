// Textos de la ayuda en la app (panel, centro de ayuda, recorridos, novedades)
// fuera del diccionario principal (src/i18n/lazySection.js): el español viaja
// con este módulo, que solo importan la ayuda y el centro de ayuda (diferidos);
// en/pt/de llegan con import() a demanda.
import { createSection } from '../lazySection.js'
import es from './strings.es.js'

const section = createSection(es, {
  en: () => import('./strings.en.js'),
  pt: () => import('./strings.pt.js'),
  de: () => import('./strings.de.js'),
})

export const HelpStringsGate = section.Gate
export const helpStringsLoad = section.load
