import { describe, it, expect } from 'vitest'
import { makeBeforeSend, isInternalEmail, markInternalUser, installWebAnalytics, INTERNAL_KEY, sourceFromVisit, rememberVisitSource, visitSource, isOptedOut, applyInternalParam, trackEvent, cleanLabel, isNewGoogleAccount, trackOAuthSignupDone, resetOAuthSignupForTests, onceEvent } from './webAnalytics.js'
import { checkoutPlan, checkoutPlanForHref } from './pricing.js'
import { bootIsAuthReturn } from './deepLink.js'

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
    expect(sourceFromVisit('', 'https://moyiq.app/blog/x')).toBe('web')
    expect(sourceFromVisit('', 'https://app.moyiq.app/app/')).toBe('directo')
    expect(sourceFromVisit('', 'https://demo.moyiq.app/app/')).toBe('directo')
    expect(sourceFromVisit('', '')).toBe('directo')
  })
  it('la etiqueta no puede llevar un correo ni texto largo', () => {
    expect(cleanLabel('ana@gmail.com')).toBe(null)
    expect(sourceFromVisit('?ref=ana%40gmail.com', '')).toBe('directo')
    expect(cleanLabel('x'.repeat(80))).toHaveLength(40)
    expect(cleanLabel('   ')).toBe(null)
  })
  it('el origen de la visita vive solo en memoria: nada se escribe en el dispositivo', () => {
    const win = {}
    expect(visitSource(win)).toBe('directo')
    expect(rememberVisitSource(win, '?ref=guia-mx', '')).toBe('guia-mx')
    expect(visitSource(win)).toBe('guia-mx')
    expect(visitSource({})).toBe('directo')
    expect(rememberVisitSource(null, '?ref=a', '')).toBe(null)
  })
  it('la exclusión es la misma para visitas y eventos', () => {
    expect(isOptedOut({ nav: {}, win: {}, storage: store() })).toBe(false)
    expect(isOptedOut({ nav: { doNotTrack: '1' }, win: {}, storage: store() })).toBe(true)
    expect(isOptedOut({ nav: { globalPrivacyControl: true }, win: {}, storage: store() })).toBe(true)
    expect(isOptedOut({ nav: {}, win: { doNotTrack: '1' }, storage: store() })).toBe(true)
    expect(isOptedOut({ nav: {}, win: {}, storage: store({ 'va-disable': '1' }) })).toBe(true)
    expect(isOptedOut({ nav: {}, win: {}, storage: store({ [INTERNAL_KEY]: '1' }) })).toBe(true)
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
    const win = { va: (...a) => calls.push(a), navigator: {}, localStorage: store() }
    rememberVisitSource(win, '?ref=guia-cl', '')
    expect(trackEvent('checkout_start', { plan: 'annual_trial', extra: 'no' }, win)).toBe(true)
    expect(calls[0]).toEqual(['event', { name: 'checkout_start', data: { src: 'guia-cl', plan: 'annual_trial' } }])
    expect(trackEvent('demo_gate_pass', undefined, win)).toBe(true)
    expect(calls[1][1].data).toEqual({ src: 'guia-cl' })
    expect(trackEvent('email_typed', { email: 'a@b.co' }, win)).toBe(false)
    expect(trackEvent('signup_done', {}, { localStorage: store() })).toBe(false)
    expect(calls).toHaveLength(2)
  })
  it('signup_start cuenta una vez por pantalla aunque se reintente el envío', () => {
    const calls = []
    const once = onceEvent('signup_start', (...a) => { calls.push(a); return true })
    expect(once({ method: 'email' })).toBe(true)
    expect(once({ method: 'email' })).toBe(false)
    expect(once({ method: 'google' })).toBe(false)
    expect(calls).toEqual([['signup_start', { method: 'email' }]])
    const other = onceEvent('signup_start', (...a) => { calls.push(a); return true })
    expect(other({ method: 'google' })).toBe(true)
  })
  it('con No rastrear, GPC o va-disable trackEvent no encola nada', () => {
    for (const extra of [{ navigator: { doNotTrack: '1' } }, { navigator: { globalPrivacyControl: true } }, { localStorage: store({ 'va-disable': '1' }) }]) {
      const calls = []
      const win = { va: (...a) => calls.push(a), navigator: {}, localStorage: store(), ...extra }
      expect(trackEvent('signup_start', { method: 'email' }, win)).toBe(false)
      expect(calls).toHaveLength(0)
    }
  })
  const mkWin = (search, extra = {}) => {
    const st = store()
    const win = { location: { hostname: 'app.moyiq.app', search }, navigator: {}, localStorage: st, document: { referrer: 'https://www.google.com/', createElement: () => ({}), head: { appendChild: () => {} } }, fetch: async () => ({ ok: false, headers: { get: () => '' } }), ...extra }
    const writes = []
    const set = st.setItem
    st.setItem = (k, v) => { writes.push(k); set(k, v) }
    return { win, st, writes }
  }
  it('installWebAnalytics aplica ?interno= y recuerda el origen sin escribir nada más', async () => {
    const a = mkWin('?signup&ref=guia-ar')
    await installWebAnalytics(a.win)
    expect(visitSource(a.win)).toBe('guia-ar')
    expect(a.writes).toEqual([])
    const b = mkWin('?signup&ref=guia-ar&interno=1')
    await installWebAnalytics(b.win)
    expect(b.st.getItem('va-disable')).toBe('1')
    expect(b.writes).toEqual(['va-disable'])
    expect(visitSource(b.win)).toBe('directo')
  })
  it('con No rastrear o GPC no se calcula ni se guarda el origen', async () => {
    for (const nav of [{ doNotTrack: '1' }, { globalPrivacyControl: true }]) {
      const c = mkWin('?ref=guia-cl', { navigator: nav })
      await installWebAnalytics(c.win)
      expect(visitSource(c.win)).toBe('directo')
      expect(c.writes).toEqual([])
    }
  })
  it('signup_done con Google: solo una cuenta nueva de Google, al volver de Auth y una vez', () => {
    const now = Date.parse('2026-11-19T12:00:00Z')
    const fresh = { app_metadata: { provider: 'google' }, created_at: '2026-11-19T11:58:00Z', last_sign_in_at: '2026-11-19T11:58:01Z' }
    expect(isNewGoogleAccount(fresh, now)).toBe(true)
    expect(isNewGoogleAccount({ ...fresh, app_metadata: { provider: 'email' } }, now)).toBe(false)
    expect(isNewGoogleAccount({ ...fresh, created_at: '2026-11-01T10:00:00Z' }, now)).toBe(false)
    expect(isNewGoogleAccount({ ...fresh, last_sign_in_at: '2026-11-19T11:59:30Z' }, now)).toBe(false)
    expect(isNewGoogleAccount(null, now)).toBe(false)
    resetOAuthSignupForTests()
    const calls = []
    const win = { va: (...a) => calls.push(a), navigator: {}, localStorage: store() }
    expect(trackOAuthSignupDone(fresh, { authReturn: false, now, win })).toBe(false)
    expect(trackOAuthSignupDone(fresh, { authReturn: true, now, win })).toBe(true)
    expect(trackOAuthSignupDone(fresh, { authReturn: true, now, win })).toBe(false)
    expect(calls).toEqual([['event', { name: 'signup_done', data: { src: 'directo', method: 'google' } }]])
    expect(typeof bootIsAuthReturn()).toBe('boolean')
  })
  it('la etiqueta del plan es el periodo (desde el modelo A ningún checkout lleva prueba)', () => {
    expect(checkoutPlan('annual')).toBe('annual')
    expect(checkoutPlan('monthly')).toBe('monthly')
  })
  it('ProGate: la etiqueta sale del enlace que se abre', () => {
    const on = { checkoutUrl: 'https://buy.stripe.com/m', checkoutUrlAnnual: ' https://buy.stripe.com/a ' }
    expect(checkoutPlanForHref('https://buy.stripe.com/m', on)).toBe('monthly')
    expect(checkoutPlanForHref('https://buy.stripe.com/a', on)).toBe('annual')
    expect(checkoutPlanForHref('https://moyiq.app/#pricing', on)).toBe(null)
    expect(checkoutPlanForHref('', on)).toBe(null)
  })
})
