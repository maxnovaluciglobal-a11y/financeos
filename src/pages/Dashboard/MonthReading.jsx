// src/pages/Dashboard/MonthReading.jsx — el mes en palabras (#10).
// MonthReading: una línea bajo el héroe del Inicio, abre Panorama.
// MonthReadingLong: 2–3 frases arriba de Panorama.
// ConclusionTitle: título que ya es la conclusión (#9); el rótulo de siempre
// queda para lectores de pantalla.
import { ChevronRight } from 'lucide-react'
import { useT } from '../../i18n/useT.js'
import { useMonthReading } from './useMonthReading.js'
import s from './MonthReading.module.css'

export default function MonthReading({ setPage, ...data }) {
  const { t } = useT()
  const { reading, text } = useMonthReading(data)
  if (!reading.short) return null
  const sentence = text(reading.short)
  if (!setPage) return <p className={s.line}>{sentence}</p>
  return (
    <button type="button" className={s.line} onClick={() => setPage('panorama')}>
      <span className={s.lineText}>{sentence}<span className="sr-only"> · {t('reading.open')}</span></span>
      <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" className={s.chev} />
    </button>
  )
}

export function MonthReadingLong(data) {
  const { t } = useT()
  const { reading, text } = useMonthReading(data)
  if (reading.long.length === 0) return null
  return (
    <section aria-label={t('reading.heading')} data-tour="pano-reading">
      <p className={s.long}>{reading.long.map(l => text(l)).join(' ')}</p>
    </section>
  )
}

export function ConclusionTitle({ plain, conclusion }) {
  if (!conclusion) return plain
  return <><span className="sr-only">{plain}: </span>{conclusion}</>
}
