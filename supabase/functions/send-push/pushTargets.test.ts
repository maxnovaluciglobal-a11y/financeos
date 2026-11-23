import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { licenseSubsPath, MAX_SUBS_PER_LICENSE, pickPushTargets } from './pushTargets.ts'

describe('send-push: destinos por licencia', () => {
  it('pide las más recientes, con tope y solo las columnas que usa', () => {
    const p = licenseSubsPath('abc123')
    expect(p).toBe('push_subscriptions?key_hash=eq.abc123&select=id,endpoint,p256dh,auth,last_sent_at&order=created_at.desc,id.asc&limit=10')
    expect(licenseSubsPath('a&b=c')).toContain('key_hash=eq.a%26b%3Dc&')
  })

  it('descarta endpoints fuera de la lista y deja 5 como mucho', () => {
    const subs = [
      { id: 'x', endpoint: 'https://attacker.example/hook' },
      { id: 'y', endpoint: 'http://fcm.googleapis.com/fcm/send/plain' },
      ...Array.from({ length: 7 }, (_, i) => ({ id: `s${i}`, endpoint: `https://fcm.googleapis.com/fcm/send/${i}` })),
    ]
    const out = pickPushTargets(subs)
    expect(out.map(s => s.id)).toEqual(['s0', 's1', 's2', 's3', 's4'])
    expect(out).toHaveLength(MAX_SUBS_PER_LICENSE)
    expect(pickPushTargets(null as unknown as [])).toEqual([])
  })

  it('index.ts usa el filtro y el tope (no lee push_subscriptions sin ellos)', () => {
    const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
    expect(src).toMatch(/sbFetch\(licenseSubsPath\(lic\.key_hash\)\)/)
    expect(src).toMatch(/pickPushTargets\(/)
    expect(src).not.toMatch(/select=\*/)
  })
})
