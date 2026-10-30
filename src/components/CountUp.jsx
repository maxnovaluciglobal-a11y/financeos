// src/components/CountUp.jsx
// Cifra que se anima cuando CAMBIA su valor. Tasteful, no decorativo:
// úsalo solo en cifras hero (KPIs, score, patrimonio), no en tablas densas.
// H21 (ola A4, 30-oct-2026): al montar muestra el valor final (antes contaba
// desde 0 cada vez que se volvía a la pestaña, y una captura o un lector de
// pantalla podían leer "Bs.0,00" o una cifra a medio camino). Cuando el valor
// cambia, anima desde el valor anterior hasta el nuevo.
// Respeta prefers-reduced-motion: sin barrido, la cifra nueva aparece con un
// fade de 200ms (ver tabla de motion en CLAUDE.md § Sistema visual).

import { useState, useRef, useEffect } from 'react'

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Valor intermedio de la animación (puro, testeado en countUp.test.js).
export function countUpFrame(from, to, p, overshoot = false) {
  const t = Math.min(Math.max(p, 0), 1)
  let eased
  if (overshoot) {
    // Resorte simple: pasa ~3 % del salto y asienta.
    eased = t < 0.75
      ? (1 - Math.pow(1 - t / 0.75, 3)) * 1.03
      : 1.03 - (t - 0.75) / 0.25 * 0.03
  } else {
    eased = 1 - Math.pow(1 - t, 3)   // easeOutCubic
  }
  return t >= 1 ? to : from + (to - from) * eased
}

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
  const [n, setN] = useState(target)
  const [visible, setVisible] = useState(true)
  const raf = useRef()
  const shown = useRef(target)             // última cifra dibujada (desde ahí anima)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) { first.current = false; shown.current = target; setN(target); return }
    if (reduce) {
      shown.current = target
      setN(target)
      // Único movimiento permitido en reduced-motion: fade de 200ms, sin barrido.
      setVisible(false)
      const id = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(id)
    }
    const from = shown.current
    if (from === target) return
    const start = performance.now()
    const tick = (t) => {
      const p = (t - start) / duration
      const v = countUpFrame(from, target, p, overshoot)
      shown.current = v
      setN(v)
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration, reduce, overshoot])

  return (
    <span className={className} style={{ transition: reduce ? 'opacity 200ms ease' : undefined, opacity: visible ? 1 : 0, ...style }}>
      {format(n)}
    </span>
  )
}
