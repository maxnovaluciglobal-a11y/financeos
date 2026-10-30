import { describe, it, expect, vi, beforeEach } from 'vitest'
import { watchServiceWorkerUpdates, onUpdateReady, isUpdateReady, _resetSwUpdateForTests } from './swUpdate.js'

function fakeSw(controller) {
  const handlers = {}
  return { controller, addEventListener: (ev, cb) => { handlers[ev] = cb }, fire: (ev) => handlers[ev]?.() }
}

describe('swUpdate (ola A11, H14)', () => {
  beforeEach(() => _resetSwUpdateForTests())
  it('con un SW ya activo, el cambio de controlador avisa una vez', () => {
    const sw = fakeSw({})
    const cb = vi.fn()
    onUpdateReady(cb)
    watchServiceWorkerUpdates(sw)
    sw.fire('controllerchange'); sw.fire('controllerchange')
    expect(isUpdateReady()).toBe(true)
    expect(cb).toHaveBeenCalledTimes(1)
  })
  it('la primera instalación (sin controlador) no es una versión nueva', () => {
    const sw = fakeSw(null)
    watchServiceWorkerUpdates(sw)
    sw.fire('controllerchange')
    expect(isUpdateReady()).toBe(false)
  })
  it('sin service worker no hace nada', () => {
    expect(watchServiceWorkerUpdates(undefined)).toBe(false)
  })
})
