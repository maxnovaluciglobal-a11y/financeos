import { describe, it, expect } from 'vitest'
import { skewCookieStrings, SKEW_COOKIE_PATH } from './skewCookie.js'

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
})
