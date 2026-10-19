import { describe, it, expect, vi } from 'vitest'
import { buildCronHealthReport, runCronHealth, type CronHealthRow } from './cronHealthLogic.ts'

const NOW = new Date('2026-10-19T15:03:00Z')
const row = (o: Partial<CronHealthRow>): CronHealthRow => ({ jobid: 1, jobname: 'starter-nurture-daily', schedule: '27 14 * * *', active: true, last_run_at: '2026-10-19T14:27:00Z', last_run_status: 'succeeded', last_http_status: 200, problem: null, ok: true, ...o })

describe('buildCronHealthReport', () => {
  it('todo bien: sin aviso', () => {
    const r = buildCronHealthReport([row({})], [], NOW)
    expect(r.subject).toBeNull()
    expect(r.problems).toEqual([])
  })
  it('el caso del 18-oct: 401 con la corrida "succeeded" se avisa', () => {
    const r = buildCronHealthReport([row({ ok: false, problem: 'http_error', last_http_status: 401 })], [], NOW)
    expect(r.subject).toBe('[MOY IQ] cron con problemas: 1')
    expect(r.text).toContain('starter-nurture-daily')
    expect(r.text).toContain('último HTTP 401')
  })
  it('un job que no corrió y uno pausado: solo avisa el primero', () => {
    const r = buildCronHealthReport([row({ ok: false, problem: 'overdue' }), row({ jobname: 'x', active: false, ok: true, problem: 'paused' })], [], NOW)
    expect(r.problems).toHaveLength(1)
    expect(r.text).toContain('no corrió en su horario')
  })
  it('respuestas ≠ 2xx de 24 h, incluidas las de triggers sin job', () => {
    const r = buildCronHealthReport([row({})], [
      { request_id: 9, jobname: null, status_code: 401, timed_out: false, error_msg: null, content_head: '{"code":"UNAUTHORIZED"}', responded_at: '2026-10-19T10:00:00Z' },
      { request_id: 10, jobname: 'fnos-push-trial-reminders', status_code: null, timed_out: true, error_msg: null, content_head: null, responded_at: '2026-10-19T14:00:05Z' },
    ], NOW)
    expect(r.problems).toHaveLength(2)
    expect(r.text).toContain('llamada HTTP sin job (trigger): HTTP 401')
    expect(r.text).toContain('fnos-push-trial-reminders: timeout')
  })
})

describe('runCronHealth', () => {
  function fake(rows: CronHealthRow[], failures: any[] = []) {
    const calls: any[] = []
    const f = vi.fn(async (url: string, init?: any) => {
      calls.push({ url, init })
      if (url.includes('/rpc/cron_health_snapshot')) return new Response('3', { status: 200 })
      if (url.includes('/cron_health?')) return new Response(JSON.stringify(rows), { status: 200 })
      if (url.includes('/cron_http_log?')) return new Response(JSON.stringify(failures), { status: 200 })
      if (url.includes('api.resend.com')) return new Response('{"id":"e"}', { status: 200 })
      return new Response('?', { status: 500 })
    })
    return { f: f as unknown as typeof fetch, calls }
  }
  const cfg = (f: typeof fetch) => ({ supabaseUrl: 'https://x.supabase.co', serviceRole: 'srv', getEnv: (n: string) => (n === 'NURTURE_RESEND_API_KEY' ? 're' : undefined), fetchImpl: f })

  it('refresca el log antes de leer la vista y no manda nada si todo está bien', async () => {
    const { f, calls } = fake([row({})])
    const r = await runCronHealth(cfg(f), NOW)
    expect(calls[0].url).toContain('/rpc/cron_health_snapshot')
    expect(r).toMatchObject({ jobs: 1, problems: [], sent: null })
    expect(calls.some((c) => c.url.includes('resend'))).toBe(false)
  })
  it('con problemas manda un solo correo a la casilla de la empresa', async () => {
    const { f, calls } = fake([row({ ok: false, problem: 'http_error', last_http_status: 401 })])
    const r = await runCronHealth(cfg(f), NOW)
    expect(r.sent).toBe(true)
    const mails = calls.filter((c) => c.url.includes('resend'))
    expect(mails).toHaveLength(1)
    expect(JSON.parse(mails[0].init.body).to).toEqual(['maxnovaluciglobal@gmail.com'])
  })
  it('modo check: informe sin correo', async () => {
    const { f, calls } = fake([row({ ok: false, problem: 'http_error', last_http_status: 500 })])
    const r = await runCronHealth(cfg(f), NOW, { dryRun: true })
    expect(r.problems).toHaveLength(1)
    expect(calls.some((c) => c.url.includes('resend'))).toBe(false)
  })
  it('pide las fallas de las últimas 24 h con el filtro de ≠ 2xx', async () => {
    const { f, calls } = fake([row({})])
    await runCronHealth(cfg(f), NOW)
    const q = calls.find((c) => c.url.includes('/cron_http_log?')).url
    expect(q).toContain('responded_at=gte.' + encodeURIComponent('2026-10-18T15:03:00.000Z'))
    expect(q).toContain('status_code.lt.200,status_code.gte.300')
  })
})
