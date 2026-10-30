// src/pages/Settings/FeaturesScreen.jsx — Ajustes › Funciones (poda P3, 30-oct-2026).
// Encender o apagar los módulos que usa una minoría. Apagado solo significa
// que no ocupa fila en "Más" ni en el riel: los datos no se tocan y vuelven
// a aparecer al encenderlo. Las cuentas de antes de la poda tienen todo
// encendido (utils/modules.js).
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { moduleOn, setModule } from '../../utils/modules.js'
import { srow, slbl, ssub, Switch, Setting } from './settingsUi.jsx'

export default function FeaturesScreen() {
  const { settings, updateSettings } = useApp()
  const { t } = useT()
  const toggle = (id) => updateSettings({ ...settings, ...setModule(settings, id, !moduleOn(settings, id)) })
  return (
    <div>
      <p style={{ ...ssub, fontSize: 13, lineHeight: 1.5, margin: '0 0 6px' }}>{t('settings.features.intro')}</p>
      <Setting id="properties" style={srow}>
        <div>
          <div style={slbl} id="settings-feat-properties">{t('settings.features.properties')}</div>
          <div style={ssub}>{t('settings.features.properties.sub')}</div>
        </div>
        <Switch checked={moduleOn(settings, 'properties')} labelledBy="settings-feat-properties" onChange={() => toggle('properties')} />
      </Setting>
      <Setting id="advisor" style={{ ...srow, borderBottom: 'none' }}>
        <div>
          <div style={slbl} id="settings-feat-advisor">{t('settings.features.advisor')}</div>
          <div style={ssub}>{t('settings.features.advisor.sub')}</div>
        </div>
        <Switch checked={moduleOn(settings, 'advisor')} labelledBy="settings-feat-advisor" onChange={() => toggle('advisor')} />
      </Setting>
    </div>
  )
}
