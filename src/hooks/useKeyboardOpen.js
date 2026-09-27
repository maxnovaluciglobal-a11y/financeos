// src/hooks/useKeyboardOpen.js
//
// Detecta si el teclado virtual está abierto en móvil comparando el alto del
// visualViewport contra el de window. Sin esto, elementos fixed (tabbar, FAB)
// quedan flotando sobre el teclado o lo tapan — el patrón estándar en iOS/Android
// es ocultarlos mientras se escribe. Umbral de 120px evita falsos positivos por
// la barra de direcciones de Safari que se esconde al hacer scroll.
import { useEffect, useState } from 'react'

export function useKeyboardOpen() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    function check() {
      const gap = window.innerHeight - vv.height
      setOpen(gap > 120)
    }

    vv.addEventListener('resize', check)
    check()
    return () => vv.removeEventListener('resize', check)
  }, [])

  return open
}
