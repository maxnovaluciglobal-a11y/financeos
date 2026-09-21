// src/demo/DemoGate.jsx
// Gate previo al demo: pide email + nombre antes de mostrar demo.moyiq.app.
// Decisión de producto (18-sep-2026, pedido explícito): el demo pasó de
// "sin registro" a pedir estos 2 datos — revierte la decisión anterior
// documentada en memoria (demo sin fricción = ventaja competitiva). No
// bloquea si falla el registro server-side (best-effort, ver registerDemoLead)
// — el gate es para capturar el lead, no para trabar a nadie por un problema
// de red. Persistido en localStorage: una vez pasado, no se vuelve a pedir
// en el mismo dispositivo/navegador.
import { useState } from 'react'
import { registerDemoLead } from '../utils/licenseValidator.js'
import Logo from '../components/Logo.jsx'

const LS_KEY = 'fnos_demo_gate_passed'

export function hasPassedDemoGate() {
  try { return localStorage.getItem(LS_KEY) === '1' } catch { return false }
}

function markPassed() {
  try { localStorage.setItem(LS_KEY, '1') } catch {}
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export default function DemoGate({ onPass }) {
  const [email, setEmail]     = useState('')
  const [nombre, setNombre]   = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    const cleanEmail = email.trim()
    const cleanNombre = nombre.trim()
    if (!cleanNombre) { setError('Contanos tu nombre.'); return }
    if (!EMAIL_RE.test(cleanEmail)) { setError('Ese email no parece válido.'); return }
    setError('')
    setLoading(true)
    // No bloquea la entrada al demo por el resultado del registro — best-effort.
    registerDemoLead(cleanEmail, cleanNombre, consent).finally(() => {
      markPassed()
      setLoading(false)
      onPass()
    })
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--papel, #F5F1E8)',
      padding: '24px 16px',
    }}>
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 380,
          background: '#fff',
          borderRadius: 12,
          padding: '32px 28px',
          boxShadow: '0 8px 32px rgba(20,33,61,.12)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <Logo size={36} />
        </div>

        <h1 style={{
          fontFamily: 'var(--display)',
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--navy)',
          textAlign: 'center',
          margin: '0 0 8px',
        }}>
          Antes de entrar al demo
        </h1>
        <p style={{
          fontFamily: 'var(--sans)',
          fontSize: 13,
          color: 'var(--ceniza-700, #6b6b6b)',
          textAlign: 'center',
          margin: '0 0 24px',
          lineHeight: 1.5,
        }}>
          Dejanos tu nombre y email — es un paso rápido, y el demo te espera del otro lado. Los datos que uses adentro son ficticios; los tuyos, reales, se quedan solo con nosotros.
        </p>

        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--navy)', marginBottom: 4 }}>
            Nombre
          </span>
          <input
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Tu nombre"
            autoComplete="name"
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: '1px solid var(--ceniza-300, #ddd)', fontSize: 14,
              fontFamily: 'var(--sans)',
            }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--navy)', marginBottom: 4 }}>
            Email
          </span>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="tu@email.com"
            autoComplete="email"
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: '1px solid var(--ceniza-300, #ddd)', fontSize: 14,
              fontFamily: 'var(--sans)',
            }}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 18, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={consent}
            onChange={e => setConsent(e.target.checked)}
            style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2 }}
          />
          <span style={{ fontSize: 11.5, color: 'var(--ceniza-700, #6b6b6b)', lineHeight: 1.4 }}>
            Quiero recibir por email novedades y contenido de MOY IQ (opcional, podés darte de baja cuando quieras).
          </span>
        </label>

        {error && (
          <div style={{ color: 'var(--error, #b3261e)', fontSize: 12, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            background: 'var(--laton)',
            color: 'var(--navy)',
            border: 'none',
            borderRadius: 8,
            padding: '12px 16px',
            fontSize: 14,
            fontWeight: 700,
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Entrando…' : 'Ver el demo →'}
        </button>

        <p style={{ fontSize: 10.5, color: 'var(--ceniza-700, #6b6b6b)', textAlign: 'center', marginTop: 14 }}>
          Sin tarjeta. El demo es gratis y no requiere que crees una cuenta.
        </p>
      </form>
    </div>
  )
}
