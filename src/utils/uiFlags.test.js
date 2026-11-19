import { describe, it, expect } from 'vitest'
import { UI_FLAGS, inicioLupaOn, INICIO_LUPA_KEY } from './uiFlags.js'

const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m } }

describe('uiFlags.inicioLupa', () => {
  it('apagado en producción por defecto', () => {
    expect(UI_FLAGS.inicioLupa).toBe(false)
    expect(inicioLupaOn({})).toBe(false)
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
    expect(inicioLupaOn({ session: boom })).toBe(false)
  })
})
