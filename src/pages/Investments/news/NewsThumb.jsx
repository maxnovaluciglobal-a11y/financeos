// Miniatura de una noticia (Mercado y ficha del activo), como en Invest v1:
// a la derecha del titular, tamaño fijo (sin saltos de diseño), decorativa
// (alt="": el enlace es el título). `src` ya viene validado por
// safeNewsImage (https + CDN permitido por la CSP). Si la imagen falla, no se
// pinta nada y la fila queda como una noticia sin foto.
import { useState } from 'react'
import s from './newsThumb.module.css'

export default function NewsThumb({ src }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return null
  return (
    <img className={s.thumb} src={src} alt="" width={72} height={54}
      loading="lazy" decoding="async" referrerPolicy="no-referrer"
      onError={() => setFailed(true)} />
  )
}
