// src/pages/Settings/PlanScreen.jsx — Ajustes › Suscripción y plan (R10).
// Plan actual con "Desactivar licencia" (con confirmación), "Probar Pro" (el
// único primario Latón de la subpantalla, solo para quien no es Pro) y el
// enlace al formulario de cancelación.
import { useState } from 'react'
import { Btn } from '../../components/ui/index.jsx'
import { useT } from '../../i18n/useT.js'
import { clearLicense, clearStarterAck, clearServerEntitlement, getLicensePlan } from '../../utils/licenseValidator.js'
import { cancelUrl } from '../../utils/cancelUrl.js'
import UpgradeCard from './UpgradeCard.jsx'
import { srow, slbl, ssub, Setting } from './settingsUi.jsx'

export default function PlanScreen({ isDemo, accountUserId }) {
  const { t, lang } = useT()
  const [confirming, setConfirming] = useState(false)
  const isPro = getLicensePlan() === 'pro'

  async function handleDeactivate() {
    setConfirming(false)
    clearLicense()
    clearStarterAck()
    // Sin esto, el useEffect de sincronización de App.jsx repone el plan
    // desde user_entitlements apenas recarga — "Desactivar" quedaba sin
    // efecto real mientras la cuenta siguiera teniendo un entitlement.
    if (accountUserId) await clearServerEntitlement(accountUserId)
    window.location.reload()
  }

  if (isDemo) return <div style={ssub}>{t('settings.group.plan.demo')}</div>

  return (
    <div>
      {!isPro && <Setting id="upgrade"><UpgradeCard subStyle={ssub} /></Setting>}
      <Setting id="license">
        {confirming ? (
          <div role="group" aria-label={t('settings.license.btn')} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',margin:'11px 0',background: 'var(--fill)',borderRadius:8,border: 0,flexWrap:'wrap'}}>
            <span style={{fontSize:12,color:'var(--tx)',fontFamily: 'var(--sans)',flex:1}}>{t('settings.confirmDeactivateLicense')}</span>
            <div style={{display:'flex',gap:6}}>
              <Btn variant="danger" size="xs" onClick={handleDeactivate}>{t('debts.card.confirm')}</Btn>
              <Btn variant="ghost" size="xs" onClick={()=>setConfirming(false)}>{t('common.cancel')}</Btn>
            </div>
          </div>
        ) : (
          <div style={srow}>
            <div><div style={slbl}>{t('settings.license.label', { plan: isPro ? 'Pro' : 'Starter' })}</div><div style={ssub}>{t('settings.license.sub')}</div></div>
            <Btn variant="ghost" size="sm" onClick={()=>setConfirming(true)}>{t('settings.license.btn')}</Btn>
          </div>
        )}
      </Setting>
      <Setting id="cancel" style={{ ...srow, borderBottom: 'none' }}>
        <div><div style={slbl}>{t('settings.cancelSub.label')}</div><div style={ssub}>{t('settings.cancelSub.sub')}</div></div>
        <Btn variant="ghost" size="sm" onClick={() => window.open(cancelUrl(lang), '_blank', 'noopener,noreferrer')}>{t('settings.cancelSub.btn')}</Btn>
      </Setting>
    </div>
  )
}
