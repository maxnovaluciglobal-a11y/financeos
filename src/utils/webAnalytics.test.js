import { describe, it, expect } from 'vitest'
import { makeBeforeSend, isInternalEmail, markInternalUser, installWebAnalytics, INTERNAL_KEY, sourceFromVisit, captureFirstTouch, firstTouchSource, applyInternalParam, trackEvent, cleanLabel, FIRST_TOUCH_KEY } from './webAnalytics.js'
import { checkoutPlan } from './pricing.js'
import { isAccountKey } from '../core/deviceOwner.js'

const store = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) } }

describe('Vercel Web Analytics en la app (C-14)', () => {
  it('quita parámetros (tokens, session_id) y el hash; deja utm_* y ref', () => {
    const bs = makeBeforeSend({ nav: {}, win: {}, storage: store() })
    const out = bs({ type: 'pageview', url: 'https://app.moyiq.app/app/?open=upgrade&ref=nurture&utm_source=mail&session_id=cs_x&t=abc#privacy' })
    expect(out.url).toBe('https://app.moyiq.app/app/?ref=nurture&utm_source=mail')
  })
  it('no mide con No rastrear, GPC, el botón de exclusión ni en cuentas internas', () => {
    const ev = { url: 'https://app.moyiq.app/app/' }
    expect(makeBeforeSend({ nav: { doNotTrack: '1' }, win: {}, storage: store() })(ev)).toBe(null)
    expect(makeBeforeSend({ nav: { globalPrivacyControl: true }, win: {}, storage: store() })(ev)).toBe(null)
    expect(makeBeforeSend({ nav: {}, win: {}, storage: store({ 'va-disable': '1' }) })(ev)).toBe(null)
    expect(makeBeforeSend({ nav: {}, win: {}, storage: store({ [INTERNAL_KEY]: '1' }) })(ev)).toBe(null)
  })
  it('marca las cuentas internas con el mismo patrón que la columna is_internal', () => {
    expect(isInternalEmail('maxnovaluciglobal@gmail.com')).toBe(true)
    expect(isInternalEmail('qa.test2@foo.co')).toBe(true)
    expect(isInternalEmail('celeste@gmail.com')).toBe(false)
    expect(isInternalEmail('testimonios@cliente.cl')).toBe(false)
    const st = store(); markInternalUser('walterlamadriz@gmail.com', st); expect(st.getItem(INTERNAL_KEY)).toBe('1')
    markInternalUser('ana@gmail.com', st); expect(st.getItem(INTERNAL_KEY)).toBe(null)
  })
  it('solo se instala en los dominios de producción y si el script existe', async () => {
    expect(await installWebAnalytics({ location: { hostname: 'localhost' } })).toBe(false)
    const mk = (ok, ct) => {
      const appended = []
      const win = { location: { hostname: 'app.moyiq.app' }, navigator: {}, localStorage: store(), fetch: async () => ({ ok, headers: { get: () => ct } }), document: { createElement: () => ({}), head: { appendChild: (s) => appended.push(s) } } }
      return { win, appended }
    }
    const a = mk(true, 'application/javascript; charset=utf-8')
    expect(await installWebAnalytics(a.win)).toBe(true)
    expect(a.appended[0].src).toBe('/_vercel/insights/script.js')
    expect(a.win.vaq[0][0]).toBe('beforeSend')
    const b = mk(false, 'text/plain')
    expect(await installWebAnalytics(b.win)).toBe(false)
    expect(b.appended).toHaveLength(0)
  })
})

describe('Eventos de conversión sin datos personales (WEB-N1, V-WEB-FN1)', () => {
  it('el origen sale de ref, si no de utm_source(+campaña), si no del dominio de origen externo, si no directo', () => {
    expect(sourceFromVisit('?signup&ref=guia-cl', 'https://moyiq.app/')).toBe('guia-cl')
    expect(sourceFromVisit('?utm_source=Instagram&utm_campaign=Nov 26', '')).toBe('instagram_nov-26')
    expect(sourceFromVisit('?utm_source=newsletter', '')).toBe('newsletter')
    expect(sourceFromVisit('', 'https://www.google.com/search?q=presupuesto')).toBe('google.com')
    expect(sourceFromVisit('', 'https://moyiq.app/blog/x')).toBe('directo')
    expect(sourceFromVisit('', 'https://demo.moyiq.app/app/')).toBe('directo')
    expect(sourceFromVisit('', '')).toBe('directo')
  })
  it('la etiqueta no puede llevar un correo ni texto largo', () => {
    expect(cleanLabel('ana@gmail.com')).toBe(null)
    expect(sourceFromVisit('?ref=ana%40gmail.com', '')).toBe('directo')
    expect(cleanLabel('x'.repeat(80))).toHaveLength(40)
    expect(cleanLabel('   ')).toBe(null)
  })
  it('guarda la primera visita en el dispositivo; directo no pisa un origen real, y vence a los 90 días', () => {
    const st = store()
    expect(captureFirstTouch({ search: '?ref=guia-mx', referrer: '', storage: st, now: 1000 })).toBe('guia-mx')
    expect(captureFirstTouch({ search: '', referrer: '', storage: st, now: 2000 })).toBe('guia-mx')
    expect(captureFirstTouch({ search: '?ref=otra', referrer: '', storage: st, now: 3000 })).toBe('guia-mx')
    expect(firstTouchSource(st)).toBe('guia-mx')
    const st2 = store()
    captureFirstTouch({ search: '', referrer: '', storage: st2, now: 1000 })
    expect(captureFirstTouch({ search: '?ref=guia-co', referrer: '', storage: st2, now: 2000 })).toBe('guia-co')
    const day = 24 * 60 * 60 * 1000
    expect(captureFirstTouch({ search: '?ref=nueva', referrer: '', storage: st2, now: 2000 + 91 * day })).toBe('nueva')
    expect(JSON.parse(st2.getItem(FIRST_TOUCH_KEY))).toEqual({ src: 'nueva', at: 2000 + 91 * day })
  })
  it('sin almacenamiento o con basura guardada, el origen es directo y nada se rompe', () => {
    const throwing = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') } }
    expect(captureFirstTouch({ search: '?ref=a', referrer: '', storage: throwing })).toBe('a')
    expect(firstTouchSource(throwing)).toBe('directo')
    expect(firstTouchSource(store({ [FIRST_TOUCH_KEY]: '{no json' }))).toBe('directo')
  })
  it('el origen es del dispositivo, no de la cuenta', () => {
    expect(isAccountKey(FIRST_TOUCH_KEY)).toBe(false)
  })
  it('?interno=1 apaga la medición en este navegador y ?interno=0 la vuelve a prender', () => {
    const st = store()
    applyInternalParam('?interno=1', st)
    expect(st.getItem('va-disable')).toBe('1')
    expect(makeBeforeSend({ nav: {}, win: {}, storage: st })({ type: 'event', url: 'https://app.moyiq.app/app/' })).toBe(null)
    applyInternalParam('?signup', st)
    expect(st.getItem('va-disable')).toBe('1')
    applyInternalParam('?interno=0', st)
    expect(st.getItem('va-disable')).toBe(null)
  })
  it('trackEvent manda el nombre, el origen y una sola propiedad corta; nada fuera de la lista ni sin va', () => {
    const calls = []
    const win = { va: (...a) => calls.push(a), localStorage: store({ [FIRST_TOUCH_KEY]: JSON.stringify({ src: 'guia-cl', at: Date.now() }) }) }
    expect(trackEvent('checkout_start', { plan: 'annual_trial', extra: 'no' }, win)).toBe(true)
    expect(calls[0]).toEqual(['event', { name: 'checkout_start', data: { src: 'guia-cl', plan: 'annual_trial' } }])
    expect(trackEvent('demo_gate_pass', undefined, win)).toBe(true)
    expect(calls[1][1].data).toEqual({ src: 'guia-cl' })
    expect(trackEvent('email_typed', { email: 'a@b.co' }, win)).toBe(false)
    expect(trackEvent('signup_done', {}, { localStorage: store() })).toBe(false)
    expect(calls).toHaveLength(2)
  })
  it('installWebAnalytics guarda el origen y aplica ?interno= antes de medir', async () => {
    const st = store()
    const win = { location: { hostname: 'app.moyiq.app', search: '?signup&ref=guia-ar&interno=1' }, navigator: {}, localStorage: st, document: { referrer: 'https://moyiq.app/', createElement: () => ({}), head: { appendChild: () => {} } }, fetch: async () => ({ ok: false, headers: { get: () => '' } }) }
    await installWebAnalytics(win)
    expect(firstTouchSource(st)).toBe('guia-ar')
    expect(st.getItem('va-disable')).toBe('1')
  })
  it('la etiqueta del plan dice si el checkout lleva la prueba', () => {
    const on = { trialEnabled: true, trialCheckoutUrl: 'https://buy.stripe.com/m', trialCheckoutUrlAnnual: 'https://buy.stripe.com/a' }
    expect(checkoutPlan('annual', on)).toBe('annual_trial')
    expect(checkoutPlan('monthly', on)).toBe('monthly_trial')
    expect(checkoutPlan('monthly', { ...on, trialEnabled: false })).toBe('monthly')
  })
})
