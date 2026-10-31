// src/components/ui/OptionSheet.jsx — elegir una opción de una lista, en hoja.
// La usan SheetSelect (reemplazo de <select>) y MonthSelector. Filas de 52 px,
// la elegida con ✓ y peso 600 (estado = ícono + palabra).
import { useRef } from 'react'
import { Check } from 'lucide-react'
import Sheet from './Sheet.jsx'
import s from './optionSheet.module.css'

export default function OptionSheet({ open, onClose, title, options, value, onPick }) {
  const selectedRef = useRef(null)
  let lastGroup
  return (
    <Sheet open={open} onClose={onClose} ariaLabel={title} maxWidth={420} initialFocusRef={selectedRef}
      initialDetent={options.length > 7 ? 'full' : 'medium'}>
      {title && <h2 className={s.title}>{title}</h2>}
      <ul className={s.list}>
        {options.map((o) => {
          const on = String(value) === o.value
          const head = o.group && o.group !== lastGroup ? o.group : null
          lastGroup = o.group
          return (
            <li key={o.value}>
              {head && <div className={s.group}>{head}</div>}
              <button ref={on ? selectedRef : undefined} type="button" className={s.row} aria-current={on ? 'true' : undefined}
                disabled={o.disabled} onClick={() => { onClose?.(); if (!on) onPick(o.value) }}>
                <span className={s.label}>{o.label}</span>
                {on && <Check size={18} strokeWidth={2.2} aria-hidden="true" className={s.check} />}
              </button>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
