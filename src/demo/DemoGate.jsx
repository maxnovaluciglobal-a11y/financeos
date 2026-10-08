// src/demo/DemoGate.jsx
// Gate previo al demo: pide email + nombre antes de mostrar demo.moyiq.app.
// Decisión de producto (18-sep-2026, pedido explícito): el demo pasó de
// "sin registro" a pedir estos 2 datos — revierte la decisión anterior
// documentada en memoria (demo sin fricción = ventaja competitiva). No
// bloquea si falla el registro server-side (best-effort, ver registerDemoLead)
// — el gate es para capturar el lead, no para trabar a nadie por un problema
// de red. Persistido en localStorage: una vez pasado, no se vuelve a pedir
// en el mismo dispositivo/navegador.
//
// i18n (T02, 07-oct-2026): este gate se monta ANTES de DemoProvider, así que
// useT() (que lee el idioma de useApp()) no sirve acá. Usa useTFor() con el
// idioma del navegador (detectLanguage), el mismo que después recibe el demo
// como idioma inicial (demoData.js). Lo que dice el texto tiene que ser cierto:
// registerDemoLead guarda nombre + email + consentimiento en demo_leads y NO
// manda ningún correo; la casilla solo registra el consentimiento de marketing.
import { useState } from 'react'
import { registerDemoLead } from '../utils/licenseValidator.js'
import { useTFor } from '../i18n/useT.js'
import { detectLanguage } from '../i18n/translate.js'
import { Btn } from '../components/ui/index.jsx'
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
  const [lang] = useState(() => detectLanguage())
  const { t } = useTFor(lang)
  const [email, setEmail]     = useState('')
  const [nombre, setNombre]   = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    const cleanEmail = email.trim()
    const cleanNombre = nombre.trim()
    if (!cleanNombre) { setError(t('demoGate.errName')); return }
    if (!EMAIL_RE.test(cleanEmail)) { setError(t('demoGate.errEmail')); return }
    setError('')
    setLoading(true)
    // No bloquea la entrada al demo por el resultado del registro — best-effort.
    registerDemoLead(cleanEmail, cleanNombre, consent, lang).finally(() => {
      markPassed()
      setLoading(false)
      onPass()
    })
  }

  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx)', marginBottom: 4 }
  const inputStyle = {
    width: '100%', minHeight: 44, padding: '10px 12px', borderRadius: 'var(--r)',
    border: '1px solid var(--brd2)', fontSize: 16, fontFamily: 'var(--sans)',
  }

  return (
    <div lang={lang} style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '24px 16px',
    }}>
      <form
        onSubmit={handleSubmit}
        noValidate
        style={{
          width: '100%',
          maxWidth: 380,
          background: 'var(--sur)',
          borderRadius: 'var(--rxl)',
          padding: '32px 24px',
          boxShadow: 'var(--sh-3)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <Logo size={36} />
        </div>

        <h1 style={{
          fontFamily: 'var(--display)',
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--tx)',
          textAlign: 'center',
          margin: '0 0 8px',
        }}>
          {t('demoGate.title')}
        </h1>
        <p style={{
          fontFamily: 'var(--sans)',
          fontSize: 13,
          color: 'var(--tm)',
          textAlign: 'center',
          margin: '0 0 24px',
          lineHeight: 1.5,
        }}>
          {t('demoGate.sub')}
        </p>

        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={labelStyle}>{t('demoGate.name')}</span>
          <input
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder={t('demoGate.namePh')}
            autoComplete="name"
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={labelStyle}>{t('demoGate.email')}</span>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={t('authGate.emailPlaceholder')}
            autoComplete="email"
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 18, cursor: 'pointer', minHeight: 44 }}>
          <input
            type="checkbox"
            checked={consent}
            onChange={e => setConsent(e.target.checked)}
            style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2 }}
          />
          <span style={{ fontSize: 12, color: 'var(--tm)', lineHeight: 1.45 }}>
            {t('demoGate.consent')}
          </span>
        </label>

        {error && (
          <div role="alert" style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <Btn
          type="submit"
          variant="primary"
          disabled={loading}
          style={{
            width: '100%',
            minHeight: 48,
            fontSize: 14,
            fontWeight: 700,
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? t('demoGate.loading') : t('demoGate.submit')}
        </Btn>

        <p style={{ fontSize: 12, color: 'var(--tm)', textAlign: 'center', marginTop: 14, lineHeight: 1.45 }}>
          {t('demoGate.foot')}
        </p>
      </form>
    </div>
  )
}
