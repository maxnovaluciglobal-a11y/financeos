// AuthGate (C-31 de la auditoría 360, UXP-2/SEG-7): abre en "Crear cuenta" con
// ?signup, el título cambia con la pestaña, el registro informa Términos y
// Privacidad con enlaces y la contraseña nueva pide 8 caracteres.
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('../i18n/useT.js', async () => {
  const { translate } = await import('../i18n/translate.js')
  const useT = () => {
    const lang = globalThis.__TEST_LANG || 'es'
    return { t: (key, vars) => translate(lang, key, vars), lang }
  }
  return { useT, useTFor: useT }
})
vi.mock('../core/auth.js', () => ({
  MIN_PASSWORD_LENGTH: 8,
  signUpWithPassword: vi.fn(), signInWithPassword: vi.fn(), signInWithGoogle: vi.fn(),
  resetPasswordForEmail: vi.fn(), resendSignupConfirmation: vi.fn(),
}))

const { loadLang } = await import('../i18n/langCache.js')
const { translate } = await import('../i18n/translate.js')
const { default: AuthGate, legalUrls, listenNativeOAuthError, LegalNotice } = await import('./AuthGate.jsx')
const { NATIVE_OAUTH_ERROR_EVENT } = await import('../native/nativeLinks.js')

const render = (lang, search = '', hash = '') => {
  globalThis.__TEST_LANG = lang
  globalThis.window = { location: { search, hash } }
  return renderToStaticMarkup(createElement(AuthGate, { onAuthenticated() {} }))
}

beforeAll(async () => { await Promise.all(['en', 'pt', 'de'].map(loadLang)) })
afterEach(() => { delete globalThis.window })

describe('AuthGate', () => {
  it.each(['es', 'en', 'pt', 'de'])('%s: con ?signup abre en registro, con título de registro y aviso legal enlazado', (lang) => {
    const html = render(lang, '?signup')
    expect(html).toContain(translate(lang, 'authGate.titleSignup'))
    expect(html).not.toContain(`>${translate(lang, 'authGate.title')}<`)
    const { terms, privacy } = legalUrls(lang)
    expect(html).toContain(`href="${terms}"`)
    expect(html).toContain(`href="${privacy}"`)
    expect(html).toContain(translate(lang, 'authGate.legalPrivacy'))
    expect(html).not.toMatch(/\{terms\}|\{privacy\}/)
    expect(html).toContain(translate(lang, 'authGate.passwordPlaceholderSignup'))
    expect(translate(lang, 'authGate.passwordPlaceholderSignup')).toMatch(/8/)
    expect(translate(lang, 'authGate.errorWeakPassword')).toMatch(/8/)
  })

  it('sin parámetro abre en iniciar sesión, sin aviso de registro', () => {
    const html = render('es')
    expect(html).toContain(translate('es', 'authGate.title'))
    expect(html).not.toContain('data-testid="authgate-legal"')
  })

  it('#signup y ?open=signup también abren el registro', () => {
    expect(render('es', '', '#signup')).toContain('data-testid="authgate-legal"')
    expect(render('es', '?open=signup&ref=diagnostico')).toContain('data-testid="authgate-legal"')
  })

  it('los enlaces legales apuntan a páginas publicadas de moyiq.app', () => {
    for (const lang of ['es', 'en', 'pt', 'de', 'xx']) {
      const u = legalUrls(lang)
      expect(u.terms).toMatch(/^https:\/\/moyiq\.app\/(en\/)?terms\.html$/)
      expect(u.privacy).toMatch(/^https:\/\/moyiq\.app\/(en\/)?privacy\.html$/)
    }
  })
})

describe('AuthGate: enlace vencido o ya usado (auditoría de correos 18-nov-2026)', () => {
  it.each(['es', 'en', 'pt', 'de'])('%s: con #error_code=otp_expired avisa que el enlace venció', (lang) => {
    const html = render(lang, '', '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')
    expect(html).toContain('data-testid="authgate-link-expired"')
    expect(html).toContain('role="alert"')
    expect(html).toContain(translate(lang, 'authGate.linkExpired'))
    expect(translate(lang, 'authGate.linkExpired')).not.toBe('authGate.linkExpired')
  })

  it('también con error=access_denied en la query (PKCE)', () => {
    expect(render('es', '?error=access_denied')).toContain('El enlace venció o ya se usó. Pide uno nuevo.')
  })

  it('sin error en la URL no muestra el aviso', () => {
    expect(render('es')).not.toContain('authgate-link-expired')
    expect(render('es', '', '#signup')).not.toContain('authgate-link-expired')
  })
})

describe('AuthGate: botón "Ver el demo" solo en la app nativa (NAT-3)', () => {
  afterEach(() => { delete globalThis.Capacitor })

  it.each(['es', 'en', 'pt', 'de'])('%s: en la app nativa ofrece el demo sin cuenta', (lang) => {
    globalThis.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' }
    const html = render(lang)
    expect(html).toContain('data-testid="authgate-native-demo"')
    expect(html).toContain('href="/app/?demo=true"')
    expect(html).toContain(translate(lang, 'authGate.nativeDemoBtn'))
    expect(translate(lang, 'authGate.nativeDemoBtn')).not.toBe('authGate.nativeDemoBtn')
    expect(translate(lang, 'authGate.errorNativeOAuth')).not.toBe('authGate.errorNativeOAuth')
  })

  it('en la web no aparece', () => {
    expect(render('es')).not.toContain('authgate-native-demo')
  })
})

describe('AuthGate: aviso cuando falla el inicio con Google/Apple en la app nativa (NAT-5)', () => {
  afterEach(() => { delete globalThis.Capacitor })
  const fakeWindow = () => new EventTarget()
  const fire = (win) => win.dispatchEvent(new CustomEvent(NATIVE_OAUTH_ERROR_EVENT, { detail: { error: 'bad_code_verifier' } }))

  it.each(['es', 'en', 'pt', 'de'])('%s: al recibir el evento del puente corta la espera y muestra el error traducido', (lang) => {
    globalThis.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' }
    const win = fakeWindow()
    const setLoading = vi.fn()
    const setError = vi.fn()
    const stop = listenNativeOAuthError(win, (key) => translate(lang, key), { setLoading, setError })
    fire(win)
    expect(setLoading).toHaveBeenCalledWith(false)
    const shown = setError.mock.calls[0][0]
    expect(shown).toBe(translate(lang, 'authGate.errorNativeOAuth'))
    expect(shown).not.toBe('authGate.errorNativeOAuth')
    stop()
    fire(win)
    expect(setError).toHaveBeenCalledTimes(1)
  })

  it('en la web no escucha el evento', () => {
    const win = fakeWindow()
    const setError = vi.fn()
    expect(listenNativeOAuthError(win, (k) => k, { setLoading: vi.fn(), setError })).toBeUndefined()
    fire(win)
    expect(setError).not.toHaveBeenCalled()
  })
})

describe('LegalNotice en la app de tienda (F14, ronda 3)', () => {
  it('abre Términos y Privacidad dentro de la app, sin enlazar a la landing (que muestra precios)', () => {
    const t = (k) => translate('es', k)
    const html = renderToStaticMarkup(createElement(LegalNotice, { t, lang: 'es', native: true }))
    expect(html).toContain('data-testid="authgate-legal-terms"')
    expect(html).toContain('data-testid="authgate-legal-privacy"')
    expect(html).not.toContain('moyiq.app/')
    const web = renderToStaticMarkup(createElement(LegalNotice, { t, lang: 'es', native: false }))
    expect(web).toContain('href="https://moyiq.app/terms.html"')
  })
})

