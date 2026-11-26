// Chequeo del pedido automático (lo carga el Shell con import()).
import { describe, it, expect, vi, afterEach } from 'vitest'

let enabled = false
vi.mock('./push.js', () => ({ pushSupported: () => true, isPushEnabled: () => enabled }))
vi.mock('../utils/licenseValidator.js', () => ({ getLicenseKey: () => 'k', hasProEntitlement: () => true }))
vi.mock('../native/platform.js', () => ({ isNativeApp: () => false }))

const { autoPushAsk } = await import('./pushAutoAsk.js')
const { PUSH_ASKED_KEY } = await import('./pushAsk.js')

const mem = new Map()
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) }
afterEach(() => { mem.clear(); enabled = false; delete globalThis.Notification })

describe('autoPushAsk', () => {
  it('ofrece después del 3.er movimiento, no antes', () => {
    expect(autoPushAsk({ movementCount: 2 })).toBe(false)
    expect(autoPushAsk({ movementCount: 3 })).toBe(true)
  })
  it('nunca con el permiso bloqueado, ya activados, en el demo o cerrado (done)', () => {
    globalThis.Notification = { permission: 'denied' }
    expect(autoPushAsk({ movementCount: 9 })).toBe(false)
    delete globalThis.Notification
    enabled = true
    expect(autoPushAsk({ movementCount: 9 })).toBe(false)
    enabled = false
    expect(autoPushAsk({ movementCount: 9, isDemo: true })).toBe(false)
    mem.set(PUSH_ASKED_KEY, JSON.stringify({ at: 0, n: 0, done: true }))
    expect(autoPushAsk({ movementCount: 9 })).toBe(false)
  })
})
