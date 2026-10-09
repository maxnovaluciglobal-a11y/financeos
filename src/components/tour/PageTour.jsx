// src/components/tour/PageTour.jsx — recorrido por pantalla (R08).
// La primera visita a Inicio, Movimientos o Presupuestos lo lanza solo; después
// se repite con el "?" de la barra superior (PageTourButton). El "visto" es del
// dispositivo (pageTours.js). Si al llegar ya hay una hoja/diálogo abierto (la
// hoja de inicio de mes, por ejemplo), no se superpone: se deja para la próxima.
import { useEffect, useState, useCallback } from 'react'
import { CircleHelp } from 'lucide-react'
import Tour from './Tour.jsx'
import { PAGE_TOURS, hasTour, readSeen, markSeen, shouldAutoStartTour } from './pageTours.js'

export function usePageTour(page, { isDemo = false } = {}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
    if (!shouldAutoStartTour({ page, seen: readSeen(), isDemo })) return
    const id = setTimeout(() => {
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      setOpen(true)
    }, 700)
    return () => clearTimeout(id)
  }, [page, isDemo])

  const close = useCallback(() => { markSeen(page); setOpen(false) }, [page])
  const replay = useCallback(() => { setOpen(false); setTimeout(() => setOpen(true), 0) }, [])

  return { open, close, replay, available: hasTour(page) }
}

export default function PageTour({ page, open, onClose }) {
  if (!hasTour(page)) return null
  return <Tour key={page} open={open} steps={PAGE_TOURS[page]} onClose={onClose} />
}

export function PageTourButton({ onClick, label, className }) {
  return (
    <button type="button" className={className} onClick={onClick} aria-label={label} title={label}>
      <CircleHelp size={18} strokeWidth={1.7} aria-hidden="true" />
    </button>
  )
}
