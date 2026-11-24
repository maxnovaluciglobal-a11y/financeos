// src/components/tour/PageTour.jsx — recorrido por pantalla (R08).
// La primera visita a Inicio, Movimientos o Presupuestos lo lanza solo; después
// se repite con el "?" de la barra superior (PageTourButton) o, donde esa barra
// no está (el Inicio del teléfono, Inicio v2), con requestTourReplay(page):
// "Ver el recorrido del Inicio" en Más y en la hoja de "Pregúntale a moyiq". El "visto" es del
// dispositivo (pageTours.js). Si al llegar ya hay una hoja/diálogo abierto (la
// hoja de inicio de mes, por ejemplo) o la página muestra una primera entrada
// guiada, no se superpone: se deja para la próxima.
import { useEffect, useState, useCallback } from 'react'
import { CircleHelp } from 'lucide-react'
import Tour from './Tour.jsx'
import { PAGE_TOURS, hasTour, readSeen, markSeen, shouldAutoStartTour } from './pageTours.js'

export const TOUR_REPLAY_EVENT = 'fos:tour-replay'
export const TOUR_REPLAY_KEY = 'fos_tour_replay'
const sess = () => { try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null } catch { return null } }

/** Pide el recorrido de `page`: si ya se está ahí arranca ahora; si no, al llegar. */
export function requestTourReplay(page, storage = sess()) {
  try { storage?.setItem(TOUR_REPLAY_KEY, page) } catch { /* modo privado: solo vale el evento */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(TOUR_REPLAY_EVENT, { detail: { page } }))
}

/** ¿Hay un recorrido pedido para `page`? Lo consume (una sola vez). Pura. */
export function takeTourReplay(page, storage = sess()) {
  try {
    if (storage?.getItem(TOUR_REPLAY_KEY) !== page) return false
    storage.removeItem(TOUR_REPLAY_KEY)
    return true
  } catch { return false }
}

export function usePageTour(page, { isDemo = false } = {}) {
  const [open, setOpen] = useState(false)

  // Recorrido pedido desde otra pantalla (Más → "Ver el recorrido del Inicio")
  // o desde la misma (hoja del asistente).
  useEffect(() => {
    const start = () => setTimeout(() => setOpen(true), 400)
    let id = null
    if (hasTour(page) && takeTourReplay(page)) id = start()
    const onReq = (e) => { if (e.detail?.page === page && takeTourReplay(page)) { setOpen(false); id = start() } }
    window.addEventListener(TOUR_REPLAY_EVENT, onReq)
    return () => { window.removeEventListener(TOUR_REPLAY_EVENT, onReq); if (id) clearTimeout(id) }
  }, [page])

  useEffect(() => {
    setOpen(false)
    if (!shouldAutoStartTour({ page, seen: readSeen(), isDemo })) return
    const id = setTimeout(() => {
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      // Página vacía con primera entrada guiada (Presupuestos): el recorrido
      // explicaría cifras en cero y taparía la pregunta. Sin marcar "visto":
      // arranca la próxima visita, cuando ya hay datos.
      if (document.querySelector('[data-empty-guided]')) return
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
