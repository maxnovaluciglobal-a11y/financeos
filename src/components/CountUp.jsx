// src/components/CountUp.jsx
// Número que "cuenta" de 0 al valor final al montar. Tasteful, no decorativo:
// úsalo solo en cifras hero (KPIs, score, patrimonio), no en tablas densas.
// Respeta prefers-reduced-motion: sin overshoot, la cifra aparece con un fade
// de 200ms en vez de contar (ver tabla de motion en CLAUDE.md § Sistema visual).

import { useState, useRef, useEffect } from 'react'

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function CountUp({
  value,                                   // número destino
  format = (n) => Math.round(n).toLocaleString(),
  duration = 650,
  overshoot = false,                       // "instrument-settle": resorte con overshoot 2-3% antes de asentar
  className,
  style,
}) {
  const target = Number(value) || 0
  const reduce = prefersReduced()
  const [n, setN] = useState(reduce ? target : 0)
  const [visible, setVisible] = useState(!reduce)
  const raf = useRef()

  useEffect(() => {
    if (reduce) {
      setN(target)
      // Único movimiento permitido en reduced-motion: fade de 200ms, sin barrido.
      setVisible(false)
      const id = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(id)
    }
    const start = performance.now()
    const tick = (t) => {
      const p = Math.min((t - start) / duration, 1)
      let eased
      if (overshoot) {
        // Resorte simple: acelera hasta ~103% del valor y asienta — evita que la
        // cifra "vuelva a cero" antes de moverse (ver token value-update).
        eased = p < 0.75
          ? (1 - Math.pow(1 - p / 0.75, 3)) * 1.03
          : 1.03 - (p - 0.75) / 0.25 * 0.03
      } else {
        eased = 1 - Math.pow(1 - p, 3)   // easeOutCubic
      }
      setN(target * eased)
      if (p < 1) raf.current = requestAnimationFrame(tick)
      else setN(target)                       // exactitud al cerrar
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
    // Re-anima solo cuando cambia el valor destino
  }, [target, duration, reduce, overshoot])

  return (
    <span className={className} style={{ transition: reduce ? 'opacity 200ms ease' : undefined, opacity: reduce ? (visible ? 1 : 0) : 1, ...style }}>
      {format(n)}
    </span>
  )
}
