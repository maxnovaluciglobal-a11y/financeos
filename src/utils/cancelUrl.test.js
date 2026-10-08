import { describe, it, expect } from 'vitest'
import { cancelUrl, CANCEL_URLS } from './cancelUrl.js'

describe('cancelUrl', () => {
  it('español va a /cancelar.html', () => {
    expect(cancelUrl('es')).toBe(CANCEL_URLS.es)
    expect(cancelUrl('es-AR')).toBe(CANCEL_URLS.es)
  })
  it('inglés y portugués van a /en/cancel.html', () => {
    expect(cancelUrl('en')).toBe(CANCEL_URLS.en)
    expect(cancelUrl('pt')).toBe(CANCEL_URLS.en)
  })
  it('alemán va a /de/kuendigen.html solo si los textos alemanes están publicados', () => {
    expect(cancelUrl('de', true)).toBe('https://moyiq.app/de/kuendigen.html')
    expect(cancelUrl('de', false)).toBe(CANCEL_URLS.en)
  })
  it('sin idioma o desconocido cae a inglés', () => {
    expect(cancelUrl(undefined)).toBe(CANCEL_URLS.en)
    expect(cancelUrl('fr')).toBe(CANCEL_URLS.en)
  })
})
