// src/pages/Settings/AppearanceScreen.jsx — Ajustes › Apariencia (R10, rial #52).
// Tema Sistema · Claro · Oscuro con miniaturas (ChoiceGroup con `preview`) y
// emoji en las categorías.
import { useApp } from '../../context/AppContext.jsx'
import { ChoiceGroup } from '../../components/ui/index.jsx'
import { THEME_SETTINGS } from '../../utils/theme.js'
import { useT } from '../../i18n/useT.js'
import { srow, slbl, ssub, Switch, Setting } from './settingsUi.jsx'

export default function AppearanceScreen() {
  const { settings, updateSettings } = useApp()
  const { t } = useT()
  return (
    <div>
      {/* N4: Sistema · Claro · Oscuro como radiogroup (antes, dos botones
          Latón que competían con el primario de la pantalla). */}
      <Setting id="theme" style={{ ...srow, flexWrap: 'wrap', gap: 10 }}>
        <div><div style={slbl} id="settings-theme-label">{t('settings.theme.label')}</div><div style={ssub}>{t('settings.theme.sub')}</div></div>
        <ChoiceGroup labelledBy="settings-theme-label" value={settings.theme || 'light'}
          onChange={theme => updateSettings({ ...settings, theme })}
          options={THEME_SETTINGS.map(v => ({ value: v, label: t(`settings.theme.${v}`), preview: v }))} />
      </Setting>

      {/* Emoji en las categorías (QuickAdd) — apagado por defecto */}
      <Setting id="emoji" style={{ ...srow, borderBottom: 'none' }}>
        <div>
          <div style={slbl} id="settings-emoji-label">{t('settings.categoryEmoji.label')}</div>
          <div style={ssub}>{t('settings.categoryEmoji.sub')}</div>
        </div>
        <Switch
          checked={settings.showCategoryEmoji === true}
          labelledBy="settings-emoji-label"
          onChange={() => updateSettings({ ...settings, showCategoryEmoji: settings.showCategoryEmoji !== true })}
        />
      </Setting>
    </div>
  )
}
