import { describe, it, expect, beforeEach } from 'vitest'
import { requestPersistentStorage, _resetPersistForTests, isSafariBrowser, shouldShowSafariNotice, dismissSafariNotice, safariNoticeDismissed } from './storagePersist.js'

const IOS_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const MAC_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const IOS_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1'
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'

describe('almacenamiento persistente (C-34)', () => {
  beforeEach(() => _resetPersistForTests())

  it('pide persist() una sola vez por sesión', async () => {
    let calls = 0
    const nav = { storage: { persisted: async () => false, persist: async () => { calls++; return true } } }
    expect(await requestPersistentStorage(nav)).toBe(true)
    expect(await requestPersistentStorage(nav)).toBe(null)
    expect(calls).toBe(1)
  })

  it('no vuelve a pedir si ya es persistente', async () => {
    let calls = 0
    const nav = { storage: { persisted: async () => true, persist: async () => { calls++; return true } } }
    expect(await requestPersistentStorage(nav)).toBe(true)
    expect(calls).toBe(0)
  })

  it('sin la API no falla', async () => {
    expect(await requestPersistentStorage({})).toBe(null)
  })

  it('detecta Safari (iOS y Mac) y no Chrome/Android', () => {
    expect(isSafariBrowser(IOS_SAFARI)).toBe(true)
    expect(isSafariBrowser(MAC_SAFARI)).toBe(true)
    expect(isSafariBrowser(IOS_CHROME)).toBe(false)
    expect(isSafariBrowser(ANDROID_CHROME)).toBe(false)
  })

  it('el aviso sale solo en Safari sin instalar, con datos y una vez', () => {
    expect(shouldShowSafariNotice({ ua: IOS_SAFARI, standalone: false, hasData: true, dismissed: false })).toBe(true)
    expect(shouldShowSafariNotice({ ua: IOS_SAFARI, standalone: true, hasData: true, dismissed: false })).toBe(false)
    expect(shouldShowSafariNotice({ ua: IOS_SAFARI, standalone: false, hasData: false, dismissed: false })).toBe(false)
    expect(shouldShowSafariNotice({ ua: ANDROID_CHROME, standalone: false, hasData: true, dismissed: false })).toBe(false)
    const m = new Map(); const st = { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }
    expect(safariNoticeDismissed(st)).toBe(false)
    dismissSafariNotice(st)
    expect(safariNoticeDismissed(st)).toBe(true)
  })
})
