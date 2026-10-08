import { describe, it, expect } from 'vitest'
import { activateUrl } from './landingLinks.js'

describe('activateUrl', () => {
  it('inglés y alemán van a la página en inglés', () => {
    expect(activateUrl('en')).toBe('https://moyiq.app/en/activate.html')
    expect(activateUrl('de')).toBe('https://moyiq.app/en/activate.html')
  })
  it('español, portugués y desconocidos van a la página en español', () => {
    expect(activateUrl('es')).toBe('https://moyiq.app/activate.html')
    expect(activateUrl('pt')).toBe('https://moyiq.app/activate.html')
    expect(activateUrl(undefined)).toBe('https://moyiq.app/activate.html')
  })
})
