// src/hooks/useDialogA11y.js
// Accesibilidad de diálogo compartida: Esc para cerrar, focus-trap con Tab/Shift+Tab,
// foco inicial y retorno de foco al disparador al cerrar. Extraído del patrón de QuickAdd.jsx
// para reusarlo en MonthlyCloseModal, el drawer de Shell y TemplateSelector.
import { useEffect } from 'react'

export function useDialogA11y(open, onClose, containerRef, focusRef) {
  useEffect(() => {
    if (!open) return
    const trigger = document.activeElement
    const id = setTimeout(() => (focusRef?.current || containerRef?.current)?.focus(), 60)

    const onKey = (e) => {
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
      if (trigger && typeof trigger.focus === 'function') trigger.focus()
    }
  }, [open, onClose, containerRef, focusRef])
}
