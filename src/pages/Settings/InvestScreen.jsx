// src/pages/Settings/InvestScreen.jsx — Ajustes › Inversiones (F7). Solo
// monta la pantalla real con lazy(): vive en el chunk de Inversiones
// (pages/Investments/settings/InvestSettings.jsx) con sus textos diferidos.
// Los bloques llevan data-setting para el buscador: invProfile, invRule,
// invAlerts, invData, invDelete, invHelp (settingsIndex.js).
import { Suspense, lazy } from 'react'
import { useT } from '../../i18n/useT.js'
import { ssub } from './settingsUi.jsx'

const InvestSettings = lazy(() => import('../Investments/settings/InvestSettings.jsx'))

export default function InvestScreen({ setPage, isDemo, onOpenFeatures }) {
  const { t } = useT()
  return (
    <Suspense fallback={<p role="status" style={{ ...ssub, margin: '12px 0' }}>{t('settings.inv.loading')}</p>}>
      <InvestSettings setPage={setPage} isDemo={isDemo} onOpenFeatures={onOpenFeatures} />
    </Suspense>
  )
}
