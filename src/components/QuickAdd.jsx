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

export default function QuickAdd({ open, defaultType = 'expense', onClose, onSaved }) {
  const { t } = useT()
  const amountRef = useRef(null)
  if (!open) return null
  return (
    <Sheet open={open} onClose={onClose} ariaLabel={t('qa.title')} initialFocusRef={amountRef}>
      <Suspense fallback={<div style={{ minHeight: 420 }} aria-busy="true" />}>
        <QuickAddForm defaultType={defaultType} amountRef={amountRef} stickySave allowMoreDetails onSaved={(type) => { onSaved?.(type); onClose?.() }} />
      </Suspense>
    </Sheet>
  )
}
