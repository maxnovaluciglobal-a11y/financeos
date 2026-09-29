// src/components/ui/Sheet.jsx
// Hoja inferior con arrastre — primitiva genérica extraída de QuickAdd.jsx
// (que fue el primer lugar donde se implementó este patrón). En mobile ancla
// abajo y se cierra deslizando hacia abajo (o tocando el backdrop); en
// desktop (>520px) se centra como un modal normal. Reemplaza los diálogos
// centrados de escritorio-en-móvil, que son uno de los tells más notorios de
// "esto es una página, no una app".
import { useRef, useState } from 'react'
import { useDialogA11y } from '../../hooks/useDialogA11y.js'

export default function Sheet({ open, onClose, children, ariaLabel, maxWidth = 460, initialFocusRef }) {
  const sheetRef = useRef(null)
  const [dragY, setDragY] = useState(0)
  const dragState = useRef({ startY: 0, dragging: false })

  useDialogA11y(open, onClose, sheetRef, initialFocusRef)

  function onHandleTouchStart(e) { dragState.current = { startY: e.touches[0].clientY, dragging: true } }
  function onHandleTouchMove(e) {
    if (!dragState.current.dragging) return
    const dy = e.touches[0].clientY - dragState.current.startY
    if (dy > 0) setDragY(dy)
  }
  function onHandleTouchEnd() {
    if (!dragState.current.dragging) return
    dragState.current.dragging = false
    if (dragY > 80) onClose?.()
    setDragY(0)
  }

  if (!open) return null

  const isDesktop = typeof window !== 'undefined' && window.innerWidth > 520

  return (
    <div
      role="dialog" aria-modal="true" aria-label={ariaLabel}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'fosSheetFade .18s ease',
        overscrollBehavior: 'contain',
      }}
    >
      <div
        ref={sheetRef}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth, background: 'var(--sur)',
          borderRadius: isDesktop ? 20 : '20px 20px 0 0',
          marginBottom: isDesktop ? 'auto' : 0, marginTop: isDesktop ? 'auto' : 0,
          padding: `20px 20px calc(20px + env(safe-area-inset-bottom))`, boxShadow: 'var(--sh-3)',
          maxHeight: '85vh', overflowY: 'auto', outline: 'none',
          animation: dragState.current.dragging ? 'none' : 'fosSheetUp .22s cubic-bezier(.22,.61,.36,1)',
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragY ? 'none' : 'transform .2s ease',
        }}
      >
        {/* Asa — arrastrable para cerrar, mismo gesto que un share sheet nativo */}
        <div
          onTouchStart={onHandleTouchStart} onTouchMove={onHandleTouchMove} onTouchEnd={onHandleTouchEnd}
          style={{ width: 38, height: 4, borderRadius: 2, background: 'var(--brd2)', backgroundClip: 'content-box',
            margin: '-20px auto 6px', padding: '20px 40px', touchAction: 'none', boxSizing: 'content-box' }}
        />
        {children}
        <style>{`
          @keyframes fosSheetFade { from { opacity:0 } to { opacity:1 } }
          @keyframes fosSheetUp { from { transform: translateY(14px); opacity:.6 } to { transform: none; opacity:1 } }
          @media (prefers-reduced-motion: reduce) { [role="dialog"] > div { animation: none !important } }
        `}</style>
      </div>
    </div>
  )
}
