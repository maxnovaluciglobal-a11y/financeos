// src/pages/Settings/settingsUi.jsx — piezas compartidas de las subpantallas
// de Ajustes (R10): estilos de fila, interruptor y la hoja de selección que
// reemplaza a los selects nativos de moneda e idioma.
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { ChevronRight, Check } from 'lucide-react'
import Sheet from '../../components/ui/Sheet.jsx'
import { moveIndex, typeaheadIndex, isTypeaheadKey } from '../../components/ui/listboxKeys.js'

export const srow = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderBottom: '0.5px solid var(--brd)' }
export const slbl = { fontSize: 13, fontWeight: 500, color: 'var(--tx)' }
export const ssub = { fontSize: 11, color: 'var(--th)', fontFamily: 'var(--sans)', marginTop: 1 }

// Interruptor de 44×24 (área táctil de 44 de alto con el relleno del botón).
export function Switch({ checked, onChange, label, labelledBy }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      onClick={onChange}
      style={{ background: 'none', border: 'none', padding: '10px 0', minHeight: 44, flexShrink: 0, cursor: 'pointer' }}
    >
      <span aria-hidden="true" style={{
        display: 'block', width: 44, height: 24, borderRadius: 12, position: 'relative',
        background: checked ? 'var(--grn)' : 'var(--brd2)', transition: 'background .2s',
      }}>
        <span style={{
          position: 'absolute', top: 3, left: 3, width: 18, height: 18, borderRadius: '50%', background: '#fff',
          transform: checked ? 'translateX(20px)' : 'translateX(0)', transition: 'transform .2s', display: 'block',
        }} />
      </span>
    </button>
  )
}

// Bloque con nombre para el buscador: data-setting = id del ajuste en
// settingsIndex.js (el salto desde la búsqueda lo encuentra por acá).
export function Setting({ id, children, style }) {
  return <div data-setting={id} style={style}>{children}</div>
}

// Fila que abre una hoja de selección (moneda, idioma). El valor elegido se
// ve en la fila; la hoja es un listbox accesible:
//   ↑ ↓ Inicio Fin RePág AvPág mueven; escribir busca (sin tildes);
//   Enter / Espacio eligen; Esc cierra sin cambiar (useDialogA11y).
// options: [{ value, label }] con `label` ya traducido.
export function OptionSheetRow({ label, sub, value, options, onChange, sheetTitle }) {
  const uid = useId().replace(/:/g, '')
  const [open, setOpen] = useState(false)
  // Estable: useDialogA11y re-ejecuta su efecto (y devuelve el foco) si cambia.
  const close = useCallback(() => setOpen(false), [])
  const current = options.find(o => o.value === value) || options[0]
  const labelId = `osr-${uid}-label`
  return (
    <div style={srow}>
      <div style={{ minWidth: 0 }}>
        <div style={slbl} id={labelId}>{label}</div>
        {sub && <div style={ssub}>{sub}</div>}
      </div>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-labelledby={`${labelId} osr-${uid}-value`}
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, maxWidth: '60%',
          padding: '0 10px', background: 'var(--sur2)', border: '0.5px solid var(--brd2)', borderRadius: 8,
          color: 'var(--tx)', fontSize: 13, fontFamily: 'var(--sans)', cursor: 'pointer', flexShrink: 0,
        }}
      >
        <span id={`osr-${uid}-value`} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current?.label}</span>
        <ChevronRight size={16} strokeWidth={1.7} aria-hidden="true" style={{ color: 'var(--th)', flexShrink: 0 }} />
      </button>
      <OptionSheet
        open={open}
        title={sheetTitle || label}
        value={value}
        options={options}
        onClose={close}
        onChoose={(v) => { setOpen(false); if (v !== value) onChange(v) }}
      />
    </div>
  )
}

export function OptionSheet({ open, title, value, options, onClose, onChoose }) {
  const uid = useId().replace(/:/g, '')
  const listRef = useRef(null)
  const typed = useRef({ buffer: '', timer: null })
  const selectedIndex = Math.max(0, options.findIndex(o => o.value === value))
  const [active, setActive] = useState(selectedIndex)
  const optId = (i) => `os-${uid}-${i}`

  useEffect(() => { if (open) setActive(selectedIndex) }, [open, selectedIndex])
  useEffect(() => () => clearTimeout(typed.current.timer), [])
  // La opción activa siempre a la vista (solo se desplaza la lista).
  useEffect(() => {
    const list = listRef.current
    const el = open && list?.querySelector(`#${optId(active)}`)
    if (!list || !el) return
    if (el.offsetTop < list.scrollTop) list.scrollTop = el.offsetTop
    else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight
    // eslint-disable-next-line react-hooks/exhaustive-deps -- optId depende solo de uid, estable
  }, [open, active])

  function onKeyDown(e) {
    const { key } = e
    switch (key) {
      case 'ArrowDown': case 'ArrowUp': case 'Home': case 'End': case 'PageDown': case 'PageUp':
        e.preventDefault(); setActive(moveIndex(key, active, options.length)); return
      case 'Enter': case ' ':
        e.preventDefault(); onChoose(options[active]?.value); return
      default:
        if (isTypeaheadKey(e)) {
          e.preventDefault()
          const tb = typed.current
          clearTimeout(tb.timer)
          tb.buffer += key
          tb.timer = setTimeout(() => { tb.buffer = '' }, 500)
          const idx = typeaheadIndex(tb.buffer, options.map(o => o.label), active)
          if (idx >= 0) setActive(idx)
        }
    }
  }

  return (
    <Sheet open={open} onClose={onClose} ariaLabel={title} initialFocusRef={listRef}>
      <div id={`os-${uid}-title`} style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx)', marginBottom: 8 }}>{title}</div>
      <ul
        ref={listRef}
        role="listbox"
        tabIndex={0}
        aria-labelledby={`os-${uid}-title`}
        aria-activedescendant={optId(active)}
        onKeyDown={onKeyDown}
        style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: '55vh', overflowY: 'auto', outline: 'none' }}
      >
        {options.map((o, i) => {
          const selected = o.value === value
          return (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events -- listbox option in the aria-activedescendant pattern: keyboard selection is handled by the listbox's onKeyDown
            <li
              key={o.value}
              id={optId(i)}
              role="option"
              aria-selected={selected}
              onPointerMove={() => { if (i !== active) setActive(i) }}
              onClick={() => onChoose(o.value)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, padding: '0 10px',
                borderRadius: 8, cursor: 'pointer', fontSize: 14, color: 'var(--tx)',
                background: i === active ? 'var(--sur2)' : 'transparent',
                fontWeight: selected ? 600 : 400,
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>{o.label}</span>
              {selected && <Check size={18} strokeWidth={1.7} aria-hidden="true" style={{ color: 'var(--tx)', flexShrink: 0 }} />}
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
