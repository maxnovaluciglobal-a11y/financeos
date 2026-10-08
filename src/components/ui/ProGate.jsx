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

import { usePlan } from '../../hooks/usePlan.js'
import { useT } from '../../i18n/useT.js'
import config from '../../config.js'
import { proPriceVars, proCta } from '../../utils/pricing.js'
import { IconIQScore } from '../icons/Icons.jsx'
import styles from './ui.module.css'

export const DEFAULT_PRO_BENEFITS = [
  'pro.gate.benefit.advisor',
  'pro.gate.benefit.planning',
  'pro.gate.benefit.country',
]

// eslint-disable-next-line no-unused-vars
export default function ProGate({ children, feature, featureKey, benefits = DEFAULT_PRO_BENEFITS, feminine }) {
  const { isPro } = usePlan()
  const { t, lang } = useT()

  if (isPro) return children

  const featureName = featureKey ? t(featureKey) : (feature || t('pro.gate.featureDefault'))
  const list = Array.isArray(benefits) && benefits.length ? benefits : DEFAULT_PRO_BENEFITS
  const cta = proCta(config.pricing)
  const trialDays = config.pricing.trialDays
  const priceVars = proPriceVars(lang)
  const ctaLabel = t(cta.labelKey, { days: trialDays })

  return (
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

      <a
        href={cta.href}
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
          {t('pro.gate.trialNote', { m: priceVars.m, next: trialDays + 1 })}
        </p>
      )}
    </div>
  )
}
