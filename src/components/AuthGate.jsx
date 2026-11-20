// src/components/AuthGate.jsx
// Login obligatorio — corre ANTES de LicenseGate. Sin esto, nadie usa la app
// (ni siquiera Starter). Antes del 12-sep-2026 moyiq no tenía ningún
// concepto de cuenta; esto no reemplaza esa arquitectura local-first (los
// datos siguen en IndexedDB, no en el servidor) — solo agrega una identidad
// real (email/contraseña o Google) como puerta de entrada.
import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { InlineIcon } from './icons/SignalIcon.jsx'
import { signUpWithPassword, signInWithPassword, signInWithGoogle, signInWithApple, resetPasswordForEmail, resendSignupConfirmation, MIN_PASSWORD_LENGTH } from '../core/auth.js'
import { nativePlatform, isNativeApp } from '../native/platform.js'
import { NATIVE_OAUTH_ERROR_EVENT } from '../native/nativeLinks.js'
import { oauthProviders } from '../native/storePolicy.js'
import { useT } from '../i18n/useT.js'
import Logo from './Logo.jsx'
import Turnstile from './Turnstile.jsx'
import { isCaptchaError } from '../core/turnstile.js'
import { trackEvent, onceEvent } from '../utils/webAnalytics.js'
import { authTabFromSearch, stashOpenForOAuth, stashOpenForSignup, clearSignupStash, authLinkErrorFrom, bootAuthLinkError, urlWithoutAuthError } from '../utils/deepLink.js'

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
    <p data-testid="authgate-legal" style={{ fontSize: 'var(--t-footnote)', color: 'var(--tm)', lineHeight: 1.6, margin: '12px 0 0', textAlign: 'center' }}>
      {parts.map((part, i) => (
        part === '{terms}' ? <span key={i}>{link(urls.terms, t('authGate.legalTerms'))}</span>
          : part === '{privacy}' ? <span key={i}>{link(urls.privacy, t('authGate.legalPrivacy'))}</span>
            : <span key={i}>{part}</span>
      ))}
    </p>
  )
}

// NAT-5: aviso del canje fallido de Google/Apple en la app nativa (el evento lo
// emite native/bridge.js). Fuera de la app nativa no escucha nada. Devuelve la
// función que deja de escuchar (limpieza del efecto).
export function listenNativeOAuthError(win, t, { setLoading, setError }) {
  if (!isNativeApp() || !win?.addEventListener) return undefined
  const onOAuthError = () => { setLoading(false); setError(t('authGate.errorNativeOAuth')) }
  win.addEventListener(NATIVE_OAUTH_ERROR_EVENT, onOAuthError)
  return () => win.removeEventListener(NATIVE_OAUTH_ERROR_EVENT, onOAuthError)
}

function friendlyError(t, raw) {
  const m = String(raw || '')
  if (isCaptchaError(m)) return t('authGate.errorCaptcha')
  if (/invalid login credentials/i.test(m)) return t('authGate.errorInvalidCredentials')
  if (/already registered|already exists|user already/i.test(m)) return t('authGate.errorEmailExists')
  if (/password.*(least|short|6)/i.test(m)) return t('authGate.errorWeakPassword')
  if (/email not confirmed/i.test(m)) return t('authGate.errorEmailNotConfirmed')
  if (/network|fetch|timeout/i.test(m)) return t('authGate.errorNetwork')
  return t('authGate.errorGeneric')
}

export default function AuthGate({ onAuthenticated }) {
  const { t, lang } = useT()
  // App Store 4.8: en iOS, Google solo junto con Sign in with Apple (native/storePolicy.js).
  const providers = oauthProviders(nativePlatform())
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
  // SEG-7: Turnstile en login, registro, recuperar y reenviar. Sin site key no hace nada.
  const captcha = useRef(null)
  // WEB-N1: signup_start una sola vez por pantalla (los reintentos tras un error no cuentan otra vez).
  const [signupStart] = useState(() => onceEvent('signup_start'))
  const trackSignupStart = (method) => signupStart({ method })
  const captchaWidget = <Turnstile ref={captcha} action="auth" errorText={t('authGate.errorCaptcha')} />
  // C-22: aviso tras borrar la cuenta desde Ajustes (la app recarga y llega acá).
  // La marca se borra al volver a entrar, no al leerla: la app puede montar
  // esta pantalla dos veces (cierre de sesión y recarga).
  const [accountDeleted] = useState(() => {
    try { return sessionStorage.getItem('fnos_account_deleted') === '1' } catch { return false }
  })
  const clearDeletedNotice = () => { try { sessionStorage.removeItem('fnos_account_deleted') } catch { /* almacenamiento o API del navegador no disponible: se sigue sin ello */ } }
  // Enlace de un correo (confirmación, acceso, recuperar contraseña) vencido o
  // ya usado: Supabase vuelve con #error_code=otp_expired. Se avisa en vez de
  // dejar a la persona en el login sin explicación, y se limpia la URL.
  const [linkError, setLinkError] = useState(() => authLinkErrorFrom(window.location.search, window.location.hash) || bootAuthLinkError())
  useEffect(() => {
    try {
      const clean = urlWithoutAuthError(window.location.href)
      if (clean) window.history.replaceState(window.history.state, '', clean)
    } catch { /* almacenamiento o API del navegador no disponible: se sigue sin ello */ }
  }, [])
  // NAT-5: en la app nativa, el canje del inicio con Google/Apple ocurre en
  // native/bridge.js; si falla, avisa acá para que la persona no quede sin respuesta.
  useEffect(() => listenNativeOAuthError(window, t, { setLoading, setError }), [t])

  async function handleSubmit() {
    const cleanEmail = email.trim()
    if (!cleanEmail || !password) { setError(t('authGate.errorMissingFields')); return }
    if (tab === 'signup' && password.length < MIN_PASSWORD_LENGTH) { setError(t('authGate.errorWeakPassword')); return }
    setError('')
    clearDeletedNotice()
    setLinkError(null)
    setLoading(true)
    if (tab === 'signup') { stashOpenForSignup(window.location.search); trackSignupStart('email') }
    const captchaToken = await captcha.current?.getToken()
    const result = tab === 'login'
      ? await signInWithPassword(cleanEmail, password, captchaToken)
      : await signUpWithPassword(cleanEmail, password, lang, captchaToken)
    captcha.current?.reset()
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
      trackEvent('signup_done', { method: 'email' })
      // Confirmación de email requerida — sin sesión todavía, no se puede continuar.
      setCheckEmail(true)
      return
    }
    if (tab === 'signup') trackEvent('signup_done', { method: 'email' })
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
    const captchaToken = await captcha.current?.getToken()
    const result = await resetPasswordForEmail(cleanEmail, captchaToken)
    captcha.current?.reset()
    setLoading(false)
    if (result.error && isCaptchaError(result.error)) { setError(t('authGate.errorCaptcha')); return }
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
    const captchaToken = await captcha.current?.getToken()
    const result = await resendSignupConfirmation(email.trim(), captchaToken)
    captcha.current?.reset()
    setResendState(result.error ? 'error' : 'sent')
  }

  async function handleGoogle() {
    setError('')
    clearDeletedNotice()
    stashOpenForOAuth(window.location.search)
    if (tab === 'signup') trackSignupStart('google')
    const result = await signInWithGoogle()
    if (result.error) setError(friendlyError(t, result.error))
    // Éxito: signInWithGoogle redirige a Google, no hay nada más que hacer acá.
  }

  async function handleApple() {
    setError('')
    clearDeletedNotice()
    stashOpenForOAuth(window.location.search)
    const result = await signInWithApple()
    if (result.error) setError(friendlyError(t, result.error))
  }

  const s = {
    wrap: {
      minHeight: '100dvh', background: 'var(--bg)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'var(--sans)',
    },
    box: {
      background: 'var(--box-bg)', border: 0, borderRadius: 18,
      padding: '40px 36px', maxWidth: 400, width: '100%', boxShadow: 'var(--sh-2)',
    },
    input: {
      width: '100%', padding: '12px 14px', border: '1px solid var(--brd)', borderRadius: 8,
      fontSize: 'var(--t-callout)', fontFamily: 'var(--sans)', background: 'var(--bg)', color: 'var(--tx)',
      marginBottom: 10, boxSizing: 'border-box',
    },
    // PRD-8 (C-39): etiqueta en sans, legible; el ejemplo queda en el placeholder.
    label: {
      fontSize: 'var(--t-subhead)', fontFamily: 'var(--sans)', fontWeight: 600, color: 'var(--tx)',
      display: 'block', marginBottom: 6,
    },
    tabBtn: (active) => ({
      flex: 1, minHeight: 44, padding: '9px', border: 'none', borderRadius: 7,
      background: active ? 'var(--sur)' : 'transparent',
      color: active ? 'var(--tx)' : 'var(--th)',
      fontWeight: active ? 600 : 400, fontSize: 'var(--t-subhead)', cursor: 'pointer',
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
            <div style={{ fontSize: 'var(--t-headline)', fontWeight: 600, color: 'var(--tx)', marginBottom: 8, fontFamily: 'var(--display)' }}>
              {t('authGate.forgotSentTitle')}
            </div>
            <div style={{ fontSize: 'var(--t-subhead)', color: 'var(--tm)', lineHeight: 1.6, marginBottom: 20 }}>
              {t('authGate.forgotSentBody', { email: email.trim() })}
            </div>
            <button
              onClick={() => { setForgotMode(false); setForgotSent(false); setError('') }}
              style={{ background: 'none', border: 'none', color: 'var(--th)', fontSize: 'var(--t-footnote)', cursor: 'pointer', fontFamily: 'var(--sans)', padding: 0 }}
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
          <h1 style={{ fontSize: 'var(--t-headline)', fontWeight: 600, color: 'var(--tx)', marginBottom: 6, fontFamily: 'var(--display)' }}>
            {t('authGate.forgotTitle')}
          </h1>
          <div style={{ fontSize: 'var(--t-footnote)', color: 'var(--tm)', lineHeight: 1.6, marginBottom: 20 }}>
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
            // eslint-disable-next-line jsx-a11y/no-autofocus -- the user just opened the forgot-password form; focus moves into its only field
            autoFocus
            autoComplete="email"
          />
          {captchaWidget}
          {error && (
            <div role="alert" style={{ fontSize: 'var(--t-footnote)', color: 'var(--red)', marginBottom: 10, marginTop: -2, fontFamily: 'var(--sans)', padding: '8px 12px', background: 'var(--red-bg)', borderRadius: 7, lineHeight: 1.5 }}>
              <InlineIcon kind="alert" size={13} />{error}
            </div>
          )}
          <button
            onClick={handleForgotSubmit}
            disabled={loading}
            style={{ width: '100%', padding: 12, background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)', border: 'none', borderRadius: 8, fontSize: 'var(--t-body)', fontWeight: 600, fontFamily: 'var(--sans)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.55 : 1, marginTop: 4, marginBottom: 12 }}
          >
            {loading ? t('authGate.loading') : t('authGate.forgotSubmitBtn')}
          </button>
          <button
            onClick={() => { setForgotMode(false); setError('') }}
            style={{ background: 'none', border: 'none', color: 'var(--th)', fontSize: 'var(--t-footnote)', cursor: 'pointer', fontFamily: 'var(--sans)', padding: 0 }}
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
          <div style={{ fontSize: 'var(--t-headline)', fontWeight: 600, color: 'var(--tx)', marginBottom: 8, fontFamily: 'var(--display)' }}>
            {t('authGate.emailExistsTitle')}
          </div>
          <div style={{ fontSize: 'var(--t-subhead)', color: 'var(--tm)', lineHeight: 1.6, marginBottom: 20 }}>
            {t('authGate.emailExistsBody', { email: email.trim() })}
          </div>
          <button
            onClick={() => { setEmailExists(false); setTab('login'); setPassword(''); setError('') }}
            style={{ width: '100%', padding: 12, background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)', border: 'none', borderRadius: 8, fontSize: 'var(--t-body)', fontWeight: 600, fontFamily: 'var(--sans)', cursor: 'pointer', marginBottom: 12 }}
          >
            {t('authGate.emailExistsLoginBtn')}
          </button>
          <button
            onClick={() => { setEmailExists(false); setForgotMode(true); setPassword(''); setError('') }}
            style={{ background: 'none', border: 'none', color: 'var(--th)', fontSize: 'var(--t-footnote)', cursor: 'pointer', fontFamily: 'var(--sans)', padding: 0 }}
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
          <div style={{ fontSize: 'var(--t-headline)', fontWeight: 600, color: 'var(--tx)', marginBottom: 8, fontFamily: 'var(--display)' }}>
            {t('authGate.checkEmailTitle')}
          </div>
          <div style={{ fontSize: 'var(--t-subhead)', color: 'var(--tm)', lineHeight: 1.6, marginBottom: 16 }}>
            {t('authGate.checkEmailBody', { email })}
          </div>
          {resendState !== 'sent' && captchaWidget}
          {resendState === 'sent' ? (
            <div style={{ fontSize: 'var(--t-footnote)', color: 'var(--pos)' }}>{t('authGate.resendSent')}</div>
          ) : (
            <button
              onClick={handleResend}
              disabled={resendState === 'sending'}
              style={{ background: 'none', border: 'none', color: 'var(--th)', fontSize: 'var(--t-footnote)', cursor: 'pointer', fontFamily: 'var(--sans)', padding: 0 }}
            >
              {t('authGate.resendButton')}
            </button>
          )}
          {resendState === 'error' && (
            <div style={{ fontSize: 'var(--t-footnote)', color: 'var(--neg)', marginTop: 6 }}>{t('authGate.resendError')}</div>
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

        <h1 style={{ fontSize: 'var(--t-headline)', fontWeight: 600, color: 'var(--tx)', marginBottom: 6, fontFamily: 'var(--display)' }}>
          {tab === 'signup' ? t('authGate.titleSignup') : t('authGate.title')}
        </h1>
        <div style={{ fontSize: 'var(--t-footnote)', color: 'var(--tm)', lineHeight: 1.6, marginBottom: 20 }}>
          {t('authGate.subtitle')}
        </div>
        {linkError && (
          <div role="alert" data-testid="authgate-link-expired" style={{ fontSize: 'var(--t-subhead)', color: 'var(--tx)', marginBottom: 16, padding: '8px 12px', background: 'var(--sur2)', borderRadius: 7, lineHeight: 1.5 }}>
            {t('authGate.linkExpired')}
          </div>
        )}
        {accountDeleted && (
          <div role="status" style={{ fontSize: 'var(--t-subhead)', color: 'var(--tx)', marginBottom: 16, padding: '8px 12px', background: 'var(--sur2)', borderRadius: 7, lineHeight: 1.5 }}>
            {t('deleteAccount.doneNotice')}
          </div>
        )}

        <div role="tablist" aria-label={t('authGate.tabsLabel')} style={{ display: 'flex', gap: 4, background: 'var(--sur2)', borderRadius: 9, padding: 4, marginBottom: 18 }}>
          <button type="button" role="tab" id="authgate-tab-login" style={s.tabBtn(tab === 'login')} aria-selected={tab === 'login'} tabIndex={tab === 'login' ? 0 : -1} onKeyDown={onTabKey} onClick={() => { setTab('login'); setError('') }}>{t('authGate.tabLogin')}</button>
          <button type="button" role="tab" id="authgate-tab-signup" style={s.tabBtn(tab === 'signup')} aria-selected={tab === 'signup'} tabIndex={tab === 'signup' ? 0 : -1} onKeyDown={onTabKey} onClick={() => { setTab('signup'); setError('') }}>{t('authGate.tabSignup')}</button>
        </div>

        {providers.includes('apple') && (
          <button
            type="button"
            onClick={handleApple}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: 11, borderRadius: 8, border: 0, background: 'var(--tx)',
              color: 'var(--bg)', fontSize: 'var(--t-subhead)', fontWeight: 600, cursor: 'pointer', marginBottom: 10,
              fontFamily: 'var(--sans)',
            }}
          >
            <svg width="14" height="16" viewBox="0 0 814 1000" aria-hidden="true" fill="currentColor">
              <path d="M788 341c-6 4-108 62-108 190 0 148 130 200 134 202-1 3-21 72-69 142-43 62-88 123-156 123s-86-40-164-40c-77 0-104 41-167 41s-106-57-156-127C44 790 0 668 0 553 0 366 121 267 241 267c63 0 116 42 156 42 38 0 97-44 169-44 27 0 126 2 192 76zM554 160c31-37 53-88 53-139 0-7-1-14-2-20-50 2-110 34-146 76-28 32-55 83-55 135 0 8 1 16 2 18 3 1 9 2 14 2 45 0 101-30 134-72z"/>
            </svg>
            {t('authGate.appleBtn')}
          </button>
        )}
        {providers.includes('google') && (
          <button
            type="button"
            onClick={handleGoogle}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: 11, borderRadius: 8, border: 0, background: 'var(--bg)',
              color: 'var(--tx)', fontSize: 'var(--t-subhead)', fontWeight: 600, cursor: 'pointer', marginBottom: 14,
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
        )}

        {providers.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--brd)' }} />
            <span style={{ fontFamily: 'var(--sans)', fontSize: 'var(--t-footnote)', color: 'var(--th)' }}>{t('authGate.dividerEmail')}</span>
            <div style={{ flex: 1, height: 1, background: 'var(--brd)' }} />
          </div>
        )}

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
          // eslint-disable-next-line jsx-a11y/no-autofocus -- the sign-in screen exists only to enter the email; focus goes straight to its first field
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
          <p id="authgate-password-hint" style={{ fontSize: 'var(--t-footnote)', color: 'var(--tm)', margin: '-4px 0 10px' }}>{t('authGate.passwordPlaceholderSignup')}</p>
        )}

        {tab === 'login' && (
          <button
            onClick={() => { setForgotMode(true); setError('') }}
            style={{ background: 'none', border: 'none', color: 'var(--th)', fontSize: 'var(--t-footnote)', cursor: 'pointer', fontFamily: 'var(--sans)', padding: 0, marginBottom: 12, display: 'block' }}
          >
            {t('authGate.forgotLink')}
          </button>
        )}

        {captchaWidget}

        {error && (
          <div role="alert" style={{ fontSize: 'var(--t-footnote)', color: 'var(--red)', marginBottom: 10, marginTop: -2, fontFamily: 'var(--sans)', padding: '8px 12px', background: 'var(--red-bg)', borderRadius: 7, lineHeight: 1.5 }}>
            <InlineIcon kind="alert" size={13} />{error}
          </div>
        )}

        <button
          style={{
            width: '100%', padding: 12, background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)', border: 'none',
            borderRadius: 8, fontSize: 'var(--t-body)', fontWeight: 600, fontFamily: 'var(--sans)',
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.55 : 1, transition: 'opacity .15s',
            marginTop: 4,
          }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? t('authGate.loading') : (tab === 'login' ? t('authGate.loginBtn') : t('authGate.signupBtn'))}
        </button>

        {tab === 'signup' && <LegalNotice t={t} lang={lang} />}

        {/* NAT-3: en la app de tienda, el demo sin cuenta (lo usa la revisión de Apple/Google). */}
        {isNativeApp() && (
          <a
            href="/app/?demo=true"
            data-testid="authgate-native-demo"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, marginTop: 14, borderRadius: 8, border: '1px solid var(--brd)', color: 'var(--tx)', fontSize: 'var(--t-subhead)', fontWeight: 600, fontFamily: 'var(--sans)', textDecoration: 'none' }}
          >
            {t('authGate.nativeDemoBtn')}
          </a>
        )}

      </div>
    </div>
  )
}
