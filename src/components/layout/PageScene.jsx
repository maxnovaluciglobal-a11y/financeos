// src/components/layout/PageScene.jsx — franja morada a sangre detrás del
// título de cada pantalla (pedido de Walter, 20-nov-2026: "el degradado violeta
// en todas las pantallas"). Misma escena que el Inicio (scene.module.css): llega
// hasta la barra de estado en el teléfono y la barra superior va en blanco
// encima mientras se ve. Se apaga con UI_FLAGS.pageScene o ?ui=sin-escena.
import { useRef } from 'react'
import { useSceneChrome } from './useSceneChrome.js'
import s from './pageScene.module.css'

export default function PageScene({ children }) {
  const ref = useRef(null)
  useSceneChrome(ref)
  return (
    <section ref={ref} className={s.scene}>
      <div className={s.inner}>{children}</div>
    </section>
  )
}
