// supabase/functions/notify-admin-signup/notifyLogic.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderNotifyEmail, sendAdminNotify } from './notifyLogic.ts'

const CONFIG = { resendApiKey: 're_key', fromEmail: 'MOY IQ <hola@moyiq.app>', alertEmail: 'maxnovaluciglobal@gmail.com' }

describe('renderNotifyEmail', () => {
  it('starter_signup: asunto y contenido correctos', () => {
    const r = renderNotifyEmail('starter_signup', { email: 'lead@test.com', fuente: 'landing' })
    expect(r.subject).toBe('Nuevo Starter — MOY IQ')
    expect(r.html).toContain('lead@test.com')
    expect(r.html).toContain('landing')
    expect(r.html).toContain('Nuevo Starter')
  })
  it('invest_signup: asunto y contenido distintos', () => {
    const r = renderNotifyEmail('invest_signup', { email: 'inv@test.com' })
    expect(r.subject).toBe('Nuevo registro — Invest')
    expect(r.html).toContain('inv@test.com')
    expect(r.html).toContain('Nuevo en Invest')
  })
  it('sin fuente, no rompe y no muestra la línea de fuente', () => {
    const r = renderNotifyEmail('starter_signup', { email: 'x@test.com' })
    expect(r.html).not.toContain('fuente:')
  })
  it('incluye link al panel CRM', () => {
    const r = renderNotifyEmail('starter_signup', { email: 'x@test.com' })
    expect(r.html).toContain('admin=crm')
  })
})

describe('sendAdminNotify', () => {
  afterEach(() => vi.restoreAllMocks())

  it('manda a config.alertEmail con from correcto', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true })
    const res = await sendAdminNotify('starter_signup', { email: 'a@b.com' }, CONFIG)
    expect(res.ok).toBe(true)
    const body = JSON.parse((global.fetch as any).mock.calls[0][1].body)
    expect(body.to).toBe('maxnovaluciglobal@gmail.com')
    expect(body.from).toBe('MOY IQ <hola@moyiq.app>')
  })

  it('sin resendApiKey no llama a fetch', async () => {
    global.fetch = vi.fn()
    const res = await sendAdminNotify('starter_signup', { email: 'a@b.com' }, { ...CONFIG, resendApiKey: undefined })
    expect(res.ok).toBe(false)
    expect(res.error).toBe('resend_not_configured')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('reintenta una vez y funciona', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'boom' })
      .mockResolvedValueOnce({ ok: true })
    const res = await sendAdminNotify('invest_signup', { email: 'a@b.com' }, CONFIG)
    expect(res.ok).toBe(true)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('falla tras dos intentos', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' })
    const res = await sendAdminNotify('starter_signup', { email: 'a@b.com' }, CONFIG)
    expect(res.ok).toBe(false)
    expect(res.error).toBe('resend_500')
  })
})
