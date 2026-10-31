// src/components/QuickAdd.jsx
// Captura en un toque: hoja inferior global con monto grande primero, chips de
// las categorías más usadas, y toggle Ingreso/Egreso. Reemplaza el flujo de
// 5 taps (FAB → navegar → Agregar → tipo → formulario de 10 campos).
// El formulario vive en QuickAddForm.jsx (también lo usa el onboarding). En la
// hoja, "Guardar" queda fijo al pie (W3) y aparece "Más detalles" (B4a).
import { useRef, lazy, Suspense } from 'react'
import { useT } from '../i18n/useT.js'
import Sheet from './ui/Sheet.jsx'
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
  return (
    <Sheet open={open} onClose={onClose} ariaLabel={t('qa.title')} initialFocusRef={coarsePointer() ? undefined : amountRef}>
      <Suspense fallback={<div style={{ minHeight: 420 }} aria-busy="true" />}>
        <QuickAddForm defaultType={defaultType} amountRef={amountRef} stickySave allowMoreDetails onSaved={(type) => { onSaved?.(type); onClose?.() }} />
      </Suspense>
    </Sheet>
  )
}
