// src/components/QuickAdd.jsx
// Captura en un toque: hoja inferior global con monto grande primero, chips de
// las categorías más usadas, y toggle Ingreso/Egreso. Reemplaza el flujo de
// 5 taps (FAB → navegar → Agregar → tipo → formulario de 10 campos).
// El formulario vive en QuickAddForm.jsx (también lo usa el onboarding). En la
// hoja, "Guardar" queda fijo al pie (W3) y aparece "Más detalles" (B4a).
import { useRef, useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { takeIntake } from '../utils/autoEntry.js'
import { closeDecision } from '../utils/quickAdd.js'
import { registroAutomaticoHere } from '../utils/uiFlags.js'
import { openQuickAdd } from './quickAddBus.js'
import { useT } from '../i18n/useT.js'
import Sheet from './ui/Sheet.jsx'
import css from './QuickAddForm.module.css'
// V4 (30-oct-2026): el formulario se carga al abrir la hoja (y se precarga en
// segundo plano con las pestañas, utils/prefetchTabs.js): fuera del JS inicial.
const QuickAddForm = lazy(() => import('./QuickAddForm.jsx'))

// En el teléfono el monto se escribe con el teclado propio: enfocar el campo no
// aporta y iOS puede desplazar la pantalla, con lo que los toques caen más arriba
// de lo que se ve (visto en iPhone real, 31-oct-2026). La hoja recibe el foco.
const coarsePointer = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true

export default function QuickAdd({ open, defaultType = 'expense', onClose, onSaved }) {
  const { t } = useT()
  const amountRef = useRef(null)
  // Alta que llegó por URL (main.jsx la guardó en sessionStorage, quizá antes
  // del login): al montar Shell se abre la hoja con eso escrito. Una sola vez.
  const [prefill, setPrefill] = useState(null)
  useEffect(() => {
    if (!registroAutomaticoHere()) return undefined
    let store = null
    try { store = sessionStorage } catch { store = null }
    const intake = takeIntake(store)
    if (!intake) return undefined
    setPrefill(intake)
    // Shell registra su escucha en su propio efecto (después del de este hijo).
    // Sin limpieza: en StrictMode el segundo montaje ya no encuentra el alta.
    setTimeout(() => openQuickAdd(intake.type), 0)
    return undefined
  }, [])
  // Cerrada por cualquier camino (también "Más detalles" desde Shell): el
  // próximo "+" abre vacío.
  const wasOpen = useRef(false)
  useEffect(() => {
    if (wasOpen.current && !open) setPrefill(null)
    wasOpen.current = open
  }, [open])
  // UX-N9: Esc, tocar el velo o deslizar con un monto escrito primero pregunta
  // (un segundo intento descarta). Guardar cierra directo.
  const dirty = useRef(false)
  const [askDiscard, setAskDiscard] = useState(false)
  const keepRef = useRef(null)
  useEffect(() => { if (!open) { setAskDiscard(false); dirty.current = false } }, [open])
  useEffect(() => { if (askDiscard) keepRef.current?.focus() }, [askDiscard])
  // Estables: Sheet (useDialogA11y) rehace su efecto de foco si onClose cambia,
  // y eso le quitaría el foco a "Seguir editando" al mostrar la pregunta.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const asked = useRef(false)
  asked.current = askDiscard
  const forceClose = useCallback(() => { setAskDiscard(false); setPrefill(null); onCloseRef.current?.() }, [])
  const close = useCallback(() => {
    if (closeDecision({ dirty: dirty.current, asked: asked.current }) === 'ask') { setAskDiscard(true); return }
    forceClose()
  }, [forceClose])
  const keepEditing = () => { setAskDiscard(false); amountRef.current?.focus?.() }
  return (
    <Sheet open={open} onClose={close} ariaLabel={t('qa.title')} initialFocusRef={coarsePointer() ? undefined : amountRef}>
      {askDiscard && (
        <div role="alertdialog" aria-labelledby="qa-discard-text" className={css.discard}>
          <span id="qa-discard-text">{t('qa.discard.text')}</span>
          <div className={css.discardActions}>
            <button ref={keepRef} type="button" className="fos-btn-secondary" onClick={keepEditing}>{t('qa.discard.keep')}</button>
            <button type="button" className={`fos-btn-secondary ${css.discardBtn}`} onClick={forceClose}>{t('qa.discard.confirm')}</button>
          </div>
        </div>
      )}
      <Suspense fallback={<div style={{ minHeight: 420 }} aria-busy="true" />}>
        <QuickAddForm defaultType={defaultType} amountRef={amountRef} stickySave allowMoreDetails
          onDirtyChange={(d) => { dirty.current = d; if (!d) setAskDiscard(false) }}
          onSaved={(type) => { onSaved?.(type); forceClose() }} prefill={open ? prefill : null} />
      </Suspense>
    </Sheet>
  )
}
