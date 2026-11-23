// src/i18n/withSections.js — SOLO PARA TESTS. Diccionario principal + textos de
// las pantallas diferidas (src/i18n/lazySection.js), por idioma, para que los
// tests de textos (paridad, voseo, glosario, marca) revisen también lo que ya
// no vive en es/en/pt/de.js. Ningún módulo de la app debe importarlo: metería
// los 4 idiomas en su chunk (scripts/bundleBudget.js).
import { es as esMain } from './es.js'
import { en as enMain } from './en.js'
import { pt as ptMain } from './pt.js'
import { de as deMain } from './de.js'
import investEs from '../pages/Investments/i18n/strings.es.js'
import investEn from '../pages/Investments/i18n/strings.en.js'
import investPt from '../pages/Investments/i18n/strings.pt.js'
import investDe from '../pages/Investments/i18n/strings.de.js'
import apvEs from '../pages/APV/strings.es.js'
import apvEn from '../pages/APV/strings.en.js'
import apvPt from '../pages/APV/strings.pt.js'
import apvDe from '../pages/APV/strings.de.js'

export const SECTION_DICTS = {
  invest: { es: investEs, en: investEn, pt: investPt, de: investDe },
  apv: { es: apvEs, en: apvEn, pt: apvPt, de: apvDe },
}

const merged = (lang, main) => Object.assign({}, main, ...Object.values(SECTION_DICTS).map(d => d[lang]))
export const es = merged('es', esMain)
export const en = merged('en', enMain)
export const pt = merged('pt', ptMain)
export const de = merged('de', deMain)
