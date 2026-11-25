// src/i18n/categories/index.js — textos de las categorías en píldoras, las
// reglas de categoría y las propuestas de "moyiq propone, tú confirmas", fuera
// del diccionario principal (src/i18n/lazySection.js). El español viaja con el
// chunk que lo importa; en, pt y de llegan con import() la primera vez.
// <CategoryStringsGate> envuelve cada pieza para que nunca se vea una clave
// cruda ni un instante en español.
import { createElement, Suspense } from 'react'
import { createSection } from '../lazySection.js'
import es from './strings.es.js'

const categorySection = createSection(es, {
  en: () => import('./strings.en.js'),
  pt: () => import('./strings.pt.js'),
  de: () => import('./strings.de.js'),
})

export const CategoryStringsGate = categorySection.Gate
export const categoryStringsLoad = categorySection.load

/**
 * El componente envuelto en el Gate de estos textos. Con `fallback` (null o
 * un nodo) trae su propio <Suspense>; sin él, la espera la muestra el
 * <Suspense> de más arriba (la hoja del alta, la página).
 */
export function withCategoryStrings(Comp, fallback) {
  const Wrapped = (props) => {
    const inner = createElement(CategoryStringsGate, null, createElement(Comp, props))
    return fallback === undefined ? inner : createElement(Suspense, { fallback }, inner)
  }
  Wrapped.displayName = `withCategoryStrings(${Comp.displayName || Comp.name || 'Component'})`
  return Wrapped
}
