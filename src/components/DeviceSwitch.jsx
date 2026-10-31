// src/components/DeviceSwitch.jsx
// Solo aparece si no se pudo cambiar al espacio de la cuenta que entró
// (core/deviceOwner.js → applyAccountSwitch falló, casi siempre por
// almacenamiento lleno). No se borró nada: se ofrece reintentar o cerrar
// sesión. Mismo estilo visual que AuthGate.
import { useState } from 'react'
import { useT } from '../i18n/useT.js'
import { authClient } from '../core/authClient.js'
import { maskEmail } from '../core/deviceOwner.js'
import Logo from './Logo.jsx'

export default function DeviceSwitch({ previousEmail }) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const masked = maskEmail(previousEmail)

  async function signOut() {
    setBusy(true)
    try { await authClient?.auth.signOut() } finally { window.location.reload() }
  }

  const s = {
    wrap: { minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'var(--sans)' },
    box: { background: 'var(--sur)', border: 0, borderRadius: 18, padding: '40px 36px', maxWidth: 420, width: '100%', boxShadow: 'var(--sh-2)' },
    primary: { width: '100%', padding: '12px 14px', border: 'none', borderRadius: 8, background: 'var(--navy, #14213D)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--sans)', opacity: busy ? 0.6 : 1 },
    link: { background: 'none', border: 'none', color: 'var(--th)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--sans)', padding: '10px 0 0', width: '100%' },
  }

  return (
    <div style={s.wrap}>
      <div style={s.box} role="alertdialog" aria-labelledby="device-switch-title">
        <div style={{ marginBottom: 24 }}><Logo size={22} /></div>
        <h1 id="device-switch-title" style={{ fontSize: 16, fontWeight: 600, color: 'var(--tx)', marginBottom: 8, fontFamily: 'var(--display)' }}>
          {t('deviceSwitch.title')}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--tm)', lineHeight: 1.6, marginBottom: 20 }}>
          {masked ? t('deviceSwitch.bodyKnown', { email: masked }) : t('deviceSwitch.bodyUnknown')}
        </p>
        <button style={s.primary} disabled={busy} onClick={() => window.location.reload()}>{t('deviceSwitch.retry')}</button>
        <button style={s.link} disabled={busy} onClick={signOut}>{t('deviceSwitch.signOut')}</button>
      </div>
    </div>
  )
}
