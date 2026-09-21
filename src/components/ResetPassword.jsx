// src/components/ResetPassword.jsx
// Se muestra cuando App.jsx detecta el evento PASSWORD_RECOVERY (usuario
// abrió el link del correo de "olvidé mi contraseña", ver auth.js). La
// sesión ya es válida en ese momento — solo falta pedir la contraseña
// nueva y llamar updatePassword().
import { useState } from 'react'
import { updatePassword } from '../core/auth.js'
import { useT } from '../i18n/useT.js'
import Logo from './Logo.jsx'

export default function ResetPassword({ onDone }) {
  const { t } = useT()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!password || password.length < 6) { setError(t('authGate.errorWeakPassword')); return }
    setError('')
    setLoading(true)
    const result = await updatePassword(password)
    setLoading(false)
    if (result.error) { setError(t('authGate.errorGeneric')); return }
    onDone()
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'var(--sans)' }}>
      <div style={{ background: 'var(--sur)', border: '1px solid var(--brd2)', borderRadius: 18, padding: '40px 36px', maxWidth: 400, width: '100%', boxShadow: 'var(--sh-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <Logo size={22} />
        </div>
        <h1 style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx)', marginBottom: 6, fontFamily: 'var(--display)' }}>
          {t('resetPassword.title')}
        </h1>
        <div style={{ fontSize: 12, color: 'var(--tm)', lineHeight: 1.6, marginBottom: 20 }}>
          {t('resetPassword.subtitle')}
        </div>

        <label htmlFor="reset-password" style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--tm)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>
          {t('authGate.passwordPlaceholderSignup')}
        </label>
        <input
          id="reset-password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder={t('authGate.passwordPlaceholderSignup')}
          autoComplete="new-password"
          autoFocus
          style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--brd)', borderRadius: 8, fontSize: 16, fontFamily: 'var(--sans)', background: 'var(--bg)', color: 'var(--tx)', marginBottom: 10, boxSizing: 'border-box', outline: 'none' }}
        />

        {error && (
          <div role="alert" style={{ fontSize: 11, color: 'var(--red)', marginBottom: 10, marginTop: -2, fontFamily: 'var(--mono)', padding: '8px 12px', background: 'var(--red-bg)', borderRadius: 7, lineHeight: 1.5 }}>
            ⚠ {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{ width: '100%', padding: 12, background: 'var(--laton)', color: 'var(--navy)', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, fontFamily: 'var(--sans)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.55 : 1, marginTop: 4 }}
        >
          {loading ? t('authGate.loading') : t('resetPassword.submitBtn')}
        </button>
      </div>
    </div>
  )
}
