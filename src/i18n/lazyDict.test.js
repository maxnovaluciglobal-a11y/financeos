import { describe, it, expect, vi } from 'vitest'
import { createLazyDict } from './lazyDict.js'

describe('createLazyDict', () => {
  it('español al instante; otro idioma a demanda y una sola vez', async () => {
    const en = vi.fn(() => Promise.resolve({ default: { a: 'A {x}' } }))
    const d = createLazyDict({ a: 'a {x}', b: 'solo es' }, { en })
    expect(d.lookup('es', 'a')).toBe('a {x}')
    expect(d.lookup('en', 'a')).toBe('a {x}') // todavía no cargó: cae al español
    await Promise.all([d.load('en'), d.load('en')])
    expect(en).toHaveBeenCalledTimes(1)
    expect(d.lookup('en', 'a')).toBe('A {x}')
    expect(d.lookup('en', 'b')).toBe('solo es')
    expect(d.lookup('en', 'nada')).toBeNull() // la pantalla usa el t general
  })
  it('si el chunk falla, queda el español y se puede reintentar', async () => {
    let n = 0
    const pt = () => (++n === 1 ? Promise.reject(new Error('offline')) : Promise.resolve({ default: { a: 'pt' } }))
    const d = createLazyDict({ a: 'es' }, { pt })
    expect(await d.load('pt')).toEqual({ a: 'es' })
    expect(d.lookup('pt', 'a')).toBe('es')
    await d.load('pt')
    expect(d.lookup('pt', 'a')).toBe('pt')
  })
  it('idioma sin cargador: español', async () => {
    const d = createLazyDict({ a: 'es' })
    expect(await d.load('de')).toEqual({ a: 'es' })
  })
})
