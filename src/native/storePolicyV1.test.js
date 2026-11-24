// Revisión pre-tiendas (23-nov-2026): lo que la app de tienda v1 no muestra.
// Inversiones queda fuera (D1, DECISIONES 23-nov), sin chips PRO (NAT-1),
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

describe('Inversiones fuera de la app de tienda v1', () => {
  it('el flag está apagado', () => {
    expect(NATIVE_FLAGS.investments).toBe(false)
  })
  it('la web siempre la muestra; la app nativa solo con el flag', () => {
    expect(investmentsAllowed('web')).toBe(true)
    expect(investmentsAllowed('ios')).toBe(false)
    expect(investmentsAllowed('android')).toBe(false)
    expect(investmentsAllowed('android', { investments: true })).toBe(true)
    expect(canShowInvestments({})).toBe(true)
    expect(canShowInvestments(cap('ios'))).toBe(false)
    expect(canShowInvestments(cap('android'))).toBe(false)
    expect(canShowInvestments(cap('android'), { investments: true })).toBe(true)
  })
  it('una página de Inversiones abre Inicio en la app nativa', () => {
    for (const p of INVEST_PAGES) {
      expect(storePage(p, {})).toBe(p)
      expect(storePage(p, cap('android'))).toBe('dashboard')
    }
    expect(storePage('budgets', cap('ios'))).toBe('budgets')
  })
  it('moduleOn: encendido en la cuenta, apagado en la app nativa', () => {
    expect(moduleOn(ON, 'investments')).toBe(true)
    setNative('android')
    expect(moduleOn(ON, 'investments')).toBe(false)
    expect(moduleOn(ON, 'properties')).toBe(true)
  })
  it('ni el menú "Más" ni la navegación la muestran en nativo, en ningún país', () => {
    setNative('ios')
    const inv = ALL_ITEMS.find(it => it.id === 'investments')
    for (const cc of ['CL', 'AR', 'VE', 'MX', 'CO', 'US', 'DE']) {
      expect(navItemVisible(inv, cc, ON)).toBe(false)
      const ids = moreSections(cc, ON).flatMap(g => g.items.flatMap(it => [it.id, ...(it.items || []).map(x => x.id)]))
      expect(ids).not.toContain('investments')
    }
  })
  it('el enlace ?open=invest-* se resuelve a la página, que el render cambia por Inicio', () => {
    expect(pageFromSearch('?open=invest-resumen')).toBe('investments')
    expect(storePage(pageFromSearch('?open=invest-resumen'), cap('android'))).toBe('dashboard')
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
  it('sin widget de Turnstile en nativo', () => {
    expect(defaultSiteKey(cap('android'))).toBe('')
    expect(defaultSiteKey(cap('ios'))).toBe('')
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
