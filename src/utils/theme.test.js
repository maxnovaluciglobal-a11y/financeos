import { describe, it, expect, afterEach, vi } from 'vitest'
import { resolveTheme, watchSystemTheme, systemPrefersDark, applyTheme, THEME_SETTINGS } from './theme.js'

describe('resolveTheme (N4)', () => {
  it('claro y oscuro explícitos ignoran al sistema', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('light', false)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('dark', true)).toBe('dark')
  })

  it('"system" sigue a prefers-color-scheme', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('un valor ausente o desconocido queda en claro', () => {
    expect(resolveTheme(undefined, true)).toBe('light')
    expect(resolveTheme(null, true)).toBe('light')
    expect(resolveTheme('sepia', true)).toBe('light')
  })

  it('las tres opciones del selector, en orden', () => {
    expect(THEME_SETTINGS).toEqual(['system', 'light', 'dark'])
  })
})

describe('matchMedia', () => {
  const realWindow = globalThis.window
  const realDocument = globalThis.document
  afterEach(() => { globalThis.window = realWindow; globalThis.document = realDocument })

  function fakeMedia(matches) {
    const listeners = new Set()
    const mq = {
      matches,
      addEventListener: vi.fn((_, h) => listeners.add(h)),
      removeEventListener: vi.fn((_, h) => listeners.delete(h)),
      fire(m) { mq.matches = m; listeners.forEach(h => h({ matches: m })) },
      listeners,
    }
    globalThis.window = { matchMedia: () => mq }
    return mq
  }

  it('sin matchMedia (node, navegadores viejos) no rompe', () => {
    globalThis.window = {}
    expect(systemPrefersDark()).toBe(false)
    const stop = watchSystemTheme(() => {})
    expect(typeof stop).toBe('function')
    stop()
  })

  it('avisa cada cambio del sistema y deja de escuchar al cortar', () => {
    const mq = fakeMedia(false)
    const seen = []
    const stop = watchSystemTheme(v => seen.push(v))
    mq.fire(true); mq.fire(false)
    expect(seen).toEqual([true, false])
    stop()
    expect(mq.listeners.size).toBe(0)
  })

  it('applyTheme escribe el tema resuelto en data-theme', () => {
    fakeMedia(true)
    const attrs = {}
    globalThis.document = { documentElement: { setAttribute: (k, v) => { attrs[k] = v } } }
    applyTheme('system'); expect(attrs['data-theme']).toBe('dark')
    applyTheme('light');  expect(attrs['data-theme']).toBe('light')
  })
})
