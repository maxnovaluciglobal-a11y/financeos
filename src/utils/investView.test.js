import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DEFAULT_VIEW, VIEW_KEY, VIEWS, createViewStore, isFull, readView, shows, writeView, __resetInvestView } from './investView.js'

const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m } }
const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }

describe('vista esencial / completa', () => {
  beforeEach(() => __resetInvestView())

  it('esencial por defecto; la clave es de la cuenta (fos_)', () => {
    expect(DEFAULT_VIEW).toBe('esencial')
    expect(VIEWS).toEqual(['esencial', 'completa'])
    expect(VIEW_KEY.startsWith('fos_')).toBe(true)
    expect(readView(mem())).toBe('esencial')
    expect(readView(null)).toBe('esencial')
    expect(readView(broken)).toBe('esencial')
  })
  it('se recuerda la elección y se ignoran valores raros', () => {
    const s = mem()
    expect(writeView('completa', s)).toBe(true)
    expect(readView(s)).toBe('completa')
    expect(writeView('pro', s)).toBe(false)
    expect(s.m.get(VIEW_KEY)).toBe('completa')
    s.m.set(VIEW_KEY, 'otra')
    expect(readView(s)).toBe('esencial')
  })
  it('la esencial oculta velas, indicadores, stop, cinta, lecturas y medias; nada se borra en la completa', () => {
    for (const part of ['candles', 'indicators', 'stop', 'strip', 'review', 'movingAverages', 'unrealized']) {
      expect(shows('esencial', part), part).toBe(false)
      expect(shows('completa', part), part).toBe(true)
    }
    expect(shows('esencial', 'value')).toBe(true)
    expect(isFull('completa')).toBe(true)
    expect(isFull('esencial')).toBe(false)
  })
  it('el interruptor avisa a todas las pantallas y sobrevive al modo privado', () => {
    const s = mem()
    const st = createViewStore(s)
    const fn = vi.fn()
    const off = st.subscribe(fn)
    expect(st.get()).toBe('esencial')
    st.set('completa')
    expect(fn).toHaveBeenCalledWith('completa')
    expect(st.get()).toBe('completa')
    expect(s.m.get(VIEW_KEY)).toBe('completa')
    off()
    st.set('esencial')
    expect(fn).toHaveBeenCalledTimes(1)
    const priv = createViewStore(broken)
    priv.set('completa')
    expect(priv.get()).toBe('completa')
  })
  it('la vista no sale del perfil de inversionista (la elige la persona)', async () => {
    const { readFileSync } = await import('node:fs')
    const code = readFileSync(new URL('./investView.js', import.meta.url), 'utf8')
    expect(code).not.toMatch(/investProfile|experience/)
  })
})
