// src/components/ui/SwipeRow.jsx — deslizar una fila para ver sus acciones (causa
// 18). Es un atajo táctil, no la única entrada: toda acción tiene un equivalente
// visible (la fila abre su detalle, o trae sus botones). Por eso las acciones no
// existen en el DOM hasta que el dedo las revela: el teclado y el lector de
// pantalla siguen por la vía visible. El borde izquierdo queda libre para el
// gesto "atrás" (swipeRow.js).
import { useCallback, useEffect, useRef, useState } from 'react'
import { ACTION_W, SLOP_PX, canStart, clampOffset, intent, settlesOpen } from './swipeRow.js'
import s from './swipeRow.module.css'

let closeOpenRow = null   // una sola fila abierta a la vez

export default function SwipeRow({ actions, children }) {
  const fgRef = useRef(null)
  const rootRef = useRef(null)
  const g = useRef(null)
  const offset = useRef(0)
  const suppressClick = useRef(false)
  const [revealed, setRevealed] = useState(false)
  const width = (actions?.length || 0) * ACTION_W

  const move = useCallback((x, animate) => {
    offset.current = x
    const el = fgRef.current
    if (!el) return
    el.style.transition = animate ? 'transform var(--dur-spring) var(--ease-spring)' : 'none'
    el.style.transform = x ? `translate3d(${x}px, 0, 0)` : ''
  }, [])
  const close = useCallback(() => {
    move(0, true)
    if (closeOpenRow === close) closeOpenRow = null
  }, [move])

  useEffect(() => () => { if (closeOpenRow === close) closeOpenRow = null }, [close])

  // Con la fila abierta, tocar afuera la cierra; el scroll de la página también.
  useEffect(() => {
    if (!revealed) return undefined
    const onDown = (e) => { if (!rootRef.current?.contains(e.target)) close() }
    document.addEventListener('touchstart', onDown, { passive: true })
    return () => document.removeEventListener('touchstart', onDown)
  }, [revealed, close])

  const onTransitionEnd = () => { if (offset.current === 0) setRevealed(false) }

  const onTouchStart = (e) => {
    if (e.touches.length !== 1 || !width) { g.current = null; return }
    const t = e.touches[0]
    if (!canStart(t.clientX)) { g.current = null; return }
    if (closeOpenRow && closeOpenRow !== close) closeOpenRow()
    g.current = { x: t.clientX, y: t.clientY, from: offset.current, dir: null, lastX: t.clientX, lastT: e.timeStamp, v: 0 }
  }
  const onTouchMove = (e) => {
    const st = g.current
    if (!st || st.dir === 'y') return
    const t = e.touches[0]
    const dx = t.clientX - st.x
    if (!st.dir) {
      st.dir = intent(dx, t.clientY - st.y)
      if (st.dir !== 'x') return
      st.x = t.clientX - Math.sign(dx) * SLOP_PX
      setRevealed(true)
    }
    const dt = e.timeStamp - st.lastT
    if (dt > 0) st.v = (t.clientX - st.lastX) / dt
    st.lastX = t.clientX
    st.lastT = e.timeStamp
    move(clampOffset(st.from + (t.clientX - st.x), width))
  }
  const onTouchEnd = () => {
    const st = g.current
    g.current = null
    if (!st || st.dir !== 'x') return
    if (settlesOpen(offset.current, st.v, width)) {
      move(-width, true)
      closeOpenRow = close
    } else close()
    suppressClick.current = true
    setTimeout(() => { suppressClick.current = false }, 350)
  }
  // Soltar después de deslizar no es tocar; y con la fila abierta, tocarla la cierra.
  const onClickCapture = (e) => {
    if (suppressClick.current || (offset.current !== 0 && fgRef.current?.contains(e.target))) {
      e.preventDefault()
      e.stopPropagation()
      if (!suppressClick.current) close()
    }
  }

  if (!width) return children
  return (
    <div ref={rootRef} className={s.root} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd} onClickCapture={onClickCapture}>
      {revealed && (
        <div className={s.actions} style={{ width }}>
          {actions.map(a => {
            const Ic = a.icon
            return (
              <button key={a.key} type="button" className={`${s.action} ${a.danger ? s.danger : ''}`} tabIndex={-1}
                onClick={() => { close(); a.onClick() }}>
                <Ic size={18} strokeWidth={1.8} aria-hidden="true" />
                <span>{a.label}</span>
              </button>
            )
          })}
        </div>
      )}
      <div ref={fgRef} className={s.fg} onTransitionEnd={onTransitionEnd}>{children}</div>
    </div>
  )
}
