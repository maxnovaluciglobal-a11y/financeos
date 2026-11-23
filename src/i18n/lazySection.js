// src/i18n/lazySection.js — textos de una pantalla diferida, fuera del
// diccionario principal (src/i18n/sections.js).
//
// createSection(es, { en, pt, de }) registra el español (que viaja en el chunk
// de la pantalla) y carga los otros idiomas con import() a demanda. Su <Gate>
// envuelve la pantalla: mientras llega el idioma activo suspende y el
// <Suspense> de App muestra el esqueleto de carga, así nunca se ve una clave
// cruda ni un instante en español. Dentro, useT() sigue igual: translate()
// busca también en las secciones registradas.
import { use } from 'react'
import { addSectionStrings } from './sections.js'
import { useT } from './useT.js'

export function createSection(es, loaders = {}) {
  addSectionStrings('es', es)
  const done = { es: true }
  const pending = {}
  const ready = (lang) => !!done[lang] || !loaders[lang]
  // Nunca rechaza: si el chunk no llega (red, chunk viejo tras un deploy) se
  // sigue en español, mejor que la clave cruda o una pantalla en blanco.
  function load(lang) {
    if (ready(lang)) return Promise.resolve()
    if (!pending[lang]) {
      pending[lang] = loaders[lang]()
        .then((mod) => { addSectionStrings(lang, mod.default); done[lang] = true })
        .catch(() => { done[lang] = true })
    }
    return pending[lang]
  }
  function Gate({ children }) {
    const { lang } = useT()
    if (!ready(lang)) use(load(lang))
    return children
  }
  return { ready, load, Gate }
}
