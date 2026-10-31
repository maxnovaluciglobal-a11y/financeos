// src/components/layout/viewTransition.js — View Transitions sin sorpresas.
// `update` corre sincrónico (flushSync): sin esto la captura "nueva" podía salir
// antes de que React pintara. Navegar rápido aborta la transición en curso y el
// navegador rechaza sus promesas con "InvalidStateError: Transition was
// aborted": es esperado, así que se atrapa. Sin soporte (Firefox, Safari < 18),
// con movimiento reducido o en segundo plano, cambia directo.
import { flushSync } from 'react-dom'

let current = null
const ignore = () => {}

export function runViewTransition(update) {
  const doc = typeof document !== 'undefined' ? document : null
  const skip = !doc?.startViewTransition || doc.visibilityState === 'hidden' ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (skip) { update(); return }
  let vt
  try {
    current?.skipTransition?.()
    vt = doc.startViewTransition(() => { flushSync(update) })
  } catch {
    update()
    return
  }
  current = vt
  vt.ready?.catch(ignore)
  vt.updateCallbackDone?.catch(ignore)
  vt.finished?.catch(ignore).finally?.(() => { if (current === vt) current = null })
}
