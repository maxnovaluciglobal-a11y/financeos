// src/components/AuthGate.jsx
// Login obligatorio — corre ANTES de LicenseGate. Sin esto, nadie usa la app
// (ni siquiera Starter). Antes del 12-sep-2026 MOY IQ no tenía ningún
// concepto de cuenta; esto no reemplaza esa arquitectura local-first (los
// datos siguen en IndexedDB, no en el servidor) — solo agrega una identidad
// real (email/contraseña o Google) como puerta de entrada.
import { useState } from 'react'
import { signUpWithPassword, signInWithPassword, signInWithGoogle } from '../core/auth.js'
import { useT } from '../i18n/useT.js'
import Logo from './Logo.jsx'

function friendlyError(t, raw) {
  const m = String(raw || '')
  if (/invalid login credentials/i.test(m)) return t('authGate.errorInvalidCredentials')
  if (/already registered|already exists|user already/i.test(m)) return t('authGate.errorEmailExists')
  if (/password.*(least|short|6)/i.test(m)) return t('authGate.errorWeakPassword')
  if (/email not confirmed/i.test(m)) return t('authGate.errorEmailNotConfirmed')
  if (/network|fetch|timeout/i.test(m)) return t('authGate.errorNetwork')
  return t('authGate.errorGeneric')
}

export default function AuthGate({ onAuthenticated }) {
  const { t } = useT()
  const [tab, setTab] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkEmail, setCheckEmail] = useState(false)

  async function handleSubmit() {
    const cleanEmail = email.trim()
    if (!cleanEmail || !password) { setError(t('authGate.errorMissingFields')); return }
    setError('')
    setLoading(true)
    const result = tab === 'login'
      ? await signInWithPassword(cleanEmail, password)
      : await signUpWithPassword(cleanEmail, password)
    setLoading(false)
    if (result.error) {
      setError(friendlyError(t, result.error))
      return
    }
    if (tab === 'signup' && !result.data?.session) {
      // Confirmación de email requerida — sin sesión todavía, no se puede continuar.
      setCheckEmail(true)
      return
    }
    onAuthenticated(result.data.session.user)
  }

  async function handleGoogle() {
    setError('')
    const result = await signInWithGoogle()
    if (result.error) setError(friendlyError(t, result.error))
    // Éxito: signInWithGoogle redirige a Google, no hay nada más que hacer acá.
  }

  const s = {
    wrap: {
      minHeight: '100dvh', background: 'var(--bg)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'var(--sans)',
    },
    box: {
      background: 'var(--sur)', border: '1px solid var(--brd2)', borderRadius: 18,
      padding: '40px 36px', maxWidth: 400, width: '100%', boxShadow: 'var(--sh-2)',
    },
    input: {
      width: '100%', padding: '12px 14px', border: '1px solid var(--brd)', borderRadius: 8,
      fontSize: 16, fontFamily: 'var(--sans)', background: 'var(--bg)', color: 'var(--tx)',
      marginBottom: 10, boxSizing: 'border-box', outline: 'none',
    },
    tabBtn: (active) => ({
      flex: 1, padding: '9px', border: 'none', borderRadius: 7,
      background: active ? 'var(--sur)' : 'transparent',
      color: active ? 'var(--tx)' : 'var(--th)',
      fontWeight: active ? 600 : 500, fontSize: 13, cursor: 'pointer',
      boxShadow: active ? 'var(--sh-1)' : 'none', fontFamily: 'var(--sans)',
    }),
  }

  if (checkEmail) {
    return (
      <div style={s.wrap}>
        <div style={s.box}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <Logo size={22} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx)', marginBottom: 8, fontFamily: 'var(--display)' }}>
            {t('authGate.checkEmailTitle')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--tm)', lineHeight: 1.6 }}>
            {t('authGate.checkEmailBody', { email })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={s.wrap}>
      <div style={s.box}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <Logo size={22} />
        </div>

        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx)', marginBottom: 6, fontFamily: 'var(--display)' }}>
          {t('authGate.title')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--tm)', lineHeight: 1.6, marginBottom: 20 }}>
          {t('authGate.subtitle')}
        </div>

        <div style={{ display: 'flex', gap: 4, background: 'var(--sur2)', borderRadius: 9, padding: 4, marginBottom: 18 }}>
          <button style={s.tabBtn(tab === 'login')} onClick={() => { setTab('login'); setError('') }}>{t('authGate.tabLogin')}</button>
          <button style={s.tabBtn(tab === 'signup')} onClick={() => { setTab('signup'); setError('') }}>{t('authGate.tabSignup')}</button>
        </div>

        <button
          onClick={handleGoogle}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: 11, borderRadius: 8, border: '1px solid var(--brd)', background: 'var(--bg)',
            color: 'var(--tx)', fontSize: 13, fontWeight: 500, cursor: 'pointer', marginBottom: 14,
            fontFamily: 'var(--sans)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.9-2.26 5.36-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24 24 0 0 0 0 21.56l7.98-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.9l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {t('authGate.googleBtn')}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--brd)' }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--th)' }}>{t('authGate.dividerEmail')}</span>
          <div style={{ flex: 1, height: 1, background: 'var(--brd)' }} />
        </div>

        <input
          style={s.input}
          type="email"
          inputMode="email"
          placeholder={t('authGate.emailPlaceholder')}
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          spellCheck={false}
          autoFocus
        />
        <input
          style={s.input}
          type="password"
          placeholder={tab === 'signup' ? t('authGate.passwordPlaceholderSignup') : t('authGate.passwordPlaceholder')}
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />

        {error && (
          <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: 10, marginTop: -2, fontFamily: 'var(--mono)', padding: '8px 12px', background: 'var(--red-bg)', borderRadius: 7, lineHeight: 1.5 }}>
            ⚠ {error}
          </div>
        )}

        <button
          style={{
            width: '100%', padding: 12, background: 'var(--laton)', color: 'var(--navy)', border: 'none',
            borderRadius: 8, fontSize: 14, fontWeight: 500, fontFamily: 'var(--sans)',
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.55 : 1, transition: 'opacity .15s',
            marginTop: 4,
          }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? t('authGate.loading') : (tab === 'login' ? t('authGate.loginBtn') : t('authGate.signupBtn'))}
        </button>

      </div>
    </div>
  )
}
