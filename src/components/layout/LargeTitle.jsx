// src/components/layout/LargeTitle.jsx
// Título de página con su versión compacta en la barra superior — la señal nº 1
// de "app nativa" (vs. un título estático de escritorio). Se apoya en PageHeader
// (ui/index.jsx) así que las páginas que ya lo usan lo reciben sin tocarlas.
//
// Un solo bloque en el flujo (causa 7): antes la barra compacta y el sentinel
// eran hermanos del título, y el `gap` de cada página los empujaba distinto (Y =
// 69, 77 o 79). La copia compacta va por portal a #nav-title (Shell.jsx), donde
// el CSS la liga al scroll (animation-timeline). El sentinel queda de respaldo
// para los navegadores sin esa función.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './largeTitle.module.css'

const COMPACT_ATTR = 'titleCompact'

export default function LargeTitle({ title, sub }) {
  const sentinelRef = useRef(null)
  const [slot, setSlot] = useState(null)

  useEffect(() => {
    setSlot(document.getElementById('nav-title'))
    const root = document.documentElement
    const el = sentinelRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(([entry]) => {
      root.dataset[COMPACT_ATTR] = entry.isIntersecting ? '0' : '1'
    }, { threshold: 0, rootMargin: '-52px 0px 0px 0px' })
    io.observe(el)
    return () => { io.disconnect(); delete root.dataset[COMPACT_ATTR] }
  }, [])

  return (
    <div className={styles.pageHeader}>
      {slot && createPortal(title, slot)}
      <h1>{title}</h1>
      {sub && <p>{sub}</p>}
      <div ref={sentinelRef} className={styles.sentinel} />
    </div>
  )
}
