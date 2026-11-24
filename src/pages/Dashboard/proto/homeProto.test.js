import { describe, it, expect } from 'vitest'
import { homeProtoVariant, HOME_PROTO_KEY } from './homeProto.js'

function memSession() {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }
}

describe('homeProtoVariant', () => {
  it('sin parámetro ni nada guardado es el Inicio de siempre', () => {
    expect(homeProtoVariant({ search: '?demo=true', session: memSession() })).toBe(null)
  })
  it('elige la variante de la URL y la recuerda en la pestaña', () => {
    const s = memSession()
    expect(homeProtoVariant({ search: '?demo=true&home=B', session: s })).toBe('b')
    expect(s.getItem(HOME_PROTO_KEY)).toBe('b')
    expect(homeProtoVariant({ search: '', session: s })).toBe('b')
  })
  it('d (mezcla de B y C) también es una variante', () => {
    expect(homeProtoVariant({ search: '?home=d', session: memSession() })).toBe('d')
  })
  it('home=off (o un valor desconocido) vuelve al Inicio de siempre y olvida la variante', () => {
    const s = memSession()
    homeProtoVariant({ search: '?home=c', session: s })
    expect(homeProtoVariant({ search: '?home=off', session: s })).toBe(null)
    expect(homeProtoVariant({ search: '', session: s })).toBe(null)
    expect(homeProtoVariant({ search: '?home=z', session: s })).toBe(null)
  })
  it('sin almacenamiento solo vale la URL', () => {
    expect(homeProtoVariant({ search: '?home=a', session: null })).toBe('a')
    const broken = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') }, removeItem: () => {} }
    expect(homeProtoVariant({ search: '?home=a', session: broken })).toBe('a')
    expect(homeProtoVariant({ search: '', session: broken })).toBe(null)
  })
})
