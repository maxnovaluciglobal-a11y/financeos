// src/pages/Investments/planificar/Fold.jsx — sección plegable de Planificar
// (26-nov-2026): la calculadora al pie de Tus tramos, y "¿Cuánto podrías
// tener?" y los planes guardados al pie de Aportes.
import { ChevronDown } from 'lucide-react'
import s from './planificar.module.css'

// Sección plegable con su título como botón (patrón disclosure): el contenido
// queda montado aunque esté cerrado, así lo escrito no se pierde al plegar.
export default function Fold({ id, title, count = null, open, onToggle, headRef = null, children, className = '' }) {
  return (
    <section className={`${s.card} ${s.fold} ${className}`} aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className={s.foldH}>
        <button ref={headRef} type="button" className={s.foldBtn} aria-expanded={open} aria-controls={`${id}-body`} onClick={onToggle}>
          <span>{title}{count != null && <span className={s.foldCount}> ({count})</span>}</span>
          <ChevronDown size={18} strokeWidth={2} aria-hidden="true" className={s.foldIc} data-open={open || undefined} />
        </button>
      </h2>
      <div id={`${id}-body`} className={s.wrap} hidden={!open}>{children}</div>
    </section>
  )
}
