import { describe, it, expect } from 'vitest'
import { skewCookieStrings, clearSkewCookieStrings, SKEW_COOKIE_PATH } from './skewCookie.js'

describe('skewCookieStrings (C-49, ola A lote 2b)', () => {
  it('sin id de despliegue (local) no escribe nada', () => {
    expect(skewCookieStrings('')).toEqual([])
    expect(skewCookieStrings(undefined)).toEqual([])
  })
  it('borra la cookie vieja de /app y fija solo /app/assets', () => {
    const [clear, set] = skewCookieStrings('dpl_abc')
    expect(clear).toMatch(/^__vdpl=; path=\/app; max-age=0/)
    expect(set).toBe(`__vdpl=dpl_abc; path=${SKEW_COOKIE_PATH}; secure; samesite=lax`)
    expect(set).not.toMatch(/path=\/app;/)
  })
  it('con un service worker al mando no fija nada: borra las dos (la precarga del SW nuevo no queda atada al despliegue viejo)', () => {
    const out = skewCookieStrings('dpl_abc', { controlled: true })
    expect(out).toEqual(clearSkewCookieStrings())
    expect(out.every(c => /max-age=0/.test(c))).toBe(true)
    expect(out.some(c => c.includes(`path=${SKEW_COOKIE_PATH};`))).toBe(true)
    expect(out.join(' ')).not.toMatch(/dpl_abc/)
  })
})
