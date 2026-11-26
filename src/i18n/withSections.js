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
import guideEs from './guide/strings.es.js'
import guideEn from './guide/strings.en.js'
import guidePt from './guide/strings.pt.js'
import guideDe from './guide/strings.de.js'
import extrasEs from '../extras/strings.es.js'
import extrasEn from '../extras/strings.en.js'
import extrasPt from '../extras/strings.pt.js'
import extrasDe from '../extras/strings.de.js'
import aheadEs from './ahead/strings.es.js'
import aheadEn from './ahead/strings.en.js'
import aheadPt from './ahead/strings.pt.js'
import aheadDe from './ahead/strings.de.js'
import categoriesEs from './categories/strings.es.js'
import proTrialEs from '../components/proTrial/strings.es.js'
import proTrialEn from '../components/proTrial/strings.en.js'
import proTrialPt from '../components/proTrial/strings.pt.js'
import proTrialDe from '../components/proTrial/strings.de.js'
import categoriesEn from './categories/strings.en.js'
import categoriesPt from './categories/strings.pt.js'
import categoriesDe from './categories/strings.de.js'
import reglasEs from '../pages/Investments/reglas/strings.es.js'
import reglasEn from '../pages/Investments/reglas/strings.en.js'
import reglasPt from '../pages/Investments/reglas/strings.pt.js'
import reglasDe from '../pages/Investments/reglas/strings.de.js'

export const SECTION_DICTS = {
  invest: { es: investEs, en: investEn, pt: investPt, de: investDe },
  apv: { es: apvEs, en: apvEn, pt: apvPt, de: apvDe },
  guide: { es: guideEs, en: guideEn, pt: guidePt, de: guideDe },
  extras: { es: extrasEs, en: extrasEn, pt: extrasPt, de: extrasDe },
  ahead: { es: aheadEs, en: aheadEn, pt: aheadPt, de: aheadDe },
  categories: { es: categoriesEs, en: categoriesEn, pt: categoriesPt, de: categoriesDe },
  proTrial: { es: proTrialEs, en: proTrialEn, pt: proTrialPt, de: proTrialDe },
  reglas: { es: reglasEs, en: reglasEn, pt: reglasPt, de: reglasDe },
}

const merged = (lang, main) => Object.assign({}, main, ...Object.values(SECTION_DICTS).map(d => d[lang]))
export const es = merged('es', esMain)
export const en = merged('en', enMain)
export const pt = merged('pt', ptMain)
export const de = merged('de', deMain)
