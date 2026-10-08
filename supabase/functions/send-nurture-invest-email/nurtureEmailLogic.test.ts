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
  type InvestLead,
  type NurtureEmailConfig,
} from './nurtureEmailLogic.ts'

const CONFIG: NurtureEmailConfig = {
  supabaseUrl: 'https://proj.supabase.co',
  serviceRole: 'srv-key',
  resendApiKey: 're_key',
  fromEmail: 'MOY IQ Invest <invest@moyiq.app>',
  cronSecret: 'sekret',
  landingUrl: 'https://invest.moyiq.app',
}

const LEAD: InvestLead = { id: 'lead-1', email: 'lead@ejemplo.com', perfil: 'moderado' }

afterEach(() => { vi.unstubAllGlobals() })

describe('renderEmail', () => {
  const MODES = ['welcome', 'day2', 'day5'] as const

  it('welcome muestra el perfil calculado y apunta a /app', () => {
    const r = renderEmail('welcome', LEAD, CONFIG)
    expect(r.subject).toContain('Moderado')
    expect(r.html).toContain('Moderado')
    expect(r.html).toContain('Abrir MOY IQ Invest')
    expect(r.html).toContain('https://invest.moyiq.app/app?ref=invest-welcome')
    expect(r.html).toContain('unsubscribe.html?id=lead-1&t=invest')
  })

  it('welcome usa la paleta oscura/dorada de Invest, no la clara de MOY IQ', () => {
    const r = renderEmail('welcome', LEAD, CONFIG)
    expect(r.html).toContain('#12161F')
    expect(r.html).toContain('#181D29')
    expect(r.html).toContain('#CC9A52')
  })

  it('welcome ajusta el copy según el perfil conservador', () => {
    const r = renderEmail('welcome', { ...LEAD, perfil: 'conservador' }, CONFIG)
    expect(r.html).toContain('Conservador')
    expect(r.html).toContain('preservar tu capital')
  })

  it('welcome ajusta el copy según el perfil agresivo', () => {
    const r = renderEmail('welcome', { ...LEAD, perfil: 'agresivo' }, CONFIG)
    expect(r.html).toContain('Agresivo')
    expect(r.html).toContain('horizonte largo')
  })

  it('welcome no sugiere un mix de cartera', () => {
    for (const perfil of ['conservador', 'moderado', 'agresivo'] as const) {
      const r = renderEmail('welcome', { ...LEAD, perfil }, CONFIG)
      expect(r.html).not.toMatch(/mix sugerido|renta variable|cripto/i)
      expect(r.html).toContain('no una recomendación de inversión')
    }
  })

  it('day2 explica el Position Builder con tu regla de riesgo', () => {
    const r = renderEmail('day2', LEAD, CONFIG)
    expect(r.html).toContain('Position Builder')
    expect(r.html).toContain('Con tu regla de riesgo')
    expect(r.html).not.toMatch(/óptimo/i)
    expect(r.html).toContain('ref=invest-d2')
  })

  it('day5 describe la beta pública gratuita sin planes ni precios', () => {
    const r = renderEmail('day5', LEAD, CONFIG)
    expect(r.html).toContain('beta pública gratuita')
    expect(r.html).toContain('ref=invest-d5')
    expect(r.html).not.toContain('#pricing')
  })

  it('los 3 correos llevan el disclaimer, mencionan la beta y conservan el unsubscribe', () => {
    for (const mode of MODES) {
      const r = renderEmail(mode, LEAD, CONFIG)
      expect(r.html).toContain('Herramienta educativa. No es asesoría financiera ni ejecuta órdenes.')
      expect(r.html).toMatch(/beta pública/)
      expect(r.html).toContain('https://invest.moyiq.app/app')
      expect(r.html).toContain('unsubscribe.html?id=lead-1&t=invest')
    }
  })

  it('ningún correo usa claims prohibidos por el relanzamiento', () => {
    const banned = [/tiempo real/i, /\bPro\b/, /trial/i, /prueba gratis/i, /US\$/, /\$\d/, /\/100/, /AI Advisor/i, /óptimo/i, /[¡!]/, /\bpodés\b|\btenés\b|\bquerés\b/]
    for (const mode of MODES) {
      for (const perfil of ['conservador', 'moderado', 'agresivo'] as const) {
        const r = renderEmail(mode, { ...LEAD, perfil }, CONFIG)
        for (const re of banned) {
          expect(r.subject + r.html).not.toMatch(re)
        }
      }
    }
  })
})

describe('unsubscribeUrl', () => {
  it('arma la url con t=invest', () => {
    expect(unsubscribeUrl(CONFIG, 'abc')).toBe('https://invest.moyiq.app/unsubscribe.html?id=abc&t=invest')
  })
})

describe('sendViaResend', () => {
  it('falla limpio si no hay api key configurada', async () => {
    const res = await sendViaResend('a@b.com', { subject: 's', html: 'h' }, { ...CONFIG, resendApiKey: undefined })
    expect(res.ok).toBe(false)
    expect(res.error).toBe('resend_not_configured')
  })

  it('reintenta una vez si el primer intento falla y después funciona', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'err' })
      .mockResolvedValueOnce({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    const res = await sendViaResend('a@b.com', { subject: 's', html: 'h' }, CONFIG)
    expect(res.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('devuelve error tras 2 fallos consecutivos', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'err' })
    vi.stubGlobal('fetch', fetchMock)
    const res = await sendViaResend('a@b.com', { subject: 's', html: 'h' }, CONFIG)
    expect(res.ok).toBe(false)
    expect(res.error).toBe('resend_500: err')
  })
})

describe('fetchLeadById', () => {
  it('pide id,email,perfil filtrando por id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [LEAD] })
    vi.stubGlobal('fetch', fetchMock)
    const lead = await fetchLeadById('lead-1', CONFIG)
    expect(lead).toEqual(LEAD)
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('invest_leads?id=eq.lead-1')
    expect(url).toContain('select=id,email,perfil')
  })

  it('devuelve null si no hay filas', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    vi.stubGlobal('fetch', fetchMock)
    const lead = await fetchLeadById('nope', CONFIG)
    expect(lead).toBeNull()
  })
})

describe('fetchEligibleForEmail2 / fetchEligibleForEmail3', () => {
  it('email2 filtra por unsubscribed/consent/account_created/email2_sent', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    vi.stubGlobal('fetch', fetchMock)
    await fetchEligibleForEmail2(CONFIG)
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('unsubscribed_at=is.null')
    expect(url).toContain('consent_marketing=is.true')
    expect(url).toContain('account_created_at=is.null')
    expect(url).toContain('email2_sent_at=is.null')
  })

  it('email3 exige email2_sent_at no nulo y >= 3 días', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    vi.stubGlobal('fetch', fetchMock)
    await fetchEligibleForEmail3(CONFIG)
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('email3_sent_at=is.null')
    expect(url).toContain('email2_sent_at=not.is.null')
    expect(url).toContain('email2_sent_at=lte.')
  })
})

describe('markSent', () => {
  it('patchea la columna correcta según el modo', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    await markSent('lead-1', 'welcome', CONFIG)
    expect(fetchMock.mock.calls[0][1].body).toContain('email1_sent_at')
    await markSent('lead-1', 'day2', CONFIG)
    expect(fetchMock.mock.calls[1][1].body).toContain('email2_sent_at')
    await markSent('lead-1', 'day5', CONFIG)
    expect(fetchMock.mock.calls[2][1].body).toContain('email3_sent_at')
  })
})

describe('runCronBatch', () => {
  it('procesa email2 y email3 y cuenta sent/failed', async () => {
    const fetchMock = vi.fn()
      // fetchEligibleForEmail2
      .mockResolvedValueOnce({ ok: true, json: async () => [LEAD] })
      // sendViaResend for email2
      .mockResolvedValueOnce({ ok: true, status: 200 })
      // markSent for email2
      .mockResolvedValueOnce({ ok: true })
      // fetchEligibleForEmail3
      .mockResolvedValueOnce({ ok: true, json: async () => [{ ...LEAD, id: 'lead-2' }] })
      // sendViaResend for email3 fails twice
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'err' })
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'err' })
    vi.stubGlobal('fetch', fetchMock)
    const result = await runCronBatch(CONFIG)
    expect(result.email2).toEqual({ attempted: 1, sent: 1, failed: 0 })
    expect(result.email3).toEqual({ attempted: 1, sent: 0, failed: 1 })
  })
})
