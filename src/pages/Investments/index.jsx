// src/pages/Investments/index.jsx — destino del módulo Inversiones en "Más" y en
// el riel: la misma tarjeta de Panorama, sola. El análisis vive en Invest.
import { PageHeader } from '../../components/ui/index.jsx'
import { useT } from '../../i18n/useT.js'
import InvestCard from '../Panorama/InvestCard.jsx'

export default function Investments() {
  const { t } = useT()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <PageHeader title={t('nav.investments')} sub={t('invest.page.sub')} />
      <InvestCard />
    </div>
  )
}
