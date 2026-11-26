// src/pages/Settings/PlanScreen.jsx — Ajustes › Suscripción y plan (R10).
// Plan actual con "Desactivar licencia" (con confirmación), "Probar Pro" (el
// único primario Latón de la subpantalla, solo para quien no es Pro) y el
// enlace al formulario de cancelación.
import { useState } from 'react'
import { Btn } from '../../components/ui/index.jsx'
import { useT } from '../../i18n/useT.js'
import { clearLicense, clearStarterAck, clearServerEntitlement, getLicensePlan, getLicenseInfo } from '../../utils/licenseValidator.js'
import { isPaidPlan, planLabel } from '../../utils/plans.js'
import { usePlan } from '../../hooks/usePlan.js'
import { useTrialUiT } from '../../components/proTrial/uiDict.js'
import { cancelUrl } from '../../utils/cancelUrl.js'
import UpgradeCard from './UpgradeCard.jsx'
import { isNativeApp } from '../../native/platform.js'
import { srow, slbl, ssub, Setting } from './settingsUi.jsx'

export default function PlanScreen({ isDemo, accountUserId }) {
  const { t, lang } = useT()
  const [confirming, setConfirming] = useState(false)
  const { t: tt } = useTrialUiT()
  usePlan() // vuelve a pintar si el plan cambia (empezar la prueba desde la tarjeta)
  const plan = getLicensePlan()
  const isPro = isPaidPlan(plan)
  // Prueba de 14 días sin tarjeta: es Pro, pero no hay suscripción que cancelar
  // ni licencia que desactivar; se puede comprar durante la prueba.
  const info = getLicenseInfo()
  const noCardTrial = isPro && !!info?.noCard
  const trialEnds = noCardTrial ? (info.trialEnds || info.exp) : null
  const label = planLabel(plan)

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

  // App de tienda (NAT-1, B2): sin "Probar Pro", sin clave de licencia que
  // desactivar (no hay dónde volver a ingresarla y el plan vive en la cuenta).
  // Solo el plan de la cuenta y, si es Pro comprado en la web, cómo cancelarlo.
  if (isNativeApp()) {
    return (
      <div>
        <Setting id="license" style={isPro ? srow : { ...srow, borderBottom: 'none' }}>
          <div><div style={slbl}>{t('settings.license.label', { plan: label })}</div><div style={ssub}>{t('settings.license.sub')}</div></div>
        </Setting>
        {isPro && (
          <Setting id="cancel" style={{ ...srow, borderBottom: 'none' }}>
            <div><div style={slbl}>{t('settings.cancelSub.label')}</div><div style={ssub}>{t('settings.cancelSub.sub')}</div></div>
            <Btn variant="ghost" size="sm" onClick={() => window.open(cancelUrl(lang), '_blank', 'noopener,noreferrer')}>{t('settings.cancelSub.btn')}</Btn>
          </Setting>
        )}
      </div>
    )
  }

  if (noCardTrial) {
    let date = ''
    if (trialEnds) try { date = new Date(trialEnds).toLocaleDateString(lang, { day: 'numeric', month: 'long' }) } catch { date = '' }
    return (
      <div>
        <Setting id="license" style={srow}>
          <div><div style={slbl}>{tt('proTrial.plan.label', { date })}</div><div style={ssub}>{tt('proTrial.plan.sub')}</div></div>
        </Setting>
        <Setting id="upgrade" style={{ borderBottom: 'none' }}><UpgradeCard subStyle={ssub} /></Setting>
      </div>
    )
  }

  return (
    <div>
      {!isPro && <Setting id="upgrade"><UpgradeCard subStyle={ssub} /></Setting>}
      <Setting id="license">
        {confirming ? (
          <div role="group" aria-label={t('settings.license.btn')} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',margin:'11px 0',background: 'var(--fill)',borderRadius:8,border: 0,flexWrap:'wrap'}}>
            <span style={{fontSize:'var(--t-footnote)',color:'var(--tx)',fontFamily: 'var(--sans)',flex:1}}>{t('settings.confirmDeactivateLicense')}</span>
            <div style={{display:'flex',gap:6}}>
              <Btn variant="danger" size="xs" onClick={handleDeactivate}>{t('debts.card.confirm')}</Btn>
              <Btn variant="ghost" size="xs" onClick={()=>setConfirming(false)}>{t('common.cancel')}</Btn>
            </div>
          </div>
        ) : (
          <div style={srow}>
            <div><div style={slbl}>{t('settings.license.label', { plan: label })}</div><div style={ssub}>{t('settings.license.sub')}</div></div>
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
