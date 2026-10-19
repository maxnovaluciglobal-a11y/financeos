// src/pages/Settings/UpgradeCard.jsx
// Tarjeta "Probar Pro" de Ajustes (solo para quien no es Pro). Antes abría el
// Payment Link SIN prueba y sin opción anual (auditoría 360, C-03 / COM-3): ahora
// ofrece los links con prueba de 14 días, mensual o anual, como la landing.
import { useState } from 'react'
import { Btn } from '../../components/ui/index.jsx'
import PeriodToggle from '../../components/ui/PeriodToggle.jsx'
import { useT } from '../../i18n/useT.js'
import config from '../../config.js'
import { checkoutFor, DEFAULT_BILLING_PERIOD, proPriceVars, withCheckoutLang } from '../../utils/pricing.js'
import { useAccount } from '../../hooks/useAccount.js'

export default function UpgradeCard({ subStyle }) {
  const { t, lang } = useT()
  const [period, setPeriod] = useState(DEFAULT_BILLING_PERIOD)
  const account = useAccount()
  const { trial, href } = checkoutFor(period)
  const { trialDays } = config.pricing
  const thenKey = period === 'monthly' ? 'billing.then.monthly' : 'billing.then.annual'

  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',padding:'12px 14px',margin:'11px 0',background:'rgba(184,134,59,0.08)',border:'1px solid var(--laton)',borderRadius:'var(--r)'}}>
      <div style={{flex:'1 1 240px',minWidth:0}}>
        <div style={{fontSize:13,fontWeight:600,color:'var(--tx)'}}>{trial ? t('settings.upgrade.title', { days: trialDays }) : t('menu.upgrade.title')}</div>
        <div style={subStyle}>{t('settings.upgrade.sub')}</div>
        {trial && (
          <div style={{...subStyle,marginTop:6}}>
            {t(thenKey, proPriceVars(lang))} {t('billing.trialNote', { next: trialDays + 1 })}
          </div>
        )}
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:8,flexShrink:0,minWidth:240}}>
        {trial && <PeriodToggle value={period} onChange={setPeriod} />}
        <Btn variant="primary" size="sm" onClick={() => { window.location.href = withCheckoutLang(href, lang, account) }}>
          {trial ? t('settings.upgrade.btn', { days: trialDays }) : t('menu.upgrade.title')}
        </Btn>
      </div>
    </div>
  )
}
