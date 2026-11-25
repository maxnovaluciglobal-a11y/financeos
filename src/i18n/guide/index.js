// src/i18n/guide/index.js — textos de Primeros pasos, la hoja de avisos con
// ejemplos y "Por revisar", fuera del diccionario principal
// (src/i18n/lazySection.js). El español viaja con el chunk que lo importa; en,
// pt y de llegan con import() la primera vez. <GuideStringsGate> envuelve
// cada pieza para que nunca se vea una clave cruda.
import { createSection } from '../lazySection.js'
import es from './strings.es.js'

const guideSection = createSection(es, {
  en: () => import('./strings.en.js'),
  pt: () => import('./strings.pt.js'),
  de: () => import('./strings.de.js'),
})

export const GuideStringsGate = guideSection.Gate
export const guideStringsLoad = guideSection.load
