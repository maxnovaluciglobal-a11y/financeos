// src/components/ui/RenewalNote.jsx — aviso de renovación automática junto al
// botón de la prueba de Pro (LEG-N5, auditoría 360 del 19-nov-2026). California
// ARL y ROSCA piden decir antes del pago, de forma visible, que el plan se
// renueva hasta que lo canceles y cómo se cancela. El enlace va a la baja en
// línea de la landing en el idioma del usuario (utils/cancelUrl.js).
import { useT } from '../../i18n/useT.js'
import { cancelUrl } from '../../utils/cancelUrl.js'

export default function RenewalNote({ period }) {
  const { t, lang } = useT()
  return (
    <>
      {t(period === 'monthly' ? 'billing.renewal.monthly' : 'billing.renewal.annual')}{' '}
      <a href={cancelUrl(lang)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
        {t('billing.cancelLink')}
      </a>
    </>
  )
}
