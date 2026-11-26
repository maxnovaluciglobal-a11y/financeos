// Revisión pre-tiendas (23-nov-2026): lo que la app de tienda v1 no muestra.
// Inversiones salió fuera (D1, 23-nov) y se encendió el 26-nov-2026; sin chips PRO (NAT-1),
// sin widget de Turnstile (V-NAT FN-1) y con textos propios (@native).
import { describe, it, expect, afterEach } from 'vitest'
import { NATIVE_FLAGS, investmentsAllowed, canShowInvestments, storePage, canShowProMarketing, INVEST_PAGES } from './storePolicy.js'
import { moduleOn } from '../utils/modules.js'
import { showProChip, moreSections, navItemVisible, ALL_ITEMS } from '../components/layout/navConfig.js'
import { pageFromSearch } from '../utils/deepLink.js'
import { translate, NATIVE_SUFFIX } from '../i18n/translate.js'
import { appHelpHref, SUPPORT_MAILTO } from '../utils/landingUrls.js'
import { defaultSiteKey } from '../components/Turnstile.jsx'

const cap = (platform) => ({ Capacitor: { isNativePlatform: () => platform !== 'web', getPlatform: () => platform } })
const ON = { modules: { investments: true, properties: true, advisor: true } }
const setNative = (platform) => { globalThis.Capacitor = cap(platform).Capacitor }
afterEach(() => { delete globalThis.Capacitor })

describe('Inversiones en la app de tienda (encendida el 26-nov-2026, desde la 1.0.6)', () => {
  it('el flag está encendido', () => {
    expect(NATIVE_FLAGS.investments).toBe(true)
  })
  it('el interruptor sigue funcionando en los dos sentidos', () => {
    expect(investmentsAllowed('web')).toBe(true)
    expect(investmentsAllowed('ios')).toBe(true)
    expect(investmentsAllowed('android')).toBe(true)
    expect(investmentsAllowed('android', { investments: false })).toBe(false)
    expect(investmentsAllowed('web', { investments: false })).toBe(true)
    expect(canShowInvestments({})).toBe(true)
    expect(canShowInvestments(cap('android'))).toBe(true)
    expect(canShowInvestments(cap('ios'), { investments: false })).toBe(false)
  })
  it('una página de Inversiones se abre igual en la web y en la app nativa', () => {
    for (const p of INVEST_PAGES) {
      expect(storePage(p, {})).toBe(p)
      expect(storePage(p, cap('android'))).toBe(p)
    }
    expect(storePage('budgets', cap('ios'))).toBe('budgets')
  })
  it('moduleOn: el módulo encendido en la cuenta también vale en la app nativa', () => {
    setNative('android')
    expect(moduleOn(ON, 'investments')).toBe(true)
    expect(moduleOn({ modules: { investments: false } }, 'investments')).toBe(false)
  })
  it('el menú "Más" la muestra en nativo cuando el módulo está encendido', () => {
    setNative('android')
    const inv = ALL_ITEMS.find(it => it.id === 'investments')
    for (const cc of ['CL', 'AR', 'MX', 'US']) {
      expect(navItemVisible(inv, cc, ON)).toBe(true)
      const ids = moreSections(cc, ON).flatMap(g => g.items.flatMap(it => [it.id, ...(it.items || []).map(x => x.id)]))
      expect(ids).toContain('investments')
    }
  })
  it('el enlace ?open=invest-* abre Inversiones también en la app nativa', () => {
    expect(storePage(pageFromSearch('?open=invest-resumen'), cap('android'))).toBe('investments')
  })
})

describe('NAT-1: sin chips PRO en la app de tienda', () => {
  it('la web los muestra a quien no es Pro; la app nativa nunca', () => {
    const item = { proOnly: true }
    expect(showProChip(item, 'starter', {})).toBe(true)
    expect(showProChip(item, 'starter', cap('android'))).toBe(false)
    expect(showProChip(item, 'starter', cap('ios'))).toBe(false)
    expect(canShowProMarketing(cap('ios'), { iapReady: true })).toBe(true)
  })
})

describe('Ayuda y Turnstile en la app de tienda', () => {
  it('Ayuda escribe a soporte en vez de abrir la landing (con precios)', () => {
    expect(appHelpHref('es', true)).toBe(SUPPORT_MAILTO)
    expect(appHelpHref('es', false)).toMatch(/^https:\/\/moyiq\.app\//)
  })
  it('Turnstile en nativo solo con el origen native.moyiq.app (captcha de Supabase Auth)', () => {
    const at = (p, origin) => ({ ...cap(p), location: new URL(origin) })
    const K = '0xSITEKEY'
    expect(defaultSiteKey(at('android', 'https://native.moyiq.app/app/'), K)).toBe(K)
    expect(defaultSiteKey(at('ios', 'capacitor://native.moyiq.app/app/'), K)).toBe(K)
    expect(defaultSiteKey({ location: new URL('https://app.moyiq.app/app/') }, K)).toBe(K)
    // Otro hostname (recarga en vivo, compilación vieja): Cloudflare rechazaría el widget.
    expect(defaultSiteKey(at('android', 'https://localhost/app/'), K)).toBe('')
    expect(defaultSiteKey(at('ios', 'capacitor://localhost/app/'), K)).toBe('')
    expect(defaultSiteKey(cap('ios'), K)).toBe('')
  })
})

describe('textos @native', () => {
  it('ganan en la app nativa y no en la web', () => {
    expect(translate('es', 'pro.demo.strip', { days: 14 }, false)).toMatch(/14 días/)
    expect(translate('es', 'pro.demo.strip', { days: 14 }, true)).not.toMatch(/prueba|días/)
    expect(translate('es', 'settings.sync.noLicense', null, true)).not.toMatch(/clave|licencia/i)
    expect(translate('es', 'imp.upload.drop', null, true)).not.toMatch(/clic/)
    expect(NATIVE_SUFFIX).toBe('@native')
  })
  it('detecta la app nativa sola (globalThis.Capacitor)', () => {
    setNative('android')
    expect(translate('es', 'imp.upload.formats', { max: 5 })).not.toMatch(/pdf|beta/i)
  })
})
