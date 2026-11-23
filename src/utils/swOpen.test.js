// Aviso push tocado con la app abierta: el service worker pide el destino por
// mensaje (public/push-sw.js) y la app va ahí sin recargar.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { listenSwOpen, openFromMessage, OPEN_MESSAGE } from './swOpen.js'
import { OPEN_EVENT, __resetInvestNav, bootFollowTab, bootTab } from './investNav.js'

const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) } }

describe('openFromMessage', () => {
  beforeEach(() => {
    __resetInvestNav()
    globalThis.history = { state: { invTab: 'planificar', invFollow: 'lista' }, replaceState(s) { this.state = s } }
  })
  it('invest-alertas: va a Inversiones › Siguiendo › Alertas aunque la entrada del historial tenga otra pestaña', () => {
    const setPage = vi.fn()
    const seen = []
    const on = (e) => seen.push(e.detail)
    const prev = globalThis.window
    globalThis.window = new EventTarget()
    window.addEventListener(OPEN_EVENT, on)
    expect(openFromMessage({ type: OPEN_MESSAGE, open: 'invest-alertas' }, setPage)).toBe(true)
    expect(setPage).toHaveBeenCalledWith('investments')
    expect(bootTab({ storage: mem() })).toBe('siguiendo')
    expect(bootFollowTab({ storage: mem() })).toBe('alertas')
    window.removeEventListener(OPEN_EVENT, on)
    globalThis.window = prev
    expect(seen).toEqual([{ tab: 'siguiendo', follow: 'alertas' }])
  })
  it('otros destinos conocidos cambian de página; lo desconocido o mal formado se ignora', () => {
    const setPage = vi.fn()
    expect(openFromMessage({ type: OPEN_MESSAGE, open: 'import' }, setPage)).toBe(true)
    expect(setPage).toHaveBeenLastCalledWith('import')
    expect(openFromMessage({ type: OPEN_MESSAGE, open: 'nada' }, setPage)).toBe(false)
    expect(openFromMessage({ type: OPEN_MESSAGE, open: 'invest-alertas&x=<b>' }, setPage)).toBe(false)
    expect(openFromMessage({ type: 'otro', open: 'import' }, setPage)).toBe(false)
    expect(openFromMessage(null, setPage)).toBe(false)
    expect(setPage).toHaveBeenCalledTimes(1)
  })
})

describe('listenSwOpen', () => {
  it('contesta por el puerto si fue al destino y deja de escuchar al desmontar', () => {
    const listeners = {}
    const sw = { addEventListener: (n, f) => { listeners[n] = f }, removeEventListener: vi.fn(), startMessages: vi.fn() }
    const setPage = vi.fn()
    const stop = listenSwOpen(setPage, sw)
    expect(sw.startMessages).toHaveBeenCalled()
    const port = { postMessage: vi.fn() }
    listeners.message({ data: { type: OPEN_MESSAGE, open: 'import' }, ports: [port] })
    expect(port.postMessage).toHaveBeenCalledWith({ ok: true })
    const port2 = { postMessage: vi.fn() }
    listeners.message({ data: { type: OPEN_MESSAGE, open: 'nada' }, ports: [port2] })
    expect(port2.postMessage).toHaveBeenCalledWith({ ok: false })
    listeners.message({ data: { type: 'SKIP_WAITING' }, ports: [] }) // otros mensajes: ni se tocan
    stop()
    expect(sw.removeEventListener).toHaveBeenCalledWith('message', listeners.message)
    expect(listenSwOpen(setPage, null)).toBeTypeOf('function')
  })
})
