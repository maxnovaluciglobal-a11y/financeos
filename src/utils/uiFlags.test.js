import { describe, it, expect } from 'vitest'
import { UI_FLAGS, inicioLupaOn, INICIO_LUPA_KEY } from './uiFlags.js'

const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m } }

describe('uiFlags.inicioLupa', () => {
  it('encendido en producción por defecto', () => {
    expect(UI_FLAGS.inicioLupa).toBe(true)
    expect(inicioLupaOn({})).toBe(true)
  })
  it('encendido en el demo y en desarrollo local', () => {
    expect(inicioLupaOn({ isDemo: true })).toBe(true)
    expect(inicioLupaOn({ isDev: true })).toBe(true)
  })
  it('?ui=inicio-lupa lo enciende para revisar y queda en la pestaña', () => {
    const s = mem()
    expect(inicioLupaOn({ search: '?ui=inicio-lupa', session: s })).toBe(true)
    expect(s.m.get(INICIO_LUPA_KEY)).toBe('1')
    expect(inicioLupaOn({ search: '', session: s })).toBe(true)
  })
  it('?ui=inicio-clasico lo apaga aunque sea el demo', () => {
    const s = mem()
    expect(inicioLupaOn({ isDemo: true, search: '?demo=true&ui=inicio-clasico', session: s })).toBe(false)
    expect(inicioLupaOn({ isDemo: true, session: s })).toBe(false)
  })
  it('sin almacenamiento (modo privado) no rompe', () => {
    const boom = { getItem() { throw new Error('x') }, setItem() { throw new Error('x') } }
    expect(inicioLupaOn({ search: '?ui=inicio-lupa', session: boom })).toBe(true)
    expect(inicioLupaOn({ session: boom })).toBe(UI_FLAGS.inicioLupa)
  })
})

describe('uiFlags.investFull (Invest completo, F0)', () => {
  it('apagado en producción por defecto', async () => {
    const { investFullOn } = await import('./uiFlags.js')
    expect(UI_FLAGS.investFull).toBe(false)
    expect(investFullOn({})).toBe(false)
  })
  it('encendido en el demo y en desarrollo local', async () => {
    const { investFullOn } = await import('./uiFlags.js')
    expect(investFullOn({ isDemo: true })).toBe(true)
    expect(investFullOn({ isDev: true })).toBe(true)
  })
  it('?ui=invest-full lo enciende en la pestaña; ?ui=invest-simple lo apaga aunque sea el demo', async () => {
    const { investFullOn, INVEST_FULL_KEY } = await import('./uiFlags.js')
    const s = mem()
    expect(investFullOn({ search: '?ui=invest-full', session: s })).toBe(true)
    expect(s.m.get(INVEST_FULL_KEY)).toBe('1')
    expect(investFullOn({ session: s })).toBe(true)
    const d = mem()
    expect(investFullOn({ isDemo: true, search: '?demo=true&ui=invest-simple', session: d })).toBe(false)
    expect(investFullOn({ isDemo: true, session: d })).toBe(false)
  })
  it('sin almacenamiento (modo privado) no rompe', async () => {
    const { investFullOn } = await import('./uiFlags.js')
    const boom = { getItem() { throw new Error('x') }, setItem() { throw new Error('x') } }
    expect(investFullOn({ search: '?ui=invest-full', session: boom })).toBe(true)
    expect(investFullOn({ session: boom })).toBe(false)
  })
})
