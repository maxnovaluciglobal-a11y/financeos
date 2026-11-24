// src/hooks/useBackDismiss.js — un menú o lista desplegable que no usa
// useDialogA11y se cierra con el botón atrás de Android (native/backStack.js).
import { useEffect, useRef } from 'react'
import { pushBackDismiss } from '../native/backStack.js'

export function useBackDismiss(open, onClose) {
  const ref = useRef(onClose)
  ref.current = onClose
  useEffect(() => {
    if (!open) return undefined
    return pushBackDismiss(() => ref.current?.())
  }, [open])
}
