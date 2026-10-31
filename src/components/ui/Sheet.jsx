// src/components/ui/Sheet.jsx
// Hoja inferior — primitiva genérica. En el teléfono ancla abajo, entra y sale
// con resorte (CSS linear(), token --ease-spring), se arrastra desde cualquier
// punto del contenido y no solo desde el asa, usa la velocidad al soltar y
// tiene dos alturas si el contenido las justifica. Desde 521 px es un diálogo
// centrado. Sin "se ve a web": ni el corte seco al cerrar ni el modal de
// escritorio en el celular.
//
// API de siempre: open, onClose, ariaLabel, maxWidth, initialFocusRef. Nuevo:
// initialDetent ('full' por defecto, para que un formulario abra entero;
// 'medium' en listas largas). data-sheet-nodrag en un hijo lo excluye del gesto.
// Los hijos se conservan durante la salida: el padre puede poner open=false y
// vaciar su estado sin que la hoja colapse mientras baja.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDialogA11y } from '../../hooks/useDialogA11y.js'
import { SLOP_PX, detentOffsets, rubberBand, settle, springMs, velocityOf, SPRING_MS } from './sheetPhysics.js'
import s from './sheet.module.css'

const EXIT_MS = 240
const SPRING = 'var(--ease-spring)'
const EXIT_EASE = 'var(--ease)'

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// El gesto no le pertenece a la hoja si empieza en un control que ya usa el
// arrastre o en un scroll interno que todavía puede subir.
function gestureBlocked(target, sheet, dy) {
  for (let el = target; el && el !== sheet; el = el.parentElement) {
    if (el.matches?.('input[type="range"], textarea, [data-sheet-nodrag]')) return true
    if (el.dataset?.sheetBody !== undefined) break
    const oy = getComputedStyle(el).overflowY
    if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1 && (dy < 0 || el.scrollTop > 0)) return true
  }
  return false
}

export default function Sheet({ open, onClose, children, ariaLabel, maxWidth = 460, initialFocusRef, initialDetent = 'full' }) {
  const sheetRef = useRef(null)
  const bodyRef = useRef(null)
  const scrimRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const openRef = useRef(open)
  openRef.current = open

  // Sigue montada mientras sale. Patrón de "estado derivado" de React: se ajusta
  // durante el render, sin un efecto que pinte un cuadro de más.
  const [shown, setShown] = useState(open)
  if (open && !shown) setShown(true)
  const closing = shown && !open
  const kept = useRef(children)
  if (open) kept.current = children

  const gesture = useRef(null)
  const pos = useRef({ y: 0, offsets: [0], height: 0, detent: 0, exitMs: EXIT_MS, entered: false })

  useDialogA11y(open, onClose, sheetRef, initialFocusRef)

  const isDesktop = typeof window !== 'undefined' && window.innerWidth > 520

  const place = useCallback((y, ms = 0, ease = SPRING) => {
    const el = sheetRef.current
    if (!el) return
    pos.current.y = y
    const instant = !ms || reducedMotion()
    el.style.transition = instant ? 'none' : `transform ${ms}ms ${ease}`
    el.style.transform = `translate3d(0, ${y}px, 0)`
    const scrim = scrimRef.current
    if (scrim) {
      const h = pos.current.height || 1
      const low = pos.current.offsets[pos.current.offsets.length - 1] || 0
      // El velo se aclara al bajar por debajo de la última altura, no antes.
      const k = y <= low ? 1 : Math.max(0, 1 - (y - low) / Math.max(1, h - low))
      scrim.style.transition = instant ? 'none' : `opacity ${ms}ms ${EXIT_EASE}`
      scrim.style.opacity = String(k)
    }
  }, [])

  const setDetent = useCallback((i) => {
    const p = pos.current
    p.detent = i
    if (sheetRef.current) sheetRef.current.dataset.detent = i > 0 ? 'medium' : 'full'
  }, [])

  const measure = useCallback(() => {
    const el = sheetRef.current
    if (!el) return
    const p = pos.current
    p.height = el.offsetHeight
    p.offsets = detentOffsets(p.height, window.innerHeight)
    if (p.detent >= p.offsets.length) setDetent(0)
  }, [setDetent])

  // Entrada (y reentrada, si el padre vuelve a abrir mientras bajaba).
  useLayoutEffect(() => {
    if (!open || isDesktop) return
    const p = pos.current
    measure()
    if (!p.entered) {
      p.entered = true
      setDetent(initialDetent === 'medium' && p.offsets.length > 1 ? 1 : 0)
      place(p.height + 40)
      void sheetRef.current?.offsetHeight   // fija el punto de partida antes de animar
    }
    place(p.offsets[p.detent] ?? 0, SPRING_MS)
  }, [open, isDesktop, measure, place, setDetent, initialDetent])

  // Salida: baja, y recién entonces se desmonta.
  useEffect(() => {
    if (!closing) return undefined
    const p = pos.current
    if (!isDesktop) place(p.height + 40, p.exitMs, EXIT_EASE)
    const ms = reducedMotion() ? 0 : isDesktop ? 150 : p.exitMs
    const id = setTimeout(() => { p.entered = false; p.exitMs = EXIT_MS; setShown(false) }, ms + 40)
    return () => clearTimeout(id)
  }, [closing, isDesktop, place])

  // El contenido cambia de alto (formulario lazy, un error, un campo más).
  useEffect(() => {
    if (!shown || isDesktop || typeof ResizeObserver === 'undefined') return undefined
    const el = sheetRef.current
    if (!el) return undefined
    const ro = new ResizeObserver(() => {
      if (!openRef.current || gesture.current?.mode === 'drag') return
      measure()
      place(pos.current.offsets[pos.current.detent] ?? 0, pos.current.y ? 200 : 0)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [shown, isDesktop, measure, place])

  // ── Gesto ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!shown || isDesktop) return undefined
    const el = sheetRef.current
    if (!el) return undefined

    const onStart = (e) => {
      if (e.touches.length !== 1) { gesture.current = null; return }
      const t = e.touches[0]
      gesture.current = { x: t.clientX, y: t.clientY, from: pos.current.y, mode: null, target: e.target, samples: [{ t: e.timeStamp, y: t.clientY }] }
    }
    const onMove = (e) => {
      const g = gesture.current
      if (!g || g.mode === 'off') return
      const t = e.touches[0]
      const dx = t.clientX - g.x
      const dy = t.clientY - g.y
      if (!g.mode) {
        if (Math.abs(dx) < SLOP_PX && Math.abs(dy) < SLOP_PX) return
        const body = bodyRef.current
        const onGrip = !body?.contains(g.target)
        const atMedium = pos.current.detent > 0
        const canTake = onGrip || (dy > 0 && (body?.scrollTop ?? 0) <= 0) || (dy < 0 && atMedium)
        if (Math.abs(dx) > Math.abs(dy) || !canTake || !e.cancelable || (!onGrip && gestureBlocked(g.target, el, dy))) {
          g.mode = 'off'
          return
        }
        g.mode = 'drag'
        g.y = t.clientY
      }
      e.preventDefault()
      g.samples.push({ t: e.timeStamp, y: t.clientY })
      if (g.samples.length > 8) g.samples.shift()
      place(rubberBand(g.from + (t.clientY - g.y)))
    }
    const onEnd = () => {
      const g = gesture.current
      gesture.current = null
      if (!g || g.mode !== 'drag') return
      const p = pos.current
      const velocity = velocityOf(g.samples)
      const to = settle({ offset: p.y, velocity, offsets: p.offsets, height: p.height })
      if (to === 'close') {
        p.exitMs = Math.min(EXIT_MS, springMs(p.height - p.y, velocity))
        onCloseRef.current?.()
        // Un padre que decide no cerrar: la hoja vuelve a su lugar.
        setTimeout(() => { if (openRef.current) place(p.offsets[p.detent] ?? 0, SPRING_MS) }, 80)
        return
      }
      const i = p.offsets.indexOf(to)
      setDetent(i < 0 ? 0 : i)
      place(to, springMs(to - p.y, velocity))
    }
    // Enfocar un campo o girar la rueda a media altura necesita la hoja entera.
    const expand = () => {
      const p = pos.current
      if (p.detent === 0) return
      setDetent(0)
      place(0, SPRING_MS)
    }
    const onFocusIn = (e) => { if (e.target.matches?.('input, textarea, select')) expand() }
    const onWheel = (e) => { if (e.deltaY > 0) expand() }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onEnd, { passive: true })
    el.addEventListener('focusin', onFocusIn)
    el.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
      el.removeEventListener('focusin', onFocusIn)
      el.removeEventListener('wheel', onWheel)
    }
  }, [shown, isDesktop, place, setDetent])

  if (!shown) return null

  const node = (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop click-to-close is a mouse shortcut; Escape already closes the sheet via useDialogA11y
    <div
      role="dialog" aria-modal="true" aria-label={ariaLabel}
      className={[s.root, isDesktop ? s.desktop : '', closing ? s.closing : ''].filter(Boolean).join(' ')}
      onClick={(e) => { e.stopPropagation(); onClose?.() }}
    >
      <div ref={scrimRef} className={s.scrim} />
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- only stops clicks inside the sheet from reaching the backdrop; not a control */}
      <div ref={sheetRef} className={s.sheet} tabIndex={-1} data-detent="full" style={{ maxWidth }} onClick={(e) => e.stopPropagation()}>
        <div className={s.grip}><span className={s.gripBar} /></div>
        <div ref={bodyRef} className={s.body} data-sheet-body="">
          {open ? children : kept.current}
        </div>
      </div>
    </div>
  )
  // En #root: una hoja dentro de otra no queda atrapada en su transform, y el
  // velo del bloqueo (.fos-lock-veil #root) también la cubre.
  const host = typeof document !== 'undefined' ? document.getElementById('root') : null
  return host ? createPortal(node, host) : node
}
