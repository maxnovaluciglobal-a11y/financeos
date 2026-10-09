// src/hooks/useEdgeSwipeBack.js — gesto "atrás" desde el borde izquierdo (R14).
// Solo para la PWA instalada en iOS (standalone) y el WKWebView de Capacitor:
// ahí no existe el gesto del sistema. En Safari normal y en Android el gesto
// / botón atrás nativos ya disparan popstate, así que esto se apaga para no
// volver dos veces. Siempre hay un equivalente visible: el "‹" de la barra.
import { useEffect, useRef } from 'react'
import { isEdgeSwipeBack } from '../components/layout/edgeSwipe.js'

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
    const onStart = (e) => {
      const t = e.touches[0]
      start = t && e.touches.length === 1 ? { x: t.clientX, y: t.clientY, at: Date.now() } : null
    }
    const onEnd = (e) => {
      const t = e.changedTouches[0]
      if (!start || !t) return
      const s = start
      start = null
      if (isEdgeSwipeBack(s, { x: t.clientX, y: t.clientY, at: Date.now() })) cb.current?.()
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchend', onEnd)
    }
  }, [enabled])
}
