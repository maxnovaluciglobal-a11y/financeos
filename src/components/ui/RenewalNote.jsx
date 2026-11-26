// src/components/ui/RenewalNote.jsx — aviso de renovación automática junto al
// botón de compra de Pro (LEG-N5, auditoría 360 del 19-nov-2026). California
// ARL y ROSCA piden decir antes del pago, de forma visible, que el plan se
// renueva hasta que lo canceles y cómo se cancela. El enlace va a la baja en
// línea de la landing en el idioma del usuario (utils/cancelUrl.js).
// Desde el modelo A (26-nov-2026) la compra no trae prueba (la prueba de 14 días
// es sin tarjeta y no se renueva): el texto es el del periodo elegido. Con
// trial=false (sin periodo elegido) dice que los planes de pago se renuevan solos.
import { useT } from '../../i18n/useT.js'
import { cancelUrl } from '../../utils/cancelUrl.js'

export default function RenewalNote({ period, trial = true }) {
  const { t, lang } = useT()
  return (
    <>
      {t(!trial ? 'billing.renewal.noTrial' : period === 'monthly' ? 'billing.renewal.monthly' : 'billing.renewal.annual')}{' '}
      <a href={cancelUrl(lang)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
        {t('billing.cancelLink')}
      </a>
    </>
  )
}
