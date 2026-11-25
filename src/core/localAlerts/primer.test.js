import { describe, it, expect } from 'vitest'
import { requestLocalAlerts, setLocalPrimerHost } from './primer.js'

describe('primer de avisos locales', () => {
  it('sin anfitrión no pide nada', async () => {
    expect(await requestLocalAlerts()).toEqual({ ok: false, error: 'unavailable' })
  })
  it('con anfitrión, la hoja decide; al desmontar vuelve a no pedir', async () => {
    const off = setLocalPrimerHost(async (o) => ({ ok: o.source === 'settings' }))
    expect(await requestLocalAlerts({ source: 'settings' })).toEqual({ ok: true })
    off()
    expect((await requestLocalAlerts()).error).toBe('unavailable')
  })
})

import { shouldAskLocal } from './primer.js'
import { snoozedPushAsk } from '../pushAsk.js'

describe('pedido automático en la app de tienda', () => {
  const base = { available: true, permission: 'prompt', movementCount: 3 }
  it('después del 3.er movimiento, con el permiso sin decidir', () => {
    expect(shouldAskLocal(base)).toBe(true)
    expect(shouldAskLocal({ ...base, movementCount: 2 })).toBe(false)
    expect(shouldAskLocal({ ...base, permission: 'granted' })).toBe(false)
    expect(shouldAskLocal({ ...base, permission: 'denied' })).toBe(false)
    expect(shouldAskLocal({ ...base, available: false })).toBe(false)
    expect(shouldAskLocal({ ...base, isDemo: true })).toBe(false)
  })
  it('"Ahora no" pospone 14 días', () => {
    const now = Date.now()
    const asked = snoozedPushAsk({ n: 0 }, now)
    expect(shouldAskLocal({ ...base, asked, now: now + 864e5 })).toBe(false)
    expect(shouldAskLocal({ ...base, asked, now: now + 15 * 864e5 })).toBe(true)
  })
})

import { localAlertsSupported } from './primer.js'

describe('localAlertsSupported', () => {
  const win = (native, plugin) => ({ Capacitor: { isNativePlatform: () => native, isPluginAvailable: (n) => plugin && n === 'LocalNotifications' } })
  it('solo en la app de tienda con el plugin', () => {
    expect(localAlertsSupported(win(true, true))).toBe(true)
    expect(localAlertsSupported(win(true, false))).toBe(false)
    expect(localAlertsSupported(win(false, true))).toBe(false)
    expect(localAlertsSupported({})).toBe(false)
  })
})
