import { describe, it, expect } from 'vitest'
import { makeBeforeSend, isInternalEmail, markInternalUser, installWebAnalytics, INTERNAL_KEY } from './webAnalytics.js'

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
