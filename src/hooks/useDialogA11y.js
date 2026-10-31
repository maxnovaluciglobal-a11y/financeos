// src/hooks/useDialogA11y.js
// Accesibilidad de diálogo compartida: Esc para cerrar, focus-trap con Tab/Shift+Tab,
// foco inicial y retorno de foco al disparador al cerrar. Extraído del patrón de QuickAdd.jsx
// para reusarlo en MonthlyCloseModal, el drawer de Shell y TemplateSelector.
// Con diálogos apilados (una lista dentro de un formulario en hoja) solo responde
// el de más arriba: Esc cierra uno por vez.
import { useEffect, useRef } from 'react'

const stack = []

export function useDialogA11y(open, onClose, containerRef, focusRef) {
  const token = useRef({})
  useEffect(() => {
    if (!open) return
    const me = token.current
    stack.push(me)
    const trigger = document.activeElement
    const id = setTimeout(() => (focusRef?.current || containerRef?.current)?.focus(), 60)

    const onKey = (e) => {
      if (stack[stack.length - 1] !== me) return
      if (e.key === 'Escape') { e.preventDefault(); onClose?.(); return }
      if (e.key === 'Tab' && containerRef?.current) {
        const els = [...containerRef.current.querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')]
          .filter(el => !el.disabled && el.offsetParent !== null)
        if (!els.length) return
        const first = els[0], last = els[els.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(id)
      document.removeEventListener('keydown', onKey)
      const i = stack.indexOf(me)
      if (i >= 0) stack.splice(i, 1)
      if (trigger && typeof trigger.focus === 'function') trigger.focus()
    }
  }, [open, onClose, containerRef, focusRef])
}
