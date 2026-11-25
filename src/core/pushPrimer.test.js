// Un solo camino al permiso de avisos: la cola del anfitrión (Shell), el
// atajo con permiso ya concedido y la app de tienda.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

let native = false
vi.mock('../native/platform.js', () => ({ isNativeApp: () => native }))
const enablePush = vi.fn(async () => ({ ok: true }))
vi.mock('./push.js', () => ({ enablePush }))
const recordPushResult = vi.fn()
vi.mock('./pushAsk.js', () => ({ recordPushResult }))

const { createPrimerQueue, setPushPrimerHost, requestPushPermission } = await import('./pushPrimer.js')

beforeEach(() => { native = false; enablePush.mockClear(); recordPushResult.mockClear() })
afterEach(() => { delete globalThis.Notification })

describe('cola del anfitrión (Shell)', () => {
  it('cada pedido abre la hoja y un resultado resuelve a todos los que esperaban', async () => {
    const opened = []
    const q = createPrimerQueue((o) => opened.push(o.source))
    const a = q.request({ source: 'settings' })
    const b = q.request({ source: 'steps' })
    expect(opened).toEqual(['settings', 'steps'])
    expect(q.settle({ ok: false, error: 'dismissed' })).toBe(2)
    await expect(a).resolves.toEqual({ ok: false, error: 'dismissed' })
    await expect(b).resolves.toEqual({ ok: false, error: 'dismissed' })
    // El pedido automático no tiene a nadie esperando.
    expect(q.settle({ ok: true })).toBe(0)
  })

  it('requestPushPermission pasa por el anfitrión registrado', async () => {
    const q = createPrimerQueue(() => {})
    const off = setPushPrimerHost(q.request)
    const p = requestPushPermission({ source: 'settings' })
    q.settle({ ok: true })
    await expect(p).resolves.toEqual({ ok: true })
    expect(enablePush).not.toHaveBeenCalled()
    off()
  })

  it('con el permiso ya concedido no muestra la hoja: activa directo y lo guarda', async () => {
    globalThis.Notification = { permission: 'granted' }
    const host = vi.fn()
    const off = setPushPrimerHost(host)
    await expect(requestPushPermission({ source: 'settings' })).resolves.toEqual({ ok: true })
    expect(host).not.toHaveBeenCalled()
    expect(enablePush).toHaveBeenCalledTimes(1)
    expect(recordPushResult).toHaveBeenCalledWith({ ok: true })
    off()
  })

  it('en la app de tienda responde unsupported sin abrir nada', async () => {
    native = true
    const host = vi.fn()
    const off = setPushPrimerHost(host)
    await expect(requestPushPermission()).resolves.toEqual({ ok: false, error: 'unsupported' })
    expect(host).not.toHaveBeenCalled()
    expect(enablePush).not.toHaveBeenCalled()
    off()
  })
})
