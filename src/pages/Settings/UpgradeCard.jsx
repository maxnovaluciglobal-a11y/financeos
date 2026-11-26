// src/pages/Settings/UpgradeCard.jsx — tarjeta de Pro en Ajustes › Suscripción y
// plan, para quien no tiene Pro pagado. Modelo A (26-nov-2026): si la cuenta
// todavía puede, primero "14 días de Pro gratis, sin tarjeta" (se empieza acá,
// TrialStartButton); siempre, la compra con la elección anual/mensual en los
// Payment Links sin prueba. Durante la prueba muestra hasta cuándo dura y deja
// comprar.
import { useState } from 'react'
import { Btn } from '../../components/ui/index.jsx'
import PeriodToggle from '../../components/ui/PeriodToggle.jsx'
import RenewalNote from '../../components/ui/RenewalNote.jsx'
import TrialStartButton from '../../components/ui/TrialStartButton.jsx'
import { useT } from '../../i18n/useT.js'
import config from '../../config.js'
import { checkoutFor, checkoutPlan, DEFAULT_BILLING_PERIOD, withCheckoutLang } from '../../utils/pricing.js'
import { trackEvent } from '../../utils/webAnalytics.js'
import { useAccount } from '../../hooks/useAccount.js'
import { nativePlatform } from '../../native/platform.js'
import { webCheckoutAllowed } from '../../native/storePolicy.js'
import { useProTrial } from '../../core/proTrial.js'

export default function UpgradeCard({ subStyle }) {
  const { t, lang } = useT()
  const [period, setPeriod] = useState(DEFAULT_BILLING_PERIOD)
  const account = useAccount()
  const trial = useProTrial()
  const { href } = checkoutFor(period)
  const { trialDays } = config.pricing
  const canTrial = config.pricing.noCardTrial === true && trial.status?.eligible === true
  const buy = () => { trackEvent('checkout_start', { plan: checkoutPlan(period) }); window.location.href = withCheckoutLang(href, lang, account) }

  // App de tienda: sin precio ni checkout de Stripe (native/storePolicy.js).
  if (!webCheckoutAllowed(nativePlatform())) {
    return (
      <div style={{padding:'12px 14px',margin:'11px 0',background:'var(--color-brand-subtle)',borderRadius:'var(--r)'}}>
        <div style={{fontSize:13,fontWeight:600,color:'var(--tx)'}}>{t('menu.upgrade.title')}</div>
        <div style={subStyle}>{t('billing.native.unavailable')}</div>
      </div>
    )
  }

  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',padding:'12px 14px',margin:'11px 0',background:'var(--color-brand-subtle)',border: 0,borderRadius:'var(--r)'}}>
      <div style={{flex:'1 1 240px',minWidth:0}}>
        <div style={{fontSize:'var(--t-subhead)',fontWeight:600,color:'var(--tx)'}}>{canTrial ? t('settings.upgrade.title', { days: trialDays }) : t('menu.upgrade.title')}</div>
        <div style={subStyle}>{t('settings.upgrade.sub')}</div>
        <div style={{...subStyle,marginTop:6}}>
          {canTrial ? <>{t('billing.trialNote')} </> : null}
          <RenewalNote period={period} />
        </div>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:8,flexShrink:0,minWidth:240}}>
        {canTrial && <TrialStartButton className="fos-btn-primary" source="settings" />}
        <PeriodToggle value={period} onChange={setPeriod} />
        {/* Un solo primario por subpantalla: con la prueba disponible lo es "Empezar". */}
        {canTrial
          ? <Btn variant="ghost" size="sm" onClick={buy}>{t('menu.upgrade.title')}</Btn>
          : <Btn variant="primary" size="sm" onClick={buy}>{t('menu.upgrade.title')}</Btn>}
      </div>
    </div>
  )
}
