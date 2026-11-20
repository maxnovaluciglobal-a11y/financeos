import { describe, it, expect } from 'vitest'
import { pickDemoLanguage, PERSONA_LANG } from './demoLanguage.js'
import { pickDemoPersonaId, DEMO_PERSONAS } from './demoData.js'
import { APP_SIGNUP_URL } from './DemoBanner.jsx'
import { authTabFromSearch } from '../utils/deepLink.js'

describe('UX-N3: idioma del demo', () => {
  it('?lang= manda sobre todo lo demás', () => {
    expect(pickDemoLanguage({ search: '?demo=true&lang=es', stored: 'de', locales: ['en-US'] })).toBe('es')
    expect(pickDemoLanguage({ search: '?demo=true&lang=pt-BR', locales: ['en-US'] })).toBe('pt')
    expect(pickDemoLanguage({ search: '?demo=true&lang=DE&persona=us', locales: ['es'] })).toBe('de')
  })
  it('un ?lang= desconocido se ignora', () => {
    expect(pickDemoLanguage({ search: '?demo=true&lang=fr', locales: ['en-US'] })).toBe('en')
  })
  it('?persona= fija el idioma de la persona si no hay ?lang=', () => {
    expect(pickDemoLanguage({ search: '?demo=true&persona=ve', stored: 'en', locales: ['en-US'] })).toBe('es')
    expect(pickDemoLanguage({ search: '?demo=true&persona=us', locales: ['es-VE'] })).toBe('en')
    expect(pickDemoLanguage({ search: '?demo=true&persona=de', locales: ['es'] })).toBe('de')
    expect(pickDemoLanguage({ search: '?demo=true&persona=sofia', locales: ['de-DE'] })).toBe('es')
  })
  it('todas las personas tienen idioma', () => {
    for (const id of Object.keys(DEMO_PERSONAS)) expect(PERSONA_LANG[id]).toBeTruthy()
  })
  it('sin parámetros usa el último idioma elegido y, si no hay, el del navegador', () => {
    expect(pickDemoLanguage({ search: '?demo=true', stored: 'pt', locales: ['en-US'] })).toBe('pt')
    expect(pickDemoLanguage({ search: '?demo=true', stored: 'xx', locales: ['en-US'] })).toBe('en')
    expect(pickDemoLanguage({ search: '?demo=true', stored: null, locales: ['de-AT'] })).toBe('de')
  })
  it('?lang=es con navegador en inglés abre una persona hispana, no la de EE. UU.', () => {
    const lang = pickDemoLanguage({ search: '?demo=true&lang=es', locales: ['en-US'] })
    expect(pickDemoPersonaId(lang, { search: '?demo=true&lang=es', locales: ['en-US'] })).toBe('sofia')
  })
})

describe('UX-N4: CTA del demo', () => {
  it('abre la pestaña de crear cuenta y marca el origen', () => {
    const url = new URL(APP_SIGNUP_URL)
    expect(url.origin + url.pathname).toBe('https://app.moyiq.app/app/')
    expect(authTabFromSearch(url.search)).toBe('signup')
    expect(url.searchParams.get('ref')).toBe('demo')
  })
})
