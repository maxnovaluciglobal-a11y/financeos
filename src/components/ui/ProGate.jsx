// src/components/ui/ProGate.jsx
// Muestra un bloqueo orientativo si el plan activo no es Pro.
// Lee la licencia FNOS-XXXX desde settings (vía usePlan) con fallback a config.plan.
// Es solo cosmético: los límites reales viven del lado del servidor.
//
// Uso:
//   <ProGate featureKey="nav.advisorMode"><ComponentePro /></ProGate>
//   <ProGate feature={t('cf.proGateFeature')}>…</ProGate>   (texto ya traducido)
//   <ProGate featureKey="…" benefits={['pro.gate.benefit.advisor', …]}>…</ProGate>
//
// T04 (07-oct-2026): todo el texto pasa por i18n (pro.gate.*). El título es
// neutro ("{feature} está en Pro"), así que la vieja prop `feminine` ya no hace
// nada (se acepta para no romper usos existentes). El precio sale de
// config.pricing con formato según idioma (utils/pricing.js). El CTA abre la
// landing en una pestaña nueva: en la PWA instalada en iOS (standalone), una
// navegación en la misma pestaña deja a la persona fuera de la app sin forma
// de volver.
//
// T10 (08-oct-2026): si config.pricing.trialEnabled === true y hay
// trialCheckoutUrl, el CTA pasa a "Probar 14 días" y abre el Payment Link de
// prueba, con la nota de cobro debajo (tarjeta requerida, cuándo se cobra).
// Con el flag apagado o sin URL, todo queda como antes (utils/pricing.js, proCta).

import { useState } from 'react'
import { usePlan } from '../../hooks/usePlan.js'
import { useAccount } from '../../hooks/useAccount.js'
import PeriodToggle from './PeriodToggle.jsx'
import { useT } from '../../i18n/useT.js'
import config from '../../config.js'
import { proPriceVars, proCta, withCheckoutLang, checkoutFor, DEFAULT_BILLING_PERIOD } from '../../utils/pricing.js'
import { IconIQScore } from '../icons/Icons.jsx'
import { initialSearch, planParam } from '../../utils/deepLink.js'
import styles from './ui.module.css'

export const DEFAULT_PRO_BENEFITS = [
  'pro.gate.benefit.advisor',
  'pro.gate.benefit.planning',
  'pro.gate.benefit.country',
]

// PRD-4 (20-oct-2026): el valor de Pro se ve antes de pagar.
//  - Demo (todo abierto): una franja "Función Pro" arriba de la herramienta,
//    para que quede claro qué parte del demo es de Pro.
//  - Sin Pro: debajo de la tarjeta, una vista previa de la herramienta con
//    los datos de la persona, desenfocada e inerte (no se lee ni se usa: el
//    resultado queda bloqueado). preview={false} la apaga.
function DemoProStrip({ t, days }) {
  return (
    <div role="note" style={{
      display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 12px', padding: '8px 12px',
      background: 'var(--amb-bg)', border: '.5px solid var(--brd2)', borderRadius: 'var(--r)',
      fontSize: 13, color: 'var(--tm)', lineHeight: 1.45,
    }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, letterSpacing: '.5px', color: 'var(--amb)', flexShrink: 0 }}>PRO</span>
      <span>{t('pro.demo.strip', { days })}</span>
    </div>
  )
}

// eslint-disable-next-line no-unused-vars
export default function ProGate({ children, feature, featureKey, benefits = DEFAULT_PRO_BENEFITS, feminine, preview = true }) {
  const { isPro } = usePlan()
  const { t, lang } = useT()
  const account = useAccount()
  // APP-N3 (C-39): la misma elección anual/mensual que LicenseGate y Ajustes.
  // APP-N12: ?plan=annual|monthly de la landing (también tras confirmar el correo).
  const [period, setPeriod] = useState(() => (typeof window !== 'undefined' && planParam(initialSearch(window.location.search))) || DEFAULT_BILLING_PERIOD)

  const isDemo = typeof window !== 'undefined' && window.location.search.includes('demo=true')
  if (isPro && isDemo) return <><DemoProStrip t={t} days={config.pricing.trialDays} />{children}</>
  if (isPro) return children

  const featureName = featureKey ? t(featureKey) : (feature || t('pro.gate.featureDefault'))
  const list = Array.isArray(benefits) && benefits.length ? benefits : DEFAULT_PRO_BENEFITS
  const base = proCta(config.pricing)
  const periodCta = checkoutFor(period)
  const cta = base.trial && periodCta.trial ? { ...base, href: periodCta.href } : base
  const trialDays = config.pricing.trialDays
  const priceVars = proPriceVars(lang)
  const ctaLabel = t(cta.labelKey, { days: trialDays })

  const gate = (
    <div style={{
      maxWidth: 520, margin: '48px auto', padding: '32px 24px',
      background: 'var(--sur)', border: '.5px solid var(--brd)',
      borderRadius: 'var(--rl)', textAlign: 'center', boxShadow: 'var(--sh-1)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }} aria-hidden="true">
        <IconIQScore size={40} />
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--tm)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
        {t('pro.gate.kicker')}
      </div>
      <h2 style={{ fontFamily: 'var(--display)', fontSize: 20, fontWeight: 700, color: 'var(--tx)', marginBottom: 16, lineHeight: 1.3 }}>
        {t('pro.gate.title', { feature: featureName })}
      </h2>

      <ul
        aria-label={t('pro.gate.includes')}
        style={{ listStyle: 'none', display: 'inline-flex', flexDirection: 'column', gap: 8, textAlign: 'left', margin: '0 0 20px', padding: 0 }}
      >
        {list.map(key => (
          <li key={key} style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 14, color: 'var(--tm)', lineHeight: 1.5 }}>
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 'var(--rs)', background: 'var(--laton)', flexShrink: 0, transform: 'translateY(-2px)' }} />
            {t(key)}
          </li>
        ))}
      </ul>

      <p style={{ fontSize: 13, color: 'var(--th)', marginBottom: 20 }}>
        {t('pro.gate.price', priceVars)}
      </p>

      {cta.trial && (
        <div style={{ maxWidth: 320, margin: '0 auto 16px' }}>
          <PeriodToggle value={period} onChange={setPeriod} />
        </div>
      )}

      <a
        href={withCheckoutLang(cta.href, lang, account)}
        target="_blank"
        rel="noopener noreferrer"
        className={`${styles.btn} ${styles.btn_primary}`}
        aria-label={`${ctaLabel} (${t('pro.gate.ctaHint')})`}
        title={t('pro.gate.ctaHint')}
        style={{ fontSize: 14, fontWeight: 700, padding: '10px 24px', minHeight: 48, textDecoration: 'none' }}
      >
        {ctaLabel}
      </a>

      {cta.trial && (
        <p style={{ fontSize: 12, color: 'var(--th)', marginTop: 12, lineHeight: 1.5 }}>
          {t(period === 'monthly' ? 'billing.then.monthly' : 'billing.then.annual', priceVars)} {t('billing.trialNote', { next: trialDays + 1 })}
        </p>
      )}
      {preview && (
        <p style={{ fontSize: 13, color: 'var(--tm)', marginTop: 16, lineHeight: 1.5 }}>
          {t('pro.gate.previewNote', { days: trialDays })}
        </p>
      )}
    </div>
  )

  if (!preview) return gate
  return (
    <>
      {gate}
      <section aria-label={t('pro.gate.previewLabel')} style={{ maxWidth: 960, margin: '0 auto 32px' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--th)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
          {t('pro.gate.previewLabel')}
        </div>
        <div inert data-pro-preview="" style={{
          position: 'relative', maxHeight: 380, overflow: 'hidden', pointerEvents: 'none', userSelect: 'none',
          filter: 'blur(4px)', borderRadius: 'var(--rl)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 55%, transparent)', maskImage: 'linear-gradient(to bottom, black 55%, transparent)',
        }}>
          {children}
        </div>
      </section>
    </>
  )
}
