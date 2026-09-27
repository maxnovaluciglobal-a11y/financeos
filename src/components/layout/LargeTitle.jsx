// src/components/layout/LargeTitle.jsx
// Título de página con barra compacta que aparece al hacer scroll — la señal
// nº 1 de "app nativa" en iOS/Android (vs. un título estático de escritorio).
// Se apoya en PageHeader (ui/index.jsx) así que las 26 páginas que ya lo usan
// lo reciben sin tocarlas una por una.
import { useEffect, useRef, useState } from 'react'
import styles from './largeTitle.module.css'

export default function LargeTitle({ title, sub }) {
  const sentinelRef = useRef(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    // El sentinel vive justo debajo del h1 — cuando sale del viewport (scrolleado
    // hacia arriba, fuera del área visible), el título grande ya no se ve.
    const io = new IntersectionObserver(([entry]) => setCollapsed(!entry.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <>
      <div className={styles.compactBar + (collapsed ? ' ' + styles.compactBarVisible : '')} aria-hidden={!collapsed}>
        {title}
      </div>
      <div className={styles.pageHeader}>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      <div ref={sentinelRef} style={{ height: 1 }} />
    </>
  )
}
