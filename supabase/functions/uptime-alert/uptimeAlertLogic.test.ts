import { describe, it, expect, vi } from 'vitest'
import { runUptimeAlert } from './uptimeAlertLogic.ts'

const NOW = new Date('2026-10-19T12:00:00Z')
type Db = { sites: any[]; states: any[]; checks: Record<string, any[]> }

function fakeFetch(db: Db, opts: { resendStatus?: number } = {}) {
  const calls: { url: string; init?: any }[] = []
  const f = vi.fn(async (url: string, init?: any) => {
    calls.push({ url, init })
    const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
    if (url.startsWith('https://api.resend.com')) return ok({ id: 'x' }, opts.resendStatus ?? 200)
    if (url.includes('/uptime_sites?')) return ok(db.sites)
    if (url.includes('/uptime_state?select')) return ok(db.states)
    if (url.includes('/uptime_state?on_conflict')) return new Response(null, { status: 201 })
    const m = url.match(/uptime_checks\?site=eq\.([^&]+)/)
    if (m) return ok(db.checks[decodeURIComponent(m[1])] ?? [])
    return ok({ error: 'unexpected ' + url }, 500)
  })
  return { f: f as unknown as typeof fetch, calls }
}
const fail = (id: number, min: number) => ({ id, requested_at: new Date(NOW.getTime() - min * 60000).toISOString(), ok: false, status_code: 503, timed_out: false, marker_found: false, error_msg: null })
const good = (id: number, min: number) => ({ ...fail(id, min), ok: true, status_code: 200, marker_found: true })
const config = (f: typeof fetch) => ({ supabaseUrl: 'https://x.supabase.co', serviceRole: 'srv', getEnv: (n: string) => (n === 'NURTURE_RESEND_API_KEY' ? 're_test' : undefined), fetchImpl: f })

describe('runUptimeAlert', () => {
  const sites = [{ site: 'app.moyiq.app', url: 'https://app.moyiq.app/app/' }, { site: 'moyiq.app', url: 'https://moyiq.app/' }]

  it('todo arriba: sin correos', async () => {
    const { f, calls } = fakeFetch({ sites, states: [], checks: { 'app.moyiq.app': [good(2, 0), good(1, 5)], 'moyiq.app': [good(4, 0)] } })
    const r = await runUptimeAlert(config(f), NOW)
    expect(r.map((x) => x.action)).toEqual([null, null])
    expect(calls.some((c) => c.url.includes('resend'))).toBe(false)
  })

  it('dos fallas: un correo a la casilla de la empresa desde hola@moyiq.app y guarda el estado caído', async () => {
    const { f, calls } = fakeFetch({ sites, states: [], checks: { 'app.moyiq.app': [fail(3, 0), fail(2, 5), good(1, 10)], 'moyiq.app': [good(4, 0)] } })
    const r = await runUptimeAlert(config(f), NOW)
    expect(r[0]).toMatchObject({ site: 'app.moyiq.app', action: 'down', sent: true, status: 'down' })
    const mails = calls.filter((c) => c.url.includes('resend'))
    expect(mails).toHaveLength(1)
    const body = JSON.parse(mails[0].init.body)
    expect(body.to).toEqual(['maxnovaluciglobal@gmail.com'])
    expect(body.from).toBe('MOY IQ <hola@moyiq.app>')
    expect(body.subject).toBe('[MOY IQ] caída: app.moyiq.app')
    const upsert = calls.find((c) => c.url.includes('on_conflict=site'))
    expect(JSON.parse(upsert!.init.body)).toMatchObject({ site: 'app.moyiq.app', status: 'down' })
  })

  it('si Resend falla no guarda el estado (reintenta la próxima corrida)', async () => {
    const { f, calls } = fakeFetch({ sites, states: [], checks: { 'app.moyiq.app': [fail(3, 0), fail(2, 5)], 'moyiq.app': [] } }, { resendStatus: 500 })
    const r = await runUptimeAlert(config(f), NOW)
    expect(r[0]).toMatchObject({ action: 'down', sent: false })
    expect(calls.some((c) => c.url.includes('on_conflict=site'))).toBe(false)
  })

  it('modo check: no manda ni escribe', async () => {
    const { f, calls } = fakeFetch({ sites, states: [], checks: { 'app.moyiq.app': [fail(3, 0), fail(2, 5)], 'moyiq.app': [] } })
    const r = await runUptimeAlert(config(f), NOW, { dryRun: true })
    expect(r[0].action).toBe('down')
    expect(calls.some((c) => c.url.includes('resend') || c.url.includes('on_conflict'))).toBe(false)
  })

  it('caído que vuelve: correo de recuperación', async () => {
    const states = [{ site: 'moyiq.app', status: 'down', consecutive_failures: 2, down_since: '2026-10-19T11:40:00Z', last_alert_at: '2026-10-19T11:45:00Z', last_change_at: null, last_check_id: 5 }]
    const { f, calls } = fakeFetch({ sites, states, checks: { 'app.moyiq.app': [], 'moyiq.app': [good(7, 0), fail(6, 5)] } })
    const r = await runUptimeAlert(config(f), NOW)
    expect(r[1]).toMatchObject({ action: 'recovery', status: 'up', sent: true })
    expect(JSON.parse(calls.find((c) => c.url.includes('resend'))!.init.body).subject).toBe('[MOY IQ] recuperado: moyiq.app')
  })
})
