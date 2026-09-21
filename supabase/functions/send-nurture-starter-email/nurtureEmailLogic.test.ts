import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  renderEmail,
  unsubscribeUrl,
  sendViaResend,
  fetchLeadById,
  fetchEligibleForEmail2,
  fetchEligibleForEmail3,
  markSent,
  runCronBatch,
  type StarterLead,
  type NurtureEmailConfig,
} from './nurtureEmailLogic.ts'

const CONFIG: NurtureEmailConfig = {
  supabaseUrl: 'https://proj.supabase.co',
  serviceRole: 'srv-key',
  resendApiKey: 're_key',
  fromEmail: 'MOY IQ <hola@moyiq.app>',
  cronSecret: 'sekret',
  landingUrl: 'https://moyiq.app',
}

const LEAD: StarterLead = { id: 'lead-1', email: 'lead@ejemplo.com' }

afterEach(() => { vi.unstubAllGlobals() })

describe('renderEmail', () => {
  it('welcome apunta a importar movimientos, no a crear cuenta (ya es usuario)', () => {
    const r = renderEmail('welcome', LEAD, CONFIG)
    expect(r.html).toContain('Importar movimientos')
    expect(r.html).toContain('ref=starter-welcome')
    expect(r.html.toLowerCase()).not.toContain('crear cuenta')
    expect(r.html).toContain('unsubscribe.html?id=lead-1&t=starter')
  })

  it('day2 explica el IQ Score y apunta al dashboard', () => {
    const r = renderEmail('day2', LEAD, CONFIG)
    expect(r.html).toContain('IQ Score')
    expect(r.html).toContain('ref=starter-d2')
  })

  it('day5 no menciona ningún trial — Pro no tiene trial', () => {
    const r = renderEmail('day5', LEAD, CONFIG)
    expect(r.html.toLowerCase()).not.toContain('trial')
    expect(r.html).toContain('ref=starter-d5')
  })

  it('day5 no incluye ningún testimonio inventado (misma regla que diagnóstico)', () => {
    const r = renderEmail('day5', LEAD, CONFIG)
    expect(r.html).toContain('No te vamos a inventar un testimonio')
  })

  it('day5 detalla Starter vs Pro sin prometer nada no sostenible', () => {
    const r = renderEmail('day5', LEAD, CONFIG)
    expect(r.html).toContain('Starter')
    expect(r.html).toContain('Pro')
  })
})

describe('unsubscribeUrl', () => {
  it('usa el id uuid del lead y marca t=starter para el RPC correcto', () => {
    const url = unsubscribeUrl(CONFIG, 'abc-123')
    expect(url).toBe('https://moyiq.app/unsubscribe.html?id=abc-123&t=starter')
    expect(url).not.toContain('@')
  })
})

describe('sendViaResend', () => {
  const rendered = { subject: 'Asunto', html: '<p>hola</p>' }

  it('falla sin llamar a la red si no hay RESEND_API_KEY', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const result = await sendViaResend('a@b.com', rendered, { ...CONFIG, resendApiKey: undefined })
    expect(result).toEqual({ ok: false, error: 'resend_not_configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('manda con el remitente configurado (hola@moyiq.app)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    expect(await sendViaResend('a@b.com', rendered, CONFIG)).toEqual({ ok: true })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.from).toBe('MOY IQ <hola@moyiq.app>')
    expect(body.to).toBe('a@b.com')
  })

  it('reintenta una vez ante un fallo transitorio', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'down' })
      .mockResolvedValueOnce({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    expect(await sendViaResend('a@b.com', rendered, CONFIG)).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('devuelve error si Resend falla dos veces seguidas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'down' }))
    expect(await sendViaResend('a@b.com', rendered, CONFIG)).toEqual({ ok: false, error: 'resend_500' })
  })
})

describe('fetchLeadById', () => {
  it('devuelve el primer resultado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [LEAD] }))
    expect(await fetchLeadById('lead-1', CONFIG)).toEqual(LEAD)
  })
  it('devuelve null si no hay resultados', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }))
    expect(await fetchLeadById('lead-x', CONFIG)).toBeNull()
  })
})

describe('fetchEligibleForEmail2', () => {
  it('filtra por unsubscribed_at/consent_marketing/account_created_at/email2_sent_at, sin filtro de edad', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [LEAD] })
    vi.stubGlobal('fetch', fetchMock)
    await fetchEligibleForEmail2(CONFIG)
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('starter_leads?')
    expect(url).toContain('unsubscribed_at=is.null')
    expect(url).toContain('consent_marketing=is.true')
    expect(url).toContain('account_created_at=is.null')
    expect(url).toContain('email2_sent_at=is.null')
    expect(url).not.toContain('created_at=lte') // sin filtro de edad, a propósito
  })
})

describe('fetchEligibleForEmail3', () => {
  it('exige email2_sent_at no nulo y anterior al corte de 3 días — nunca salta el email 2', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [LEAD] })
    vi.stubGlobal('fetch', fetchMock)
    await fetchEligibleForEmail3(CONFIG)
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('starter_leads?')
    expect(url).toContain('email3_sent_at=is.null')
    expect(url).toContain('email2_sent_at=not.is.null')
    expect(url).toContain('email2_sent_at=lte.')
  })
})

describe('markSent', () => {
  it('escribe la columna correcta según el modo', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    await markSent('lead-1', 'day2', CONFIG)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(Object.keys(body)).toEqual(['email2_sent_at'])
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('starter_leads?')
  })
})

describe('runCronBatch', () => {
  it('manda día2 a los elegibles y día5 a los que ya tienen email2_sent_at vencido, marcando cada envío', async () => {
    const lead2 = { id: 'l2', email: 'l2@x.com' }
    const lead3 = { id: 'l3', email: 'l3@x.com' }

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('email2_sent_at=is.null')) {
        return Promise.resolve({ ok: true, json: async () => [lead2] })
      }
      if (typeof url === 'string' && url.includes('email3_sent_at=is.null')) {
        return Promise.resolve({ ok: true, json: async () => [lead3] })
      }
      if (typeof url === 'string' && url.includes('api.resend.com')) {
        return Promise.resolve({ ok: true })
      }
      // PATCH de markSent
      return Promise.resolve({ ok: true })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await runCronBatch(CONFIG)
    expect(result.email2).toEqual({ attempted: 1, sent: 1, failed: 0 })
    expect(result.email3).toEqual({ attempted: 1, sent: 1, failed: 0 })
  })

  it('cuenta fallos de Resend sin tirar la corrida completa', async () => {
    const lead2 = { id: 'l2', email: 'l2@x.com' }
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('email2_sent_at=is.null')) {
        return Promise.resolve({ ok: true, json: async () => [lead2] })
      }
      if (typeof url === 'string' && url.includes('email3_sent_at=is.null')) {
        return Promise.resolve({ ok: true, json: async () => [] })
      }
      if (typeof url === 'string' && url.includes('api.resend.com')) {
        return Promise.resolve({ ok: false, status: 500, text: async () => 'down' })
      }
      return Promise.resolve({ ok: true })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await runCronBatch(CONFIG)
    expect(result.email2.attempted).toBe(1)
    expect(result.email2.sent).toBe(0)
    expect(result.email2.failed).toBe(1)
  })
})
