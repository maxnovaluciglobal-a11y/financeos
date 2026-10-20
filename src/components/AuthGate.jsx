// src/components/AuthGate.jsx
// Login obligatorio — corre ANTES de LicenseGate. Sin esto, nadie usa la app
// (ni siquiera Starter). Antes del 12-sep-2026 MOY IQ no tenía ningún
// concepto de cuenta; esto no reemplaza esa arquitectura local-first (los
// datos siguen en IndexedDB, no en el servidor) — solo agrega una identidad
// real (email/contraseña o Google) como puerta de entrada.
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { InlineIcon } from './icons/SignalIcon.jsx'
import { signUpWithPassword, signInWithPassword, signInWithGoogle, resetPasswordForEmail, resendSignupConfirmation, MIN_PASSWORD_LENGTH } from '../core/auth.js'
import { useT } from '../i18n/useT.js'
import Logo from './Logo.jsx'
import { authTabFromSearch, stashOpenForOAuth, stashOpenForSignup, clearSignupStash } from '../utils/deepLink.js'

const LEGAL_URLS = {
  es: { terms: 'https://moyiq.app/terms.html', privacy: 'https://moyiq.app/privacy.html' },
  pt: { terms: 'https://moyiq.app/terms.html', privacy: 'https://moyiq.app/privacy.html' },
  en: { terms: 'https://moyiq.app/en/terms.html', privacy: 'https://moyiq.app/en/privacy.html' },
  de: { terms: 'https://moyiq.app/en/terms.html', privacy: 'https://moyiq.app/en/privacy.html' },
}

export function legalUrls(lang) {
  return LEGAL_URLS[lang] || LEGAL_URLS.es
}

// Aviso de Términos y Privacidad del registro: la frase lleva {terms} y
// {privacy} y cada marcador se reemplaza por su enlace.
export function LegalNotice({ t, lang }) {
  const urls = legalUrls(lang)
  const parts = String(t('authGate.legalNotice')).split(/(\{terms\}|\{privacy\})/)
  const link = (href, label) => (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--tx)', textDecoration: 'underline' }}>{label}</a>
  )
  return (
    <p data-testid="authgate-legal" style={{ fontSize: 12, color: 'var(--tm)', lineHeight: 1.6, margin: '12px 0 0', textAlign: 'center' }}>
      {parts.map((part, i) => (
        part === '{terms}' ? <span key={i}>{link(urls.terms, t('authGate.legalTerms'))}</span>
          : part === '{privacy}' ? <span key={i}>{link(urls.privacy, t('authGate.legalPrivacy'))}</span>
            : <span key={i}>{part}</span>
      ))}
    </p>
  )
}

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
  const { t, lang } = useT()
  const [tab, setTab] = useState(() => authTabFromSearch(window.location.search, window.location.hash)) // 'login' | 'signup' (?open=signup de un correo, ?signup de la landing)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkEmail, setCheckEmail] = useState(false)
  const [emailExists, setEmailExists] = useState(false)
  const [resendState, setResendState] = useState('idle') // 'idle' | 'sending' | 'sent' | 'error'
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  // C-22: aviso tras borrar la cuenta desde Ajustes (la app recarga y llega acá).
  // La marca se borra al volver a entrar, no al leerla: la app puede montar
  // esta pantalla dos veces (cierre de sesión y recarga).
  const [accountDeleted] = useState(() => {
    try { return sessionStorage.getItem('fnos_account_deleted') === '1' } catch { return false }
  })
  const clearDeletedNotice = () => { try { sessionStorage.removeItem('fnos_account_deleted') } catch {} }

  async function handleSubmit() {
    const cleanEmail = email.trim()
    if (!cleanEmail || !password) { setError(t('authGate.errorMissingFields')); return }
    if (tab === 'signup' && password.length < MIN_PASSWORD_LENGTH) { setError(t('authGate.errorWeakPassword')); return }
    setError('')
    clearDeletedNotice()
    setLoading(true)
    if (tab === 'signup') stashOpenForSignup(window.location.search)
    const result = tab === 'login'
      ? await signInWithPassword(cleanEmail, password)
      : await signUpWithPassword(cleanEmail, password, lang)
    setLoading(false)
    if (result.error) {
      setError(friendlyError(t, result.error))
      return
    }
    if (result.data?.session) clearSignupStash()
    if (tab === 'signup' && !result.data?.session) {
      // Supabase nunca revela si un email ya está registrado (protección
      // anti-enumeración): un signUp() sobre una cuenta YA confirmada
      // responde ok, sin sesión, pero con identities:[] vacío — y NO manda
      // ningún correo. Sin este chequeo, ese caso mostraba el mismo
      // "confirma tu email" que un signup real, y la persona esperaba para
      // siempre un correo que nunca se envía (ver caso pattytobusiness,
      // 23-sep-2026 — su cuenta ya existía desde el 12-sep).
      const identities = result.data?.user?.identities
      if (Array.isArray(identities) && identities.length === 0) {
        setEmailExists(true)
        return
      }
      // Confirmación de email requerida — sin sesión todavía, no se puede continuar.
      setCheckEmail(true)
      return
    }
    onAuthenticated(result.data.session.user)
  }

  // Pestañas (patrón APG): flechas izquierda/derecha cambian de pestaña.
  function onTabKey(e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const next = tab === 'login' ? 'signup' : 'login'
    setTab(next); setError('')
    document.getElementById(`authgate-tab-${next}`)?.focus()
  }

  async function handleForgotSubmit() {
    const cleanEmail = email.trim()
    if (!cleanEmail) { setError(t('authGate.errorMissingFields')); return }
    setError('')
    setLoading(true)
    const result = await resetPasswordForEmail(cleanEmail)
    setLoading(false)
    // Nunca revela si el email existe o no (mismo criterio de seguridad que
    // Supabase aplica server-side) — se muestra "revisa tu correo" incluso
    // si resetPasswordForEmail falló por email inexistente.
    if (result.error && !/network|fetch|timeout/i.test(String(result.error))) {
      setForgotSent(true)
      return
    }
    if (result.error) { setError(friendlyError(t, result.error)); return }
    setForgotSent(true)
  }

  async function handleResend() {
    setResendState('sending')
    const result = await resendSignupConfirmation(email.trim())
    setResendState(result.error ? 'error' : 'sent')
  }

  async function handleGoogle() {
    setError('')
    clearDeletedNotice()
    stashOpenForOAuth(window.location.search)
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
      marginBottom: 10, boxSizing: 'border-box',
    },
    // PRD-8 (C-39): etiqueta en sans, legible; el ejemplo queda en el placeholder.
    label: {
      fontSize: 13, fontFamily: 'var(--sans)', fontWeight: 500, color: 'var(--tx)',
      display: 'block', marginBottom: 6,
    },
    tabBtn: (active) => ({
      flex: 1, minHeight: 44, padding: '9px', border: 'none', borderRadius: 7,
      background: active ? 'var(--sur)' : 'transparent',
      color: active ? 'var(--tx)' : 'var(--th)',
      fontWeight: active ? 600 : 500, fontSize: 13, cursor: 'pointer',
      boxShadow: active ? 'var(--sh-1)' : 'none', fontFamily: 'var(--sans)',
    }),
  }

  if (forgotMode) {
    if (forgotSent) {
      return (
        <div className="fos-auth-wrap" style={s.wrap}>
          <div className="fos-auth-box" style={s.box}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <Logo size={22} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx)', marginBottom: 8, fontFamily: 'var(--display)' }}>
              {t('authGate.forgotSentTitle')}
            </div>
            <div style={{ fontSize: 13, color: 'var(--tm)', lineHeight: 1.6, marginBottom: 20 }}>
              {t('authGate.forgotSentBody', { email: email.trim() })}
            </div>
            <button
              onClick={() => { setForgotMode(false); setForgotSent(false); setError('') }}
              style={{ background: 'none', border: 'none', color: 'var(--th)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--sans)', padding: 0 }}
            >
              {t('authGate.backToLogin')}
            </button>
          </div>
        </div>
      )
    }
    return (
      <div className="fos-auth-wrap" style={s.wrap}>
        <div className="fos-auth-box" style={s.box}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
            <Logo size={22} />
          </div>
          <h1 style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx)', marginBottom: 6, fontFamily: 'var(--display)' }}>
            {t('authGate.forgotTitle')}
          </h1>
          <div style={{ fontSize: 12, color: 'var(--tm)', lineHeight: 1.6, marginBottom: 20 }}>
            {t('authGate.forgotSubtitle')}
          </div>
          <label htmlFor="authgate-forgot-email" style={s.label}>{t('authGate.emailLabel')}</label>
          <input
            id="authgate-forgot-email"
            style={s.input}
            type="email"
            inputMode="email"
            placeholder={t('authGate.emailPlaceholder')}
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleForgotSubmit()}
            spellCheck={false}
            autoFocus
            autoComplete="email"
          />
          {error && (
            <div role="alert" style={{ fontSize: 11, color: 'var(--red)', marginBottom: 10, marginTop: -2, fontFamily: 'var(--mono)', padding: '8px 12px', background: 'var(--red-bg)', borderRadius: 7, lineHeight: 1.5 }}>
              <InlineIcon kind="alert" size={13} />{error}
            </div>
          )}
          <button
            onClick={handleForgotSubmit}
            disabled={loading}
            style={{ width: '100%', padding: 12, background: 'var(--laton)', color: 'var(--navy)', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, fontFamily: 'var(--sans)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.55 : 1, marginTop: 4, marginBottom: 12 }}
          >
            {loading ? t('authGate.loading') : t('authGate.forgotSubmitBtn')}
          </button>
          <button
            onClick={() => { setForgotMode(false); setError('') }}
            style={{ background: 'none', border: 'none', color: 'var(--th)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--sans)', padding: 0 }}
          >
            {t('authGate.backToLogin')}
          </button>
        </div>
      </div>
    )
  }

  if (emailExists) {
    return (
      <div className="fos-auth-wrap" style={s.wrap}>
        <div className="fos-auth-box" style={s.box}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <Logo size={22} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx)', marginBottom: 8, fontFamily: 'var(--display)' }}>
            {t('authGate.emailExistsTitle')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--tm)', lineHeight: 1.6, marginBottom: 20 }}>
            {t('authGate.emailExistsBody', { email: email.trim() })}
          </div>
          <button
            onClick={() => { setEmailExists(false); setTab('login'); setPassword(''); setError('') }}
            style={{ width: '100%', padding: 12, background: 'var(--laton)', color: 'var(--navy)', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, fontFamily: 'var(--sans)', cursor: 'pointer', marginBottom: 12 }}
          >
            {t('authGate.emailExistsLoginBtn')}
          </button>
          <button
            onClick={() => { setEmailExists(false); setForgotMode(true); setPassword(''); setError('') }}
            style={{ background: 'none', border: 'none', color: 'var(--th)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--sans)', padding: 0 }}
          >
            {t('authGate.forgotLink')}
          </button>
        </div>
      </div>
    )
  }

  if (checkEmail) {
    return (
      <div className="fos-auth-wrap" style={s.wrap}>
        <div className="fos-auth-box" style={s.box}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <Logo size={22} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx)', marginBottom: 8, fontFamily: 'var(--display)' }}>
            {t('authGate.checkEmailTitle')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--tm)', lineHeight: 1.6, marginBottom: 16 }}>
            {t('authGate.checkEmailBody', { email })}
          </div>
          {resendState === 'sent' ? (
            <div style={{ fontSize: 12, color: 'var(--pos)' }}>{t('authGate.resendSent')}</div>
          ) : (
            <button
              onClick={handleResend}
              disabled={resendState === 'sending'}
              style={{ background: 'none', border: 'none', color: 'var(--th)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--sans)', padding: 0 }}
            >
              {t('authGate.resendButton')}
            </button>
          )}
          {resendState === 'error' && (
            <div style={{ fontSize: 12, color: 'var(--neg)', marginTop: 6 }}>{t('authGate.resendError')}</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="fos-auth-wrap" style={s.wrap}>
      <div className="fos-auth-box" style={s.box}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <Logo size={22} />
        </div>

        <h1 style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx)', marginBottom: 6, fontFamily: 'var(--display)' }}>
          {tab === 'signup' ? t('authGate.titleSignup') : t('authGate.title')}
        </h1>
        <div style={{ fontSize: 12, color: 'var(--tm)', lineHeight: 1.6, marginBottom: 20 }}>
          {t('authGate.subtitle')}
        </div>
        {accountDeleted && (
          <div role="status" style={{ fontSize: 13, color: 'var(--tx)', marginBottom: 16, padding: '8px 12px', background: 'var(--sur2)', borderRadius: 7, lineHeight: 1.5 }}>
            {t('deleteAccount.doneNotice')}
          </div>
        )}

        <div role="tablist" aria-label={t('authGate.tabsLabel')} style={{ display: 'flex', gap: 4, background: 'var(--sur2)', borderRadius: 9, padding: 4, marginBottom: 18 }}>
          <button type="button" role="tab" id="authgate-tab-login" style={s.tabBtn(tab === 'login')} aria-selected={tab === 'login'} tabIndex={tab === 'login' ? 0 : -1} onKeyDown={onTabKey} onClick={() => { setTab('login'); setError('') }}>{t('authGate.tabLogin')}</button>
          <button type="button" role="tab" id="authgate-tab-signup" style={s.tabBtn(tab === 'signup')} aria-selected={tab === 'signup'} tabIndex={tab === 'signup' ? 0 : -1} onKeyDown={onTabKey} onClick={() => { setTab('signup'); setError('') }}>{t('authGate.tabSignup')}</button>
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

        <label htmlFor="authgate-email" style={s.label}>{t('authGate.emailLabel')}</label>
        <input
          id="authgate-email"
          style={s.input}
          type="email"
          inputMode="email"
          placeholder={t('authGate.emailPlaceholder')}
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          spellCheck={false}
          autoFocus
          autoComplete="email"
        />
        <label htmlFor="authgate-password" style={s.label}>{t('authGate.passwordLabel')}</label>
        <div style={{ position: 'relative' }}>
          <input
            id="authgate-password"
            style={{ ...s.input, paddingRight: 52 }}
            type={showPassword ? 'text' : 'password'}
            placeholder={tab === 'signup' ? t('authGate.passwordPlaceholderSignup') : ''}
            aria-describedby={tab === 'signup' ? 'authgate-password-hint' : undefined}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            autoCapitalize="none"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            aria-label={showPassword ? t('authGate.hidePassword') : t('authGate.showPassword')}
            aria-pressed={showPassword}
            aria-controls="authgate-password"
            style={{ position: 'absolute', top: 0, right: 0, width: 48, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: 'var(--tm)', cursor: 'pointer', borderRadius: 8 }}
          >
            {showPassword ? <EyeOff size={18} strokeWidth={1.7} aria-hidden="true" /> : <Eye size={18} strokeWidth={1.7} aria-hidden="true" />}
          </button>
        </div>
        {tab === 'signup' && (
          <p id="authgate-password-hint" style={{ fontSize: 12, color: 'var(--tm)', margin: '-4px 0 10px' }}>{t('authGate.passwordPlaceholderSignup')}</p>
        )}

        {tab === 'login' && (
          <button
            onClick={() => { setForgotMode(true); setError('') }}
            style={{ background: 'none', border: 'none', color: 'var(--th)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--sans)', padding: 0, marginBottom: 12, display: 'block' }}
          >
            {t('authGate.forgotLink')}
          </button>
        )}

        {error && (
          <div role="alert" style={{ fontSize: 11, color: 'var(--red)', marginBottom: 10, marginTop: -2, fontFamily: 'var(--mono)', padding: '8px 12px', background: 'var(--red-bg)', borderRadius: 7, lineHeight: 1.5 }}>
            <InlineIcon kind="alert" size={13} />{error}
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

        {tab === 'signup' && <LegalNotice t={t} lang={lang} />}

      </div>
    </div>
  )
}
