import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prefetchTabs, _resetPrefetchForTests } from './prefetchTabs.js'

describe('prefetchTabs (ola A10, H20)', () => {
  beforeEach(() => _resetPrefetchForTests())
  it('programa la carga en un momento libre, una sola vez', () => {
    const ric = vi.fn((cb) => cb())
    const load = vi.fn(() => Promise.resolve())
    const win = { requestIdleCallback: ric, setTimeout: vi.fn() }
    expect(prefetchTabs({ win, imports: [load, load] })).toBe(true)
    expect(prefetchTabs({ win, imports: [load] })).toBe(false)
    expect(ric).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenCalledTimes(2)
  })
  it('sin requestIdleCallback usa setTimeout y un fallo no rompe nada', () => {
    const st = vi.fn((cb) => cb())
    const load = vi.fn(() => Promise.reject(new Error('offline')))
    expect(prefetchTabs({ win: { setTimeout: st }, imports: [load] })).toBe(true)
    expect(st).toHaveBeenCalled()
  })
})
