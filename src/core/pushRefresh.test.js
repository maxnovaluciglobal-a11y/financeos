import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { refreshPushSubscription, SS_REFRESHED } from './pushRefresh.js'

const SUB = { endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys: { p256dh: 'P'.repeat(80), auth: 'A'.repeat(22) } }

function deps(over = {}) {
  const store = new Map()
  return {
    supported: () => true,
    enabled: () => true,
    permission: () => 'granted',
    getSubscription: vi.fn(async () => ({ toJSON: () => SUB })),
    save: vi.fn(async () => ({ ok: true })),
    setEnabled: vi.fn(),
    session: { get: (k) => store.get(k) ?? null, set: (k, v) => store.set(k, v) },
    ...over,
  }
}

describe('refreshPushSubscription (al abrir la app)', () => {
  it('activo y con permiso: vuelve a guardar la suscripción del service worker', async () => {
    const d = deps()
    expect(await refreshPushSubscription(d)).toBe('saved')
    expect(d.save).toHaveBeenCalledWith(SUB)
    expect(d.setEnabled).not.toHaveBeenCalled()
  })

  it('una sola vez por sesión', async () => {
    const d = deps()
    await refreshPushSubscription(d)
    expect(await refreshPushSubscription(d)).toBe('already')
    expect(d.save).toHaveBeenCalledTimes(1)
    expect(d.session.get(SS_REFRESHED)).toBe('1')
  })

  it('apagado o sin soporte: no hace nada', async () => {
    for (const over of [{ enabled: () => false }, { supported: () => false }]) {
      const d = deps(over)
      expect(await refreshPushSubscription(d)).toBe('skipped')
      expect(d.getSubscription).not.toHaveBeenCalled()
      expect(d.save).not.toHaveBeenCalled()
    }
  })

  it('sin suscripción en el service worker: deja de marcarlo activo y no guarda nada', async () => {
    const d = deps({ getSubscription: vi.fn(async () => null) })
    expect(await refreshPushSubscription(d)).toBe('off')
    expect(d.setEnabled).toHaveBeenCalledWith(false)
    expect(d.save).not.toHaveBeenCalled()
  })

  it('permiso retirado: lo marca apagado; permiso sin decidir: no toca nada', async () => {
    const denied = deps({ permission: () => 'denied' })
    expect(await refreshPushSubscription(denied)).toBe('off')
    expect(denied.setEnabled).toHaveBeenCalledWith(false)
    const pending = deps({ permission: () => 'default' })
    expect(await refreshPushSubscription(pending)).toBe('skipped')
    expect(pending.setEnabled).not.toHaveBeenCalled()
    expect(pending.getSubscription).not.toHaveBeenCalled()
  })

  it('si el servidor no la guarda, no cambia el estado local', async () => {
    const d = deps({ save: vi.fn(async () => ({ ok: false, error: 'not_owner' })) })
    expect(await refreshPushSubscription(d)).toBe('error')
    expect(d.setEnabled).not.toHaveBeenCalled()
  })

  it('sin sessionStorage igual intenta', async () => {
    const d = deps({ session: null })
    expect(await refreshPushSubscription(d)).toBe('saved')
  })

  it('App.jsx lo llama al abrir, sin esperar (no bloquea la carga)', () => {
    const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8')
    expect(app).toMatch(/refreshPushOnOpen\(\)/)
    expect(app).not.toMatch(/await refreshPushOnOpen/)
  })
})
