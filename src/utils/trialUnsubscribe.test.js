import { describe, it, expect, vi } from 'vitest'
import { trialUnsubscribeTarget, unsubscribeTrial } from './trialUnsubscribe.js'

const ID = '0b6f1c2e-3d4a-4b5c-8d9e-0f1a2b3c4d5e'

describe('baja de los correos de la prueba (C-35)', () => {
  it('solo con unsub=trial y un uuid', () => {
    expect(trialUnsubscribeTarget(`?unsub=trial&id=${ID}`)).toBe(ID)
    expect(trialUnsubscribeTarget(`?unsub=starter&id=${ID}`)).toBe(null)
    expect(trialUnsubscribeTarget('?unsub=trial&id=abc')).toBe(null)
    expect(trialUnsubscribeTarget('')).toBe(null)
  })
  it('llama a lead-unsubscribe con POST y devuelve el resultado', async () => {
    const f = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }))
    expect(await unsubscribeTrial(ID, { supabaseUrl: 'https://p.supabase.co/', fetchImpl: f })).toBe(true)
    expect(f.mock.calls[0][0]).toBe(`https://p.supabase.co/functions/v1/lead-unsubscribe?t=trial&id=${ID}`)
    expect(f.mock.calls[0][1]).toEqual({ method: 'POST' })
    expect(await unsubscribeTrial(ID, { supabaseUrl: 'x', fetchImpl: async () => ({ ok: false, json: async () => ({ ok: false }) }) })).toBe(false)
    expect(await unsubscribeTrial(ID, { supabaseUrl: 'x', fetchImpl: async () => { throw new Error('down') } })).toBe(false)
  })
})
