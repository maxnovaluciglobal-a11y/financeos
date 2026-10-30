// src/pages/Settings/AdvancedScreen.jsx — Ajustes › Avanzado (R10).
// Cargar datos de ejemplo (con confirmación: sobrescribe), registro de
// errores, reiniciar la guía inicial e instalar como app.
import { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { Btn } from '../../components/ui/index.jsx'
import { useT } from '../../i18n/useT.js'
import DiagnosticsRow from './DiagnosticsRow.jsx'
import { srow, slbl, ssub, Setting } from './settingsUi.jsx'

export default function AdvancedScreen({ install }) {
  const { settings, updateSettings, loadDemo } = useApp()
  const { t } = useT()
  const [confirming, setConfirming] = useState(false)
  const { prompt: installPrompt, installed, isIOS, isStandalone, onInstall } = install

  async function handleLoadDemo() {
    setConfirming(false)
    await loadDemo()
  }

  return (
    <div>
      <Setting id="demo">
        {confirming ? (
          <div role="group" aria-label={t('settings.loadDemo.label')} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',margin:'11px 0',background:'var(--sur2)',borderRadius:8,border:'0.5px solid var(--brd2)',flexWrap:'wrap'}}>
            <span style={{fontSize:12,color:'var(--tx)',fontFamily: 'var(--sans)',flex:1}}>{t('settings.confirmLoadDemo')}</span>
            <div style={{display:'flex',gap:6}}>
              <Btn variant="danger" size="xs" onClick={handleLoadDemo}>{t('debts.card.confirm')}</Btn>
              <Btn variant="ghost" size="xs" onClick={()=>setConfirming(false)}>{t('common.cancel')}</Btn>
            </div>
          </div>
        ) : (
          <div style={srow}>
            <div><div style={slbl}>{t('settings.loadDemo.label')}</div><div style={ssub}>{t('settings.loadDemo.sub')}</div></div>
            <Btn variant="danger" size="sm" onClick={()=>setConfirming(true)}>{t('settings.loadDemo.btn')}</Btn>
          </div>
        )}
      </Setting>
      <Setting id="diagnostics">
        <DiagnosticsRow rowStyle={srow} labelStyle={slbl} subStyle={ssub} />
      </Setting>
      <Setting id="onboarding" style={srow}>
        <div><div style={slbl}>{t('settings.resetOnboarding.label')}</div><div style={ssub}>{t('settings.resetOnboarding.sub')}</div></div>
        <Btn variant="ghost" size="sm" onClick={()=>updateSettings({...settings,onboardingDone:false})}>{t('settings.resetOnboarding.btn')}</Btn>
      </Setting>
      <Setting id="install" style={{ ...srow, borderBottom: 'none' }}>
        <div>
          <div style={slbl}>{t('settings.install.title')}</div>
          <div style={ssub}>
            {installed ? t('settings.install.installed.sub')
              : isIOS && !isStandalone ? t('settings.install.iosInstructions')
              : installPrompt ? t('settings.install.pending.sub')
              : t('settings.group.advanced.installUnavailable')}
          </div>
        </div>
        {!installed && !isIOS && installPrompt && <Btn variant="ghost" size="sm" onClick={onInstall}>{t('settings.install.btn')}</Btn>}
      </Setting>
    </div>
  )
}
