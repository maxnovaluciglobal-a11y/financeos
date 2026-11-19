import { describe, it, expect, vi, beforeEach } from 'vitest'
import { watchServiceWorkerUpdates, onUpdateReady, isUpdateReady, _resetSwUpdateForTests, shouldAutoReload, BOOT_WINDOW_MS, AUTO_RELOAD_KEY } from './swUpdate.js'

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

describe('swUpdate · recarga sola en iOS (19-nov-2026)', () => {
  beforeEach(() => _resetSwUpdateForTests())
  const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) } }
  const fakeDoc = (state = 'visible') => { const h = {}; return { visibilityState: state, addEventListener: (e, cb) => { h[e] = cb }, fire: (e) => h[e]?.() } }

  it('versión nueva en los primeros segundos: recarga sola una vez', () => {
    const sw = fakeSw({}); const reload = vi.fn(); let t = 1000
    watchServiceWorkerUpdates(sw, { document: fakeDoc(), now: () => t, bootAt: 1000, session: mem(), reload })
    t = 1000 + BOOT_WINDOW_MS - 1
    sw.fire('controllerchange')
    expect(reload).toHaveBeenCalledTimes(1)
  })
  it('mientras se usa la app (pasado el arranque): solo avisa, no recarga', () => {
    const sw = fakeSw({}); const reload = vi.fn(); let t = 0
    watchServiceWorkerUpdates(sw, { document: fakeDoc(), now: () => t, bootAt: 0, session: mem(), reload })
    t = BOOT_WINDOW_MS + 1
    sw.fire('controllerchange')
    expect(isUpdateReady()).toBe(true)
    expect(reload).not.toHaveBeenCalled()
  })
  it('llegó en segundo plano: recarga al volver a la app', () => {
    const sw = fakeSw({}); const reload = vi.fn(); const doc = fakeDoc('hidden'); let t = 0
    watchServiceWorkerUpdates(sw, { document: doc, now: () => t, bootAt: 0, session: mem(), reload })
    t = 10 * 60 * 1000
    sw.fire('controllerchange')
    expect(reload).not.toHaveBeenCalled()
    doc.visibilityState = 'visible'; doc.fire('visibilitychange')
    expect(reload).toHaveBeenCalledTimes(1)
  })
  it('el guardia evita un bucle de recargas', () => {
    const session = mem(); session.setItem(AUTO_RELOAD_KEY, '1')
    expect(shouldAutoReload({ now: 1, bootAt: 0, hidden: false, session })).toBe(false)
  })
  it('primera instalación: nunca recarga', () => {
    const sw = fakeSw(null); const reload = vi.fn()
    watchServiceWorkerUpdates(sw, { document: fakeDoc(), now: () => 0, bootAt: 0, session: mem(), reload })
    sw.fire('controllerchange')
    expect(reload).not.toHaveBeenCalled()
  })
})
