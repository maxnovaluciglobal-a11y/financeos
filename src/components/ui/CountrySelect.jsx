// src/components/ui/CountrySelect.jsx — selector de país accesible (T16, D5)
//
// Un <select> nativo no puede dibujar SVG dentro de <option>, así que para usar
// CountryBadge (el sello monocromo que reemplaza a las banderas emoji) hace falta
// un listbox propio. Sigue el patrón WAI-ARIA APG "select-only combobox":
//   - el foco se queda SIEMPRE en el botón (role="combobox"); la opción activa se
//     comunica con aria-activedescendant, no moviendo el foco;
//   - Enter / Espacio / ↓ / ↑ abren; ↑ ↓ Inicio Fin RePág AvPág mueven;
//     escribir busca por nombre (type-ahead, sin tildes); Enter / Espacio eligen;
//     Esc cierra sin cambiar; Tab cierra y sigue al próximo control;
//   - clic afuera cierra.
// La lógica de teclado pura vive en listboxKeys.js (con tests).
//
// options: [{ code: 'CL', label: 'Chile' }, …] — `label` ya traducido.
// labelId: id del texto visible que nombra el campo (aria-labelledby).

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import CountryBadge from '../CountryBadge.jsx'
import { moveIndex, typeaheadIndex, isTypeaheadKey } from './listboxKeys.js'

function Mark({ code, size }) {
  // "Otro país" no tiene sello: marca de texto, la misma que usa el onboarding.
  if (code === 'OTHER') {
    return <span aria-hidden="true" style={{ display: 'inline-flex', justifyContent: 'center', width: size, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--th)' }}>··</span>
  }
  return <span aria-hidden="true" style={{ display: 'inline-flex', color: 'var(--tm)' }}><CountryBadge code={code} size={size} /></span>
}

const POPUP_MAX_H = 320

export default function CountrySelect({ value, onChange, options, labelId, id }) {
  const autoId = useId()
  const baseId = id || `cs-${autoId.replace(/:/g, '')}`
  const listId = `${baseId}-list`
  const optId = (i) => `${baseId}-opt-${options[i]?.code}`

  const selectedIndex = Math.max(0, options.findIndex(o => o.code === value))
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(selectedIndex)
  const [place, setPlace] = useState({ up: false, maxH: POPUP_MAX_H })
  const triggerRef = useRef(null)
  const listRef = useRef(null)
  const wrapRef = useRef(null)
  const typed = useRef({ buffer: '', timer: null })

  function openList(at = selectedIndex) {
    setActive(at)
    setOpen(true)
  }
  function closeList() { setOpen(false) }
  function choose(i) {
    const opt = options[i]
    closeList()
    triggerRef.current?.focus()
    if (opt && opt.code !== value) onChange(opt.code)
  }

  // Abre hacia abajo si entra, si no hacia arriba; la altura máxima se recorta al
  // espacio real para que nunca se salga del viewport. En móvil se reserva el
  // alto del tabbar flotante (~96px + safe area), que si no tapa las últimas opciones.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    const bottomReserve = window.innerWidth <= 700 ? 112 : 16
    const below = window.innerHeight - r.bottom - bottomReserve
    const above = r.top - 16
    const up = below < 200 && above > below
    setPlace({ up, maxH: Math.max(140, Math.min(POPUP_MAX_H, up ? above : below)) })
  }, [open])

  // Mantiene visible la opción activa (al abrir: la elegida). Se desplaza solo la
  // lista — scrollIntoView movería también la página y el botón con ella.
  useEffect(() => {
    const list = listRef.current
    const el = open && document.getElementById(optId(active))
    if (!list || !el) return
    if (el.offsetTop < list.scrollTop) list.scrollTop = el.offsetTop - 4
    else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight + 4
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active, place.maxH])

  // Clic / toque afuera cierra.
  useEffect(() => {
    if (!open) return
    function onDown(e) { if (!wrapRef.current?.contains(e.target)) closeList() }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  useEffect(() => () => clearTimeout(typed.current.timer), [])

  function onTypeahead(ch) {
    const tb = typed.current
    clearTimeout(tb.timer)
    tb.buffer += ch
    tb.timer = setTimeout(() => { tb.buffer = '' }, 500)
    const idx = typeaheadIndex(tb.buffer, options.map(o => o.label), open ? active : selectedIndex)
    if (idx >= 0) { if (!open) setOpen(true); setActive(idx) }
    else if (!open) openList()
  }

  function onKeyDown(e) {
    const { key } = e
    if (!open) {
      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') {
        e.preventDefault()
        openList(key === 'ArrowUp' ? Math.max(selectedIndex - 1, 0) : selectedIndex)
        return
      }
      if (key === 'Home' || key === 'End') { e.preventDefault(); openList(key === 'Home' ? 0 : options.length - 1); return }
      if (isTypeaheadKey(e)) { e.preventDefault(); onTypeahead(key) }
      return
    }
    switch (key) {
      case 'ArrowDown': case 'ArrowUp': case 'Home': case 'End': case 'PageDown': case 'PageUp':
        e.preventDefault()
        if (key === 'ArrowUp' && e.altKey) { choose(active); return }
        setActive(moveIndex(key, active, options.length))
        return
      case 'Enter': case ' ':
        e.preventDefault(); choose(active); return
      case 'Escape':
        e.preventDefault(); closeList(); return
      case 'Tab':
        closeList(); return   // sin preventDefault: el foco sigue al próximo control
      default:
        if (isTypeaheadKey(e)) { e.preventDefault(); onTypeahead(key) }
    }
  }

  const current = options[selectedIndex]

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
      <button
        ref={triggerRef}
        id={baseId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelId}
        aria-activedescendant={open ? optId(active) : undefined}
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={onKeyDown}
        className="fos-cselect"
      >
        {current && <Mark code={current.code} size={18} />}
        <span className="fos-cselect__value">{current?.label}</span>
        <ChevronDown size={16} strokeWidth={1.7} aria-hidden="true" className="fos-cselect__chev" data-open={open || undefined} />
      </button>

      {/* El listbox queda en el DOM aunque esté cerrado: aria-controls tiene que
          apuntar a un id existente. hidden lo saca del árbol de accesibilidad. */}
      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-labelledby={labelId}
        tabIndex={-1}
        hidden={!open}
        className="fos-cselect__list"
        data-up={place.up || undefined}
        style={{ maxHeight: place.maxH }}
      >
        {options.map((o, i) => {
          const selected = o.code === value
          return (
            <li
              key={o.code}
              id={optId(i)}
              role="option"
              aria-selected={selected}
              data-active={i === active || undefined}
              className="fos-cselect__opt"
              onPointerMove={() => { if (i !== active) setActive(i) }}
              // pointerdown: evita que el botón pierda el foco antes del click.
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
            >
              <Mark code={o.code} size={20} />
              <span className="fos-cselect__label">{o.label}</span>
              {selected && <Check size={16} strokeWidth={1.7} aria-hidden="true" style={{ marginLeft: 'auto', flexShrink: 0 }} />}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
