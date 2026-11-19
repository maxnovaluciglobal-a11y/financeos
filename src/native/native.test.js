// Lógica pura de la app nativa: plataforma, política de tienda y enlaces.
import { describe, it, expect } from 'vitest'
import { isNativeApp, nativePlatform, apiBase, authEmailRedirect, PUBLIC_APP_URL } from './platform.js'
import { webCheckoutAllowed, storePurchaseAllowed, oauthProviders, NATIVE_FLAGS } from './storePolicy.js'
import { parseNativeUrl, tokensFromHash, INTAKE_PARAMS } from './nativeLinks.js'

const cap = (platform) => ({ Capacitor: { isNativePlatform: () => platform !== 'web', getPlatform: () => platform } })
const web = { location: { origin: 'https://app.moyiq.app', pathname: '/app/' } }

describe('platform', () => {
  it('detecta web, iOS y Android', () => {
    expect(isNativeApp({})).toBe(false)
    expect(nativePlatform({})).toBe('web')
    expect(nativePlatform(cap('web'))).toBe('web')
    expect(nativePlatform(cap('ios'))).toBe('ios')
    expect(nativePlatform(cap('android'))).toBe('android')
  })
  it('no rompe si Capacitor tira', () => {
    expect(isNativeApp({ Capacitor: { isNativePlatform: () => { throw new Error('x') } } })).toBe(false)
  })
  it('API y correos de Auth salen al dominio real en la app nativa', () => {
    expect(apiBase(web)).toBe('')
    expect(apiBase(cap('ios'))).toBe('https://app.moyiq.app')
    expect(authEmailRedirect(web)).toBe('https://app.moyiq.app/app/')
    expect(authEmailRedirect({ ...cap('android'), location: { origin: 'https://localhost', pathname: '/app/' } })).toBe(PUBLIC_APP_URL)
  })
})

describe('storePolicy (App Store 3.1.1 / 4.8, Play pagos)', () => {
  it('el checkout de Stripe solo en la web', () => {
    expect(webCheckoutAllowed('web')).toBe(true)
    expect(webCheckoutAllowed('ios')).toBe(false)
    expect(webCheckoutAllowed('android')).toBe(false)
  })
  it('la compra de la tienda solo con iapReady', () => {
    expect(NATIVE_FLAGS.iapReady).toBe(false)
    expect(storePurchaseAllowed('ios')).toBe(false)
    expect(storePurchaseAllowed('ios', { iapReady: true })).toBe(true)
    expect(storePurchaseAllowed('web', { iapReady: true })).toBe(false)
  })
  it('iOS no muestra Google sin Sign in with Apple', () => {
    expect(oauthProviders('web')).toEqual(['google'])
    expect(oauthProviders('android')).toEqual(['google'])
    expect(oauthProviders('ios')).toEqual([])
    expect(oauthProviders('ios', { appleSignIn: true })).toEqual(['apple', 'google'])
  })
})

describe('parseNativeUrl', () => {
  const path = (u) => parseNativeUrl(u)?.path
  it('moyiq://add arma el mismo ?add= que autoEntry (gasto por defecto, fuente app)', () => {
    expect(path('moyiq://add?monto=12500&comercio=Lider')).toBe('/app/?add=gasto&monto=12500&comercio=Lider&fuente=app')
    expect(path('moyiq://add?add=ingreso&monto=10')).toBe('/app/?add=ingreso&monto=10&fuente=app')
    expect(path('moyiq://add/ingreso?monto=10&fuente=applepay')).toBe('/app/?add=ingreso&monto=10&fuente=applepay')
    expect(INTAKE_PARAMS).toEqual(['add', 'monto', 'comercio', 'moneda', 'fuente', 'fecha'])
  })
  it('descarta parámetros desconocidos', () => {
    expect(path('moyiq://add?monto=1&evil=<x>&redirect=https://x.com')).toBe('/app/?add=gasto&monto=1&fuente=app')
  })
  it('destinos de ?open= y demo', () => {
    expect(path('moyiq://open/import')).toBe('/app/?open=import')
    expect(path('moyiq://app?open=dashboard&x=1')).toBe('/app/?open=dashboard')
    expect(path('moyiq://demo?persona=ve')).toBe('/app/?persona=ve&demo=true')
    expect(path('moyiq://')).toBe('/app/')
  })
  it('enlaces universales solo de app./demo.moyiq.app', () => {
    expect(path('https://app.moyiq.app/app/?add=gasto&monto=5&comercio=Uber')).toBe('/app/?add=gasto&monto=5&comercio=Uber')
    expect(path('https://demo.moyiq.app/app/')).toBe('/app/?demo=true')
    expect(path('https://app.moyiq.app/delete-account')).toBe('/app/')
    expect(parseNativeUrl('https://evil.com/app/?add=gasto')).toBeNull()
    expect(parseNativeUrl('javascript:alert(1)')).toBeNull()
    expect(parseNativeUrl('moyiq://desconocido')).toBeNull()
    expect(parseNativeUrl('')).toBeNull()
    expect(parseNativeUrl('moyiq://add?x=' + 'a'.repeat(3000))).toBeNull()
  })
  it('vuelta de OAuth con code (PKCE) o con tokens en el fragmento', () => {
    expect(parseNativeUrl('moyiq://auth-callback?code=abc')).toEqual({ kind: 'auth', code: 'abc', hash: '' })
    const r = parseNativeUrl('moyiq://auth-callback#access_token=a&refresh_token=b&type=bearer')
    expect(r.kind).toBe('auth')
    expect(tokensFromHash(r.hash)).toEqual({ access_token: 'a', refresh_token: 'b' })
    expect(tokensFromHash('#access_token=a')).toBeNull()
  })
})
