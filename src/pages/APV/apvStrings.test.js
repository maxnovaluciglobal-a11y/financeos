// APV con sus textos fuera del diccionario principal (src/i18n/lazySection.js):
// en cualquier idioma se pinta sin claves crudas.
import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppContext } from '../../context/AppContext.jsx'
import { loadLang } from '../../i18n/langCache.js'
import APVPage from './index.jsx'
import es from './strings.es.js'
import en from './strings.en.js'

const render = (language) => renderToStaticMarkup(h(AppContext.Provider, {
  value: { settings: { language, country: 'CL', plan: 'pro', isPro: true }, incomes: [], expenses: [], showToast: () => {} },
}, h(APVPage)))

describe('APV con textos diferidos', () => {
  it('en español se pinta sin esperar y sin claves crudas', () => {
    const html = render('es')
    expect(html).not.toMatch(/\bapv\.[\w.]+/)
    expect(Object.values(es).some(v => !/\{/.test(v) && html.includes(v))).toBe(true)
  })
  it('en inglés, ya cargado su chunk, se pinta en inglés', async () => {
    const { apvStringsLoad } = await import('./strings.js')
    await Promise.all([apvStringsLoad('en'), loadLang('en')])
    const html = render('en')
    expect(html).not.toMatch(/\bapv\.[\w.]+/)
    const k = Object.keys(es).find(x => en[x] !== es[x] && html.includes(en[x]))
    expect(k).toBeTruthy()
  })
})
