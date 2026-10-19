import { describe, it, expect, vi, afterEach } from 'vitest'
import { runNewsletterSync, pendingUrl, productOf, SYNC_SOURCES, BATCH_PER_TABLE } from './syncLogic.ts'

const CONFIG = {
  supabaseUrl: 'https://proj.supabase.co',
  serviceRole: 'srv-key',
  proxyUrl: 'https://proxy.example/api/subscribe',
  proxyToken: 'sub-token',
}

afterEach(() => { vi.unstubAllGlobals() })

// rows: filas pendientes por tabla; proxyStatus: status del proxy por email.
function backend(rows: Record<string, any[]>, proxyStatus: Record<string, number> = {}) {
  const patches: string[] = []
  const proxied: any[] = []
  const f = vi.fn(async (url: string, init: any = {}) => {
    if (url === CONFIG.proxyUrl) {
      const body = JSON.parse(init.body)
      proxied.push({ body, auth: init.headers.Authorization })
      const status = proxyStatus[body.email] ?? 200
      return { ok: status < 300, status, json: async () => ({ ok: true, created: true }), text: async () => 'x' }
    }
    const table = url.split('/rest/v1/')[1].split('?')[0]
    if ((init.method ?? 'GET') === 'GET') return { ok: true, status: 200, json: async () => rows[table] ?? [] }
    if (init.method === 'PATCH') { patches.push(url); return { ok: true, status: 204 } }
    throw new Error('unexpected ' + url)
  })
  vi.stubGlobal('fetch', f)
  return { f, patches, proxied }
}

describe('newsletter-sync (C-16)', () => {
  it('recorre las 5 tablas con consentimiento', () => {
    expect(SYNC_SOURCES.map((s) => s.table)).toEqual(['starter_leads', 'diagnostico_leads', 'demo_leads', 'invest_leads', 'newsletter_signups'])
  })

  it('solo pide filas con consentimiento, confirmadas, sin baja y sin sincronizar', () => {
    const u = pendingUrl(CONFIG, SYNC_SOURCES[0])
    expect(u).toContain('/rest/v1/starter_leads?select=id,email&')
    for (const f of ['consent_marketing=is.true', 'consent_confirmed_at=not.is.null', 'unsubscribed_at=is.null', 'newsletter_synced_at=is.null', `limit=${BATCH_PER_TABLE}`]) {
      expect(u).toContain(f)
    }
    expect(pendingUrl(CONFIG, SYNC_SOURCES[4])).toContain('select=id,email,product&')
  })

  it('suscribe al producto de cada tabla y marca newsletter_synced_at solo si el proxy respondió 2xx', async () => {
    const { proxied, patches } = backend({
      starter_leads: [{ id: 's1', email: 'a@x.com' }],
      invest_leads: [{ id: 'i1', email: 'b@x.com' }],
      newsletter_signups: [{ id: 'n1', email: 'c@x.com', product: 'invest' }, { id: 'n2', email: 'd@x.com', product: 'moyiq' }],
      diagnostico_leads: [{ id: 'd1', email: 'falla@x.com' }],
    }, { 'falla@x.com': 502 })
    const r = await runNewsletterSync(CONFIG)
    expect(proxied.map((p) => [p.body.email, p.body.product])).toEqual([
      ['a@x.com', 'moyiq'], ['falla@x.com', 'moyiq'], ['b@x.com', 'invest'], ['c@x.com', 'invest'], ['d@x.com', 'moyiq'],
    ])
    expect(proxied[0].auth).toBe('Bearer sub-token')
    expect(r.tables.diagnostico_leads).toEqual({ pending: 1, subscribed: 0, failed: 1 })
    expect(r.tables.newsletter_signups).toEqual({ pending: 2, subscribed: 2, failed: 0 })
    expect(patches).toHaveLength(4)
    expect(patches.some((u) => u.includes('id=eq.d1'))).toBe(false)
    expect(patches.every((u) => u.includes('newsletter_synced_at=is.null'))).toBe(true)
  })

  it('dry_run cuenta sin llamar al proxy ni marcar', async () => {
    const { proxied, patches } = backend({ starter_leads: [{ id: 's1', email: 'a@x.com' }] })
    const r = await runNewsletterSync(CONFIG, { dryRun: true })
    expect(r.tables.starter_leads.pending).toBe(1)
    expect(proxied).toHaveLength(0)
    expect(patches).toHaveLength(0)
  })

  it('una tabla que no responde no frena las demás', async () => {
    const f = vi.fn(async (url: string, init: any = {}) => {
      if (url.includes('/starter_leads?')) return { ok: false, status: 500, json: async () => ({}) }
      if (url === CONFIG.proxyUrl) return { ok: true, status: 200, json: async () => ({}) }
      if (init.method === 'PATCH') return { ok: true, status: 204 }
      return { ok: true, status: 200, json: async () => (url.includes('/demo_leads?') ? [{ id: 'm1', email: 'm@x.com' }] : []) }
    })
    vi.stubGlobal('fetch', f)
    const r = await runNewsletterSync(CONFIG)
    expect(r.errors).toEqual(['rest_get_failed_starter_leads_500'])
    expect(r.tables.demo_leads.subscribed).toBe(1)
  })

  it('producto inválido en newsletter_signups cuenta como fallo, sin llamar al proxy', async () => {
    expect(productOf(SYNC_SOURCES[4], { id: 'x', email: 'a@x.com', product: 'otro' })).toBeNull()
    const { proxied } = backend({ newsletter_signups: [{ id: 'n1', email: 'a@x.com', product: 'otro' }] })
    const r = await runNewsletterSync(CONFIG)
    expect(r.tables.newsletter_signups.failed).toBe(1)
    expect(proxied).toHaveLength(0)
  })

  it('sin proxy configurado no suscribe a nadie', async () => {
    const { proxied, patches } = backend({ starter_leads: [{ id: 's1', email: 'a@x.com' }] })
    const r = await runNewsletterSync({ ...CONFIG, proxyToken: undefined })
    expect(r.tables.starter_leads.failed).toBe(1)
    expect(proxied).toHaveLength(0)
    expect(patches).toHaveLength(0)
  })
})
