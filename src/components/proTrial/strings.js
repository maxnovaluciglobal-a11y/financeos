// src/components/proTrial/strings.js — textos de los avisos de la prueba de Pro
// sin tarjeta fuera del diccionario principal (src/i18n/lazySection.js): el
// español viaja con este módulo, que solo importa ProTrialNotices (diferido);
// en/pt/de llegan con import() a demanda.
import { createSection } from '../../i18n/lazySection.js'
import es from './strings.es.js'

const section = createSection(es, {
  en: () => import('./strings.en.js'),
  pt: () => import('./strings.pt.js'),
  de: () => import('./strings.de.js'),
})

export const ProTrialStringsGate = section.Gate
