import { describe, it, expect, vi, afterEach } from 'vitest'
import { parseTarget, unsubscribeLead, landingUnsubscribeUrl, RPC_BY_TABLE } from './unsubscribeLogic.ts'
import { listUnsubscribeHeaders, oneClickUnsubscribeUrl, COMPANY_POSTAL_HTML, COMPANY_POSTAL_TEXT } from '../_shared/marketingEmail.ts'

const ID = '0b6f1c2e-3d4a-4b5c-8d9e-0f1a2b3c4d5e'
const CONFIG = { supabaseUrl: 'https://proj.supabase.co', serviceRole: 'srv' }
afterEach(() => { vi.unstubAllGlobals() })

describe('lead-unsubscribe (C-35 / COM-9)', () => {
  it('parseTarget acepta solo tablas conocidas y uuid', () => {
    expect(parseTarget(`https://x/f?t=invest&id=${ID}`)).toEqual({ table: 'invest', id: ID })
    for (const u of [`https://x/f?t=otra&id=${ID}`, 'https://x/f?t=starter&id=abc', 'https://x/f', 'nope']) expect(parseTarget(u)).toBeNull()
  })

  it('cada tabla usa su RPC de baja', () => {
    expect(RPC_BY_TABLE).toEqual({
      starter: 'unsubscribe_starter_lead', diagnostico: 'unsubscribe_diagnostico_lead',
      invest: 'unsubscribe_invest_lead', demo: 'unsubscribe_demo_lead',
    })
  })

  it('unsubscribeLead llama al RPC con el id y devuelve ok', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', f)
    expect(await unsubscribeLead('starter', ID, CONFIG)).toBe(true)
    expect(f.mock.calls[0][0]).toBe('https://proj.supabase.co/rest/v1/rpc/unsubscribe_starter_lead')
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ p_id: ID })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    expect(await unsubscribeLead('starter', ID, CONFIG)).toBe(false)
  })

  it('GET redirige a la página de baja de la landing con la tabla', () => {
    expect(landingUnsubscribeUrl('https://moyiq.app/', 'demo', ID)).toBe(`https://moyiq.app/unsubscribe.html?id=${ID}&t=demo`)
  })

  it('cabeceras List-Unsubscribe con URL https de un clic y mailto', () => {
    const h = listUnsubscribeHeaders('https://proj.supabase.co', 'diagnostico', ID)
    expect(h['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
    expect(h['List-Unsubscribe']).toBe(`<${oneClickUnsubscribeUrl('https://proj.supabase.co', 'diagnostico', ID)}>, <mailto:support@moyiq.app?subject=unsubscribe>`)
    expect(h['List-Unsubscribe']).toContain(`/functions/v1/lead-unsubscribe?t=diagnostico&id=${ID}`)
  })

  it('dirección postal de la LLC (D-14), escapada para HTML', () => {
    expect(COMPANY_POSTAL_TEXT).toContain('Doral, FL 33172, USA')
    expect(COMPANY_POSTAL_HTML).toContain('MAXNOVA &amp; LUCI')
  })
})
