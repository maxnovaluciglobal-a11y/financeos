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
const { default: AuthGate, legalUrls } = await import('./AuthGate.jsx')

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
