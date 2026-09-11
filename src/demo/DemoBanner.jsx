// src/demo/DemoBanner.jsx
import { useState } from 'react'
import { useDemo } from './DemoContext.jsx'

export default function DemoBanner() {
  const { setScenario } = useDemo()
  const [scenario, setLocal] = useState('exitoso')

  function toggle() {
    const next = scenario === 'dificil' ? 'exitoso' : 'dificil'
    setLocal(next)
    setScenario(next)
  }

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 200,
      background: 'linear-gradient(135deg, var(--navy), var(--navy-700))',
      color: '#fff',
      boxShadow: '0 2px 12px rgba(20,33,61,.3)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', minHeight: 40, flexWrap: 'wrap' }}>

        <div style={{
          background: 'rgba(255,255,255,.2)',
          borderRadius: 20,
          padding: '2px 8px',
          fontSize: 10,
          fontFamily: 'var(--mono)',
          fontWeight: 600,
          letterSpacing: 1,
          flexShrink: 0,
          border: '1px solid rgba(255,255,255,.3)',
          whiteSpace: 'nowrap',
        }}>
          DEMO
        </div>

        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.85)', flex: 1, lineHeight: 1.3, minWidth: 120 }}>
          Datos ficticios · Sofía García · Colombia
        </span>

        {/* Toggle escenario — muestra el estado ACTUAL, no el destino */}
        <button
          onClick={toggle}
          title="Cambia entre dos perfiles financieros para ver cómo responde la app"
          style={{
            background: 'rgba(255,255,255,.12)',
            border: '1px solid rgba(255,255,255,.25)',
            color: '#fff',
            borderRadius: 6,
            padding: '8px 12px',
            minHeight: 40,
            fontSize: 11,
            cursor: 'pointer',
            fontFamily: 'var(--mono)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          {scenario === 'dificil' ? 'Escenario: Mes difícil ↕' : 'Escenario: Mes exitoso ↕'}
        </button>

        {/* CTA inmediato */}
        <a
          href="https://moyiq.app/#pricing"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: 'var(--laton)',
            border: 'none',
            color: 'var(--navy)',
            borderRadius: 6,
            padding: '8px 14px',
            minHeight: 40,
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            textDecoration: 'none',
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          Comprar →
        </a>

      </div>
    </div>
  )
}
