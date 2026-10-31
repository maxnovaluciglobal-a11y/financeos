// src/hooks/useEdgeSwipeBack.js — gesto "atrás" desde el borde izquierdo (R14).
// Solo para la PWA instalada en iOS (standalone) y el WKWebView de Capacitor:
// ahí no existe el gesto del sistema. En Safari normal y en Android el gesto
// / botón atrás nativos ya disparan popstate, así que esto se apaga para no
// volver dos veces. Siempre hay un equivalente visible: el "‹" de la barra.
import { useEffect, useRef } from 'react'
import { isEdgeSwipeBack, edgeDragCommits, EDGE_PX } from '../components/layout/edgeSwipe.js'

function needsOwnGesture() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone = navigator.standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches ||
    !!window.Capacitor
  return ios && standalone
}

export function useEdgeSwipeBack({ enabled, onBack }) {
  const cb = useRef(onBack)
  cb.current = onBack
  useEffect(() => {
    if (!enabled || !needsOwnGesture()) return
    let start = null
    let dragging = false
    let last = null
    const root = () => document.querySelector('[data-scroll-root]')
    const paint = (x, animate) => {
      const el = root()
      if (!el) return
      el.style.transition = animate ? 'transform 220ms var(--ease-out)' : 'none'
      el.style.transform = x ? `translate3d(${x}px, 0, 0)` : ''
    }
    const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const onStart = (e) => {
      const t = e.touches[0]
      start = t && e.touches.length === 1 ? { x: t.clientX, y: t.clientY, at: Date.now() } : null
      dragging = false
      last = null
    }
    // La pantalla sigue al dedo (causa 17). No es el gesto del sistema: mueve el
    // contenido, no descubre la pantalla de atrás, que recién se pinta al soltar.
    const onMove = (e) => {
      const t = e.touches[0]
      if (!start || !t || start.x > EDGE_PX || reduce()) return
      const dx = t.clientX - start.x
      if (!dragging && (dx < 12 || Math.abs(t.clientY - start.y) > dx)) return
      dragging = true
      const now = Date.now()
      const v = last ? (t.clientX - last.x) / Math.max(1, now - last.at) : 0
      last = { x: t.clientX, at: now, v }
      paint(Math.max(0, dx))
    }
    const onEnd = (e) => {
      const t = e.changedTouches[0]
      if (!start || !t) return
      const s = start
      start = null
      if (dragging) {
        dragging = false
        const go = edgeDragCommits(t.clientX - s.x, window.innerWidth, last?.v)
        paint(0, !go)
        if (go) cb.current?.()
        return
      }
      if (isEdgeSwipeBack(s, { x: t.clientX, y: t.clientY, at: Date.now() })) cb.current?.()
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
  }, [enabled])
}
