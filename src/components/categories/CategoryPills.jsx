// src/components/categories/CategoryPills.jsx — categorías en píldoras con emoji
// para el alta (24-nov-2026). Tocar elige; mantener presionada una píldora
// abre su edición (nombre, emoji y color). Como mucha gente nunca descubre la
// pulsación larga, al final siempre hay una píldora "Editar" a la vista que
// abre lo mismo (y el clic derecho en escritorio también).
//   cats       lista ya ordenada (la elegida incluida)
//   value      la elegida
//   onPick(c)  tocar
//   onEdit(c|null)  pulsación larga sobre c, o la píldora "Editar" (null)
//   layout     'scroll' (una fila deslizable, hoja compacta) | 'wrap'
//   editPill   false cuando el contenedor muestra su propio botón Editar fijo
//              (la fila deslizable lo dejaría fuera de la vista)
import { forwardRef, useRef } from 'react'
import { Pencil } from 'lucide-react'
import { emojiFor, nameFor } from '../../utils/categoryPrefs.js'
import css from './categories.module.css'

export const LONG_PRESS_MS = 480
const MOVE_TOLERANCE = 10

/** Pulsación larga con puntero (dedo, lápiz o mouse) que no choca con el desplazamiento. */
export function useLongPress(onLong) {
  const st = useRef({ timer: 0, x: 0, y: 0, fired: false })
  const clear = () => { clearTimeout(st.current.timer); st.current.timer = 0 }
  return {
    onPointerDown: (e) => {
      clear()
      st.current.fired = false
      if (e.button != null && e.button !== 0) return
      st.current.x = e.clientX; st.current.y = e.clientY
      const arg = e.currentTarget.dataset.cat
      st.current.timer = setTimeout(() => { st.current.fired = true; onLong(arg) }, LONG_PRESS_MS)
    },
    onPointerMove: (e) => {
      if (!st.current.timer) return
      if (Math.abs(e.clientX - st.current.x) > MOVE_TOLERANCE || Math.abs(e.clientY - st.current.y) > MOVE_TOLERANCE) clear()
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    // Android manda contextmenu también al final de una pulsación larga: si
    // ya se abrió la edición, no se abre dos veces.
    onContextMenu: (e) => {
      e.preventDefault()
      if (st.current.fired) return
      clear(); st.current.fired = true; onLong(e.currentTarget.dataset.cat)
    },
    // El clic que sigue a una pulsación larga no elige la categoría.
    swallow: () => { if (st.current.fired) { st.current.fired = false; return true } return false },
  }
}

const CategoryPills = forwardRef(function CategoryPills({ cats, value, onPick, onEdit, prefs, lang, t, layout = 'wrap', suggested = '', describedBy, label, fade, className, pillClassName = '', editPill = true }, ref) {
  const lp = useLongPress((c) => onEdit?.(c || null))
  const { swallow, ...handlers } = lp
  return (
    <div ref={ref} role="group" aria-label={label} className={className || (layout === 'scroll' ? css.pillsScroll : css.pills)} data-fade={fade || undefined}>
      {cats.map(c => (
        <button key={c} type="button" data-cat={c} className={`fos-chip ${css.pill} ${pillClassName}`} aria-pressed={value === c}
          onClick={() => { if (!swallow()) onPick(c) }} {...(onEdit ? handlers : {})}
          data-suggested={suggested && suggested === c ? '' : undefined}
          aria-describedby={suggested && suggested === c ? describedBy : undefined}>
          <span aria-hidden="true" className={css.pillEmoji}>{emojiFor(c, prefs)}</span>
          <span>{nameFor(c, prefs, lang)}</span>
        </button>
      ))}
      {onEdit && editPill && (
        <button type="button" className={`fos-chip ${css.pill} ${pillClassName} ${css.pillEdit}`} onClick={() => onEdit(null)}
          aria-haspopup="dialog" title={t('cats.hint')}>
          <Pencil size={15} strokeWidth={1.8} aria-hidden="true" />
          <span>{t('cats.edit')}</span>
        </button>
      )}
    </div>
  )
})

export default CategoryPills
