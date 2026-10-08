// src/components/legal/MicroCopy.jsx
// Componentes de microcopy legal — reutilizables en toda la app
// Importar donde se necesite mostrar avisos contextuales
import SignalIcon, { InlineIcon } from '../icons/SignalIcon.jsx'
import { useT } from '../../i18n/useT.js'

// ── FINANCIAL DISCLAIMER ─────────────────────────────────────────────────────
// Usar en: Dashboard, Reportes, Proyección, pie de página de la app
export function FinancialDisclaimer({ compact = false }) {
  const { t } = useT()
  if (compact) {
    return (
      <p style={{
        fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)',
        lineHeight: 1.5, marginTop: 8,
      }}>
        {t('micro.disclaimer.compact')}
      </p>
    )
  }
  return (
    <div style={{
      fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)',
      lineHeight: 1.6, padding: '8px 12px', background: 'var(--sur2)',
      borderRadius: 6, borderLeft: '2px solid var(--brd2)', marginTop: 8,
    }}>
      {t('micro.disclaimer.full')}
    </div>
  )
}

// ── BACKUP WARNING ────────────────────────────────────────────────────────────
// Usar en: Ajustes, onboarding final, primer acceso al módulo de exportación
export function BackupWarning({ variant = 'full' }) {
  const { t } = useT()
  if (variant === 'inline') {
    return (
      <p style={{
        fontSize: 11, color: 'var(--amb)', fontFamily: 'var(--mono)',
        lineHeight: 1.5, marginTop: 6,
      }}>
        <InlineIcon kind="alert" size={13} />{t('micro.backup.inline')}
      </p>
    )
  }
  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'flex-start',
      padding: '12px 14px', background: 'var(--amb-bg)',
      border: '0.5px solid rgba(156,84,25,.25)', borderRadius: 8,
      fontSize: 12, color: 'var(--amb)', lineHeight: 1.6,
    }}>
      <SignalIcon kind="alert" size={16} style={{ marginTop: 3 }} />
      <div>
        <strong>{t('micro.backup.title')}</strong>{' '}
        {t('micro.backup.body', { path: `${t('nav.settings')} → ${t('settings.backup.title')}` })}
      </div>
    </div>
  )
}

// ── PROJECTION DISCLAIMER ─────────────────────────────────────────────────────
// Usar en: módulo de Proyección de flujo de caja
export function ProjectionDisclaimer() {
  const { t } = useT()
  return (
    <p style={{
      fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)',
      lineHeight: 1.5, marginTop: 8,
    }}>
      {t('micro.projection')}
    </p>
  )
}

// ── REPORTS DISCLAIMER ────────────────────────────────────────────────────────
// Usar en: módulo de Reportes
export function ReportsDisclaimer() {
  const { t } = useT()
  return (
    <p style={{
      fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)',
      lineHeight: 1.5, padding: '6px 10px', background: 'var(--sur2)',
      borderRadius: 4, marginTop: 4,
    }}>
      {t('micro.reports')}
    </p>
  )
}
