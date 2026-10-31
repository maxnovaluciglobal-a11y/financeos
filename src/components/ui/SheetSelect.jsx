// src/components/ui/SheetSelect.jsx — <select> que en el teléfono se elige en una
// hoja (causa 14, 31-oct-2026): el selector nativo del navegador dentro de una
// pantalla propia es uno de los tells de "esto es una página".
// Mismos hijos y mismo contrato que <select> (value, onChange(e) con
// e.target.value como texto): cambiar la etiqueta alcanza. En escritorio sigue
// siendo el <select> nativo, con su teclado y su búsqueda por letra.
import { useMemo, useRef, useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { useMediaQuery } from '../../hooks/useMediaQuery.js'
import { parseOptions } from './selectOptions.js'
import OptionSheet from './OptionSheet.jsx'

// Texto de la etiqueta asociada, sin el valor del propio botón si la envuelve.
function labelText(btn) {
  const label = btn?.labels?.[0]
  if (!label) return ''
  const own = [...label.childNodes].filter(n => !n.contains(btn)).map(n => n.textContent).join(' ')
  return own.trim()
}

export default function SheetSelect({ value, onChange, children, id, className, style, disabled, name, title, 'aria-label': ariaLabel, ...rest }) {
  const narrow = useMediaQuery('(max-width: 700px)')
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)
  const options = useMemo(() => parseOptions(children), [children])
  if (!narrow) {
    return <select value={value} onChange={onChange} id={id} className={className} style={style} disabled={disabled} name={name} title={title} aria-label={ariaLabel} {...rest}>{children}</select>
  }
  const current = options.find(o => o.value === String(value ?? ''))
  const label = ariaLabel || labelText(btnRef.current)
  // WCAG 2.5.3: el nombre accesible incluye el valor visible del botón.
  const spoken = ariaLabel ? `${ariaLabel}: ${current?.label ?? ''}` : undefined
  return (
    <>
      <button ref={btnRef} type="button" id={id} name={name} disabled={disabled} title={title}
        className={['fos-select', className].filter(Boolean).join(' ')} style={style}
        aria-haspopup="dialog" aria-expanded={open} aria-label={spoken}
        onClick={() => setOpen(true)}>
        <span className="fos-select__value">{current?.label ?? ''}</span>
        <ChevronsUpDown size={16} strokeWidth={1.8} aria-hidden="true" className="fos-select__chev" />
      </button>
      <OptionSheet open={open} onClose={() => setOpen(false)} title={label} options={options} value={value ?? ''}
        onPick={(v) => onChange?.({ target: { value: v, name }, currentTarget: { value: v, name } })} />
    </>
  )
}
// FormGroup asocia su <label> a este campo igual que a un <select>.
SheetSelect.isField = true
