// src/i18n/ahead/index.js — textos de "lo que viene" (ritmo rotulado, cuotas,
// próximos meses, pagado este mes, tarjetas) fuera del diccionario principal
// (src/i18n/lazySection.js). Sin <Gate>: los componentes que los usan se
// pintan recién cuando el idioma activo llegó (useAheadStrings().ready), así
// la pantalla que los contiene no espera ni muestra una isla en español.
import { useEffect, useState } from 'react'
import { createSection } from '../lazySection.js'
import { useT } from '../useT.js'
import es from './strings.es.js'

const section = createSection(es, {
  en: () => import('./strings.en.js'),
  pt: () => import('./strings.pt.js'),
  de: () => import('./strings.de.js'),
})

export const aheadStringsLoad = section.load

export function useAheadStrings() {
  const tt = useT()
  const ready = section.ready(tt.lang)
  const [, bump] = useState(0)
  useEffect(() => {
    if (ready) return undefined
    let alive = true
    section.load(tt.lang).then(() => { if (alive) bump(n => n + 1) })
    return () => { alive = false }
  }, [ready, tt.lang])
  return { ...tt, ready }
}
