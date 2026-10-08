// src/components/QuickAdd.jsx
// Captura en un toque: hoja inferior global con monto grande primero, chips de
// las categorías más usadas, y toggle Ingreso/Egreso. Reemplaza el flujo de
// 5 taps (FAB → navegar → Agregar → tipo → formulario de 10 campos).
// El formulario vive en QuickAddForm.jsx (también lo usa el onboarding).
import { useRef } from 'react'
import { useT } from '../i18n/useT.js'
import Sheet from './ui/Sheet.jsx'
import QuickAddForm from './QuickAddForm.jsx'

export default function QuickAdd({ open, defaultType = 'expense', onClose }) {
  const { t } = useT()
  const amountRef = useRef(null)
  if (!open) return null
  return (
    <Sheet open={open} onClose={onClose} ariaLabel={t('qa.title')} initialFocusRef={amountRef}>
      <QuickAddForm defaultType={defaultType} amountRef={amountRef} onSaved={() => onClose?.()} />
    </Sheet>
  )
}
