import { describe, it, expect, vi } from 'vitest'
import { shareInvite, inviteUrl, INVITE_URL, STORE_INVITE_URL } from './invite.js'
import es from './strings.es.js'
import en from './strings.en.js'
import pt from './strings.pt.js'
import de from './strings.de.js'

const msg = { title: 'moyiq', text: 'Hola' }
// Capacitor de mentira: la app de tienda (Android o iOS).
const nativeWin = (extra = {}) => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android', isPluginAvailable: () => false },
  ...extra,
})

describe('Invita a alguien', () => {
  it('web con Web Share: comparte el mensaje con el enlace público', async () => {
    const share = vi.fn().mockResolvedValue()
    expect(await shareInvite(msg, { navigator: { share } }, false)).toBe('shared')
    expect(share).toHaveBeenCalledWith({ title: 'moyiq', text: 'Hola', url: INVITE_URL })
    expect(INVITE_URL).toBe('https://moyiq.app')
  })
  it('sin Web Share copia el enlace; cerrar la hoja es "cancelled"', async () => {
    const writeText = vi.fn().mockResolvedValue()
    expect(await shareInvite(msg, { navigator: { clipboard: { writeText } } }, false)).toBe('copied')
    expect(writeText).toHaveBeenCalledWith('Hola https://moyiq.app')
    const abort = Object.assign(new Error('x'), { name: 'AbortError' })
    expect(await shareInvite(msg, { navigator: { share: () => Promise.reject(abort) } }, false)).toBe('cancelled')
    expect(await shareInvite(msg, { navigator: {} }, false)).toBe('failed')
  })
})

// 25-nov-2026: la app de tienda no puede llevar a precios fuera de la tienda,
// así que comparte la página sin precios de la landing (financeos-landing/app.html).
describe('Invita a alguien en la app de tienda', () => {
  it('el enlace es la página sin precios, la web sigue con la home', () => {
    expect(STORE_INVITE_URL).toBe('https://moyiq.app/app')
    expect(inviteUrl({}, false)).toBe(INVITE_URL)
    expect(inviteUrl(nativeWin(), false)).toBe(STORE_INVITE_URL)
    // Compilada para tiendas (MOYIQ_STORE_BUILD=1) también, aunque Capacitor no responda.
    expect(inviteUrl({}, true)).toBe(STORE_INVITE_URL)
  })
  it('app nativa sin plugin Share: comparte y copia moyiq.app/app', async () => {
    const share = vi.fn().mockResolvedValue()
    expect(await shareInvite(msg, nativeWin({ navigator: { share } }), false)).toBe('shared')
    expect(share).toHaveBeenCalledWith({ title: 'moyiq', text: 'Hola', url: 'https://moyiq.app/app' })
    const writeText = vi.fn().mockResolvedValue()
    expect(await shareInvite(msg, nativeWin({ navigator: { clipboard: { writeText } } }), false)).toBe('copied')
    expect(writeText).toHaveBeenCalledWith('Hola https://moyiq.app/app')
  })
  it('app nativa con el plugin Share de Capacitor: le pasa moyiq.app/app', async () => {
    const share = vi.fn().mockResolvedValue()
    vi.doMock('@capacitor/core', () => ({ registerPlugin: () => ({ share }) }))
    const win = nativeWin()
    win.Capacitor.isPluginAvailable = (n) => n === 'Share'
    expect(await shareInvite(msg, win, false)).toBe('shared')
    expect(share).toHaveBeenCalledWith({ title: 'moyiq', text: 'Hola', url: 'https://moyiq.app/app', dialogTitle: 'moyiq' })
    vi.doUnmock('@capacitor/core')
  })
  it('compilada para tiendas sin Capacitor: también moyiq.app/app', async () => {
    const share = vi.fn().mockResolvedValue()
    expect(await shareInvite(msg, { navigator: { share } }, true)).toBe('shared')
    expect(share).toHaveBeenCalledWith({ title: 'moyiq', text: 'Hola', url: STORE_INVITE_URL })
  })
  it('el aviso de error dice el enlace que corresponde (variable {url} en los 4 idiomas)', () => {
    for (const d of [es, en, pt, de]) expect(d['invite.failed']).toContain('{url}')
  })
})
