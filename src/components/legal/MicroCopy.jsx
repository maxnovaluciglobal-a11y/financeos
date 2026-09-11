// src/components/legal/MicroCopy.jsx
// Componentes de microcopy legal — reutilizables en toda la app
// Importar donde se necesite mostrar avisos contextuales

// ── FINANCIAL DISCLAIMER ─────────────────────────────────────────────────────
// Usar en: Dashboard, Reportes, Proyección, pie de página de la app
export function FinancialDisclaimer({ compact = false }) {
  if (compact) {
    return (
      <p style={{
        fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)',
        lineHeight: 1.5, marginTop: 8,
      }}>
        Orientación general · No constituye asesoría financiera certificada.
      </p>
    )
  }
  return (
    <div style={{
      fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)',
      lineHeight: 1.6, padding: '8px 12px', background: 'var(--sur2)',
      borderRadius: 6, borderLeft: '2px solid var(--brd2)', marginTop: 8,
    }}>
      MOY IQ es una herramienta de organización financiera personal. Los datos y
      proyecciones mostrados se basan en la información ingresada por el usuario y
      no constituyen asesoría financiera, tributaria ni de inversión.
    </div>
  )
}

// ── BACKUP WARNING ────────────────────────────────────────────────────────────
// Usar en: Ajustes, onboarding final, primer acceso al módulo de exportación
export function BackupWarning({ variant = 'full' }) {
  if (variant === 'inline') {
    return (
      <p style={{
        fontSize: 11, color: 'var(--amb)', fontFamily: 'var(--mono)',
        lineHeight: 1.5, marginTop: 6,
      }}>
        ⚠ Exporta un respaldo JSON periódicamente. Los datos locales pueden perderse
        si borras el navegador o cambias de dispositivo.
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
      <span style={{ flexShrink: 0, fontSize: 16, marginTop: 1 }}>⚠</span>
      <div>
        <strong>Tus datos viven en este dispositivo.</strong> Si borras el navegador,
        limpias la caché o cambias de dispositivo sin exportar un respaldo, perderás
        todos tus datos de forma permanente. Exporta un respaldo JSON desde{' '}
        <strong>Ajustes → Exportar JSON</strong> al menos una vez al mes.
      </div>
    </div>
  )
}

// ── PROJECTION DISCLAIMER ─────────────────────────────────────────────────────
// Usar en: módulo de Proyección de flujo de caja
export function ProjectionDisclaimer() {
  return (
    <p style={{
      fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)',
      lineHeight: 1.5, marginTop: 8,
    }}>
      * Proyección calculada sobre ingresos y gastos recurrentes registrados.
      No incluye eventos futuros imprevistos. Orientación general — no constituye
      asesoría financiera certificada.
    </p>
  )
}

// ── REPORTS DISCLAIMER ────────────────────────────────────────────────────────
// Usar en: módulo de Reportes
export function ReportsDisclaimer() {
  return (
    <p style={{
      fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)',
      lineHeight: 1.5, padding: '6px 10px', background: 'var(--sur2)',
      borderRadius: 4, marginTop: 4,
    }}>
      Las recomendaciones mostradas se basan en los datos registrados y son
      orientativas. No constituyen asesoría financiera, tributaria ni de inversión.
    </p>
  )
}
