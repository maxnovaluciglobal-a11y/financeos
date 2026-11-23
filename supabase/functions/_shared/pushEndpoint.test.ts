import { describe, expect, it } from 'vitest'
import { pushEndpointAllowed, pushProvider } from './pushEndpoint.ts'

// Mismos casos que supabase/tests/push_subscription_guard.sql (push_endpoint_allowed).
describe('pushEndpointAllowed', () => {
  it('acepta los servicios Web Push de Chrome, Firefox, Safari y Edge', () => {
    for (const ok of [
      'https://fcm.googleapis.com/fcm/send/abc:def',
      'https://updates.push.services.mozilla.com/wpush/v2/gAAA',
      'https://web.push.apple.com/QOabc',
      'https://wns2-par02p.notify.windows.com/w/?token=x',
      'https://FCM.googleapis.com:443/fcm/send/x',
    ]) expect(pushEndpointAllowed(ok), ok).toBe(true)
  })
  it('rechaza todo lo demás', () => {
    for (const bad of [
      'http://fcm.googleapis.com/fcm/send/x',
      'https://evil.example/fcm.googleapis.com/',
      'https://fcm.googleapis.com.evil.example/x',
      'https://evil@fcm.googleapis.com/x',
      'https://fcm.googleapis.com:8443/x',
      'https://push.apple.com/x',
      'https://10.0.0.1/x',
      'https://localhost/x',
      'https://fcm.googleapis.com/x y',
      'https://fcm.googleapis.com',
      '',
      null,
      undefined,
      'https://fcm.googleapis.com/' + 'a'.repeat(1100),
    ]) expect(pushEndpointAllowed(bad), String(bad)).toBe(false)
  })
})

describe('pushProvider', () => {
  it('agrupa por proveedor, no por host', () => {
    expect(pushProvider('https://FCM.googleapis.com/fcm/send/x')).toBe('fcm')
    expect(pushProvider('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe('mozilla')
    expect(pushProvider('https://web.push.apple.com/QAbc')).toBe('apple')
    expect(pushProvider('https://api.push.apple.com/x')).toBe('apple')
    expect(pushProvider('https://wns2-par02p.notify.windows.com/w/?token=x')).toBe('wns')
    expect(pushProvider('https://db5p.notify.windows.com/w/?token=y')).toBe('wns')
    expect(pushProvider('https://otro.example/x')).toBe('otro.example')
    expect(pushProvider('no es url')).toBe('?')
  })
})
