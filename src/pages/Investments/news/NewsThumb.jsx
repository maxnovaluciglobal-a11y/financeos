// Miniatura de una noticia (Mercado y ficha del activo), como en Invest v1:
// a la derecha del titular, tamaño fijo (sin saltos de diseño), decorativa
// (alt="": el enlace es el título). `url` es la imagen original de la noticia:
// se valida con la lista de hosts y se sirve por el proxy propio
// (invest.moyiq.app/api/img), nunca directo desde el CDN. Si la imagen falla,
// no se pinta nada y la fila queda como una noticia sin foto.
import { useState } from 'react'
import { newsImageSrc } from '../../../utils/investMarket.js'
import s from './newsThumb.module.css'

export default function NewsThumb({ url }) {
  const [failed, setFailed] = useState(false)
  const src = newsImageSrc(url)
  if (!src || failed) return null
  return (
    <img className={s.thumb} src={src} alt="" width={72} height={54}
      loading="lazy" decoding="async" referrerPolicy="no-referrer"
      onError={() => setFailed(true)} />
  )
}
