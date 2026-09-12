// src/components/ui/ProGate.jsx
// Muestra un bloqueo orientativo si el plan activo no es Pro.
// Lee la licencia FNOS-XXXX desde settings (vía usePlan) con fallback a config.plan.
// Usar: <ProGate><ComponentePro /></ProGate>

import { usePlan } from '../../hooks/usePlan.js'

export default function ProGate({ children, feature = 'esta función', feminine = false }) {
  const { isPro } = usePlan()

  if (isPro) return children

  return (
    <div style={{
      maxWidth: 520, margin: '48px auto', padding: '32px 24px',
      background: 'var(--sur)', border: '.5px solid var(--brd)',
      borderRadius: 'var(--r)', textAlign: 'center',
    }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>◑</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--amb)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
        Función Pro
      </div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--tx)', marginBottom: 8 }}>
        {feature} es exclusiv{feminine ? 'a' : 'o'} del plan Pro
      </h2>
      <p style={{ fontSize: 13, color: 'var(--th)', lineHeight: 1.7, marginBottom: 20 }}>
        Actualiza a Pro desde <strong>US$4.99/mes</strong> (o US$39.99/año) para acceder a Modo Asesor, reportes PDF, proyección de flujo, simulador de deudas, APV Chile e importación CSV.
      </p>
      <a
        href="https://moyiq.app/#pricing"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-block', background: 'var(--accent)',
          color: '#0f1923', borderRadius: 8, padding: '10px 22px',
          fontWeight: 700, fontSize: 13, textDecoration: 'none',
          fontFamily: 'var(--mono)',
        }}
      >
        Ver planes →
      </a>
    </div>
  )
}
