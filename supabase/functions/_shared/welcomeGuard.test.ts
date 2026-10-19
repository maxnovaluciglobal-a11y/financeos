import { describe, it, expect, vi } from 'vitest'
import { decideWelcome, ilikeExact, welcomeGate, releaseWelcome } from './welcomeGuard.ts'

const lead = { id: 'a', email: 'Ana_Test@example.com', email1_sent_at: null, unsubscribed_at: null }

describe('decideWelcome', () => {
  it('fila nueva y dirección sin bienvenida: manda', () => {
    expect(decideWelcome(lead, [lead])).toBe('send')
  })
  it('la fila ya la recibió', () => {
    expect(decideWelcome({ ...lead, email1_sent_at: '2026-10-19T10:00:00Z' }, [])).toBe('already_sent')
  })
  it('otra fila con la misma dirección ya la recibió: no se repite', () => {
    expect(decideWelcome(lead, [lead, { id: 'b', email1_sent_at: '2026-10-01T00:00:00Z', unsubscribed_at: null }])).toBe('address_already_welcomed')
  })
  it('la dirección se dio de baja en cualquier fila: no se manda', () => {
    expect(decideWelcome(lead, [lead, { id: 'b', email1_sent_at: null, unsubscribed_at: '2026-10-02T00:00:00Z' }])).toBe('unsubscribed')
    expect(decideWelcome({ ...lead, unsubscribed_at: '2026-10-02T00:00:00Z' }, [])).toBe('unsubscribed')
  })
})

describe('ilikeExact', () => {
  it('escapa los comodines de LIKE', () => {
    expect(ilikeExact(' ana_test%1@x.com ')).toBe('ana\\_test\\%1@x.com')
  })
})

describe('welcomeGate', () => {
  function fake(rows: any[], claimed: boolean) {
    const calls: any[] = []
    const f = vi.fn(async (url: string, init?: any) => {
      calls.push({ url, init })
      if (init?.method === 'PATCH') return new Response(JSON.stringify(claimed ? [{ id: 'a' }] : []), { status: 200 })
      return new Response(JSON.stringify(rows), { status: 200 })
    })
    return { f: f as unknown as typeof fetch, calls }
  }
  const cfg = (f: typeof fetch) => ({ supabaseUrl: 'https://x.supabase.co', serviceRole: 'srv', fetchImpl: f })

  it('busca por dirección sin mayúsculas y reclama la fila antes de mandar', async () => {
    const { f, calls } = fake([lead], true)
    expect(await welcomeGate('starter_leads', lead, cfg(f))).toBe('send')
    expect(calls[0].url).toContain('starter_leads?select=id,email1_sent_at,unsubscribed_at&email=ilike.' + encodeURIComponent('Ana\\_Test@example.com'))
    expect(calls[1].url).toContain('id=eq.a&email1_sent_at=is.null')
    expect(JSON.parse(calls[1].init.body).email1_sent_at).toBeTruthy()
  })
  it('si otra llamada la reclamó primero: already_sent y no manda', async () => {
    const { f } = fake([lead], false)
    expect(await welcomeGate('starter_leads', lead, cfg(f))).toBe('already_sent')
  })
  it('no reclama si la decisión es no mandar', async () => {
    const { f, calls } = fake([lead, { id: 'b', email1_sent_at: '2026-10-01T00:00:00Z', unsubscribed_at: null }], true)
    expect(await welcomeGate('invest_leads', lead, cfg(f))).toBe('address_already_welcomed')
    expect(calls.some((c) => c.init?.method === 'PATCH')).toBe(false)
  })
  it('releaseWelcome vuelve email1_sent_at a null', async () => {
    const { f, calls } = fake([], true)
    await releaseWelcome('starter_leads', 'a', cfg(f))
    expect(JSON.parse(calls[0].init.body)).toEqual({ email1_sent_at: null })
  })
})
