import { describe, it, expect, vi } from 'vitest'
import { parseLeadRequest, callLeadRpc, LEAD_RPCS } from './leadSubmitLogic.ts'
import { corsHeaders, ALLOWED_ORIGINS } from './cors.ts'

const CFG = { supabaseUrl: 'https://proj.supabase.co', serviceRole: 'srv-key' }

describe('lead-submit (SEG-1): pedido', () => {
  it('acepta solo las RPC de formularios públicos, con args p_*', () => {
    expect(parseLeadRequest({ rpc: 'register_diagnostico_lead', args: { p_email: 'a@b.co', p_score: 7, p_consent_marketing: true, p_lang: null } }))
      .toEqual({ rpc: 'register_diagnostico_lead', args: { p_email: 'a@b.co', p_score: 7, p_consent_marketing: true, p_lang: null } })
    expect(LEAD_RPCS).toContain('register_newsletter_signup')
    expect(LEAD_RPCS).toContain('register_invest_lead')
  })
  it('rechaza otras RPC, args raros o anidados', () => {
    const bad = [
      null, 'x', [], {},
      { rpc: 'sync_push', args: {} },
      { rpc: 'delete_account_data', args: { p_user_id: 'x' } },
      { rpc: 'register_starter_lead', args: { email: 'a@b.co' } },
      { rpc: 'register_starter_lead', args: { 'p_email; drop': 'a' } },
      { rpc: 'register_starter_lead', args: { p_email: { $ne: 1 } } },
      { rpc: 'register_starter_lead', args: { p_email: ['a'] } },
      { rpc: 'register_starter_lead', args: [] },
      { rpc: 'register_starter_lead', args: Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`p_a${'x'.repeat(i)}`, 1])) },
    ]
    for (const b of bad) expect(parseLeadRequest(b)).toBeNull()
  })
})

describe('lead-submit (SEG-1): llamada a la RPC', () => {
  it('llama a la misma RPC con el service role y la IP del visitante', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, id: 'abc' }), { status: 200 }))
    const out = await callLeadRpc({ rpc: 'register_starter_lead', args: { p_email: 'a@b.co' } }, '203.0.113.9', { ...CFG, fetchImpl: fetchImpl as any })
    expect(out).toEqual({ status: 200, body: { ok: true, id: 'abc' } })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://proj.supabase.co/rest/v1/rpc/register_starter_lead')
    const h = init.headers as Record<string, string>
    expect(h.Authorization).toBe('Bearer srv-key')
    expect(h['x-moyiq-client-ip']).toBe('203.0.113.9')
    expect(JSON.parse(init.body as string)).toEqual({ p_email: 'a@b.co' })
  })
  it('devuelve 4xx de la RPC tal cual y convierte 5xx/red en 502', async () => {
    const r400 = vi.fn(async () => new Response(JSON.stringify({ code: 'PGRST202' }), { status: 404 }))
    expect(await callLeadRpc({ rpc: 'register_demo_lead', args: {} }, null, { ...CFG, fetchImpl: r400 as any })).toEqual({ status: 404, body: { code: 'PGRST202' } })
    const r500 = vi.fn(async () => new Response('boom', { status: 500 }))
    expect(await callLeadRpc({ rpc: 'register_demo_lead', args: {} }, null, { ...CFG, fetchImpl: r500 as any })).toEqual({ status: 502, body: { ok: false, error: 'upstream_error' } })
    const net = vi.fn(async () => { throw new Error('x') })
    expect(await callLeadRpc({ rpc: 'register_demo_lead', args: {} }, null, { ...CFG, fetchImpl: net as any })).toEqual({ status: 502, body: { ok: false, error: 'upstream_unavailable' } })
    const noIp = vi.fn(async () => new Response('{}', { status: 200 }))
    await callLeadRpc({ rpc: 'register_demo_lead', args: {} }, null, { ...CFG, fetchImpl: noIp as any })
    expect((noIp.mock.calls[0] as any)[1].headers['x-moyiq-client-ip']).toBeUndefined()
  })
  it('CORS: landing, Invest, app y demo; permite el encabezado del token', () => {
    for (const o of ['https://moyiq.app', 'https://invest.moyiq.app', 'https://app.moyiq.app', 'https://demo.moyiq.app']) {
      expect(ALLOWED_ORIGINS).toContain(o)
      expect(corsHeaders(o)['Access-Control-Allow-Origin']).toBe(o)
    }
    expect(corsHeaders('https://evil.example')['Access-Control-Allow-Origin']).toBe('https://moyiq.app')
    expect(corsHeaders(null)['Access-Control-Allow-Headers']).toContain('cf-turnstile-response')
  })
})
