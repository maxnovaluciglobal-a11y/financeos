import { describe, it, expect, vi, afterEach } from 'vitest'
import { EMAIL_BRAND, EMAIL_LOGO_URL } from '../_shared/emailLayout.ts'
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
  processWelcome,
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

  it('welcome usa el layout de marca compartido con la etiqueta Invest (BRD-5)', () => {
    const r = renderEmail('welcome', LEAD, CONFIG)
    expect(r.html).toContain(EMAIL_LOGO_URL)
    expect(r.html).toContain(`background:${EMAIL_BRAND.laton}`)
    expect(r.html).toContain(`color:${EMAIL_BRAND.latonDark}">Invest<`)
    expect(r.html).not.toContain('#12161F')
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
    const banned = [/tiempo real/i, /\bPro\b/, /trial/i, /prueba gratis/i, /US\$/, /\$\d/, /\/100/, /AI Advisor/i, /óptimo/i, /¡|!(?!doctype html>)/, /\bpodés\b|\btenés\b|\bquerés\b/]
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
    expect(unsubscribeUrl(CONFIG, 'abc')).toBe('https://moyiq.app/unsubscribe.html?id=abc&t=invest')
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
    expect(url).toContain('consent_confirmed_at=not.is.null') // doble opt-in: solo confirmados
  })

  it('email3 exige email2_sent_at no nulo y >= 3 días', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    vi.stubGlobal('fetch', fetchMock)
    await fetchEligibleForEmail3(CONFIG)
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('email3_sent_at=is.null')
    expect(url).toContain('consent_confirmed_at=not.is.null') // doble opt-in: solo confirmados
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

const BASE_ROW = { email: 'lead@ejemplo.com', perfil: 'moderado' }

describe('processWelcome (bienvenida: una sola vez y nunca a quien se dio de baja)', () => {
  const ID = '0b6f1c2e-3d4a-4b5c-8d9e-0f1a2b3c4d5e'
  const row = (over = {}) => ({ ...BASE_ROW, id: ID, ...over })
  function router(r: any) {
    return vi.fn(async (url: string, init: any = {}) => {
      if (url.startsWith('https://api.resend.com')) return { ok: true, status: 200, json: async () => ({}), text: async () => '' }
      if ((init.method ?? 'GET') === 'GET') return { ok: true, json: async () => (r ? [r] : []) }
      return { ok: true, json: async () => [{ id: ID }] }
    })
  }
  const resendCalls = (m: any) => m.mock.calls.filter((c: any[]) => c[0].startsWith('https://api.resend.com'))

  it('rechaza un id que no es uuid sin tocar la red', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    expect(await processWelcome('x', CONFIG)).toEqual({ ok: false, error: 'invalid_lead_id' })
    expect(f).not.toHaveBeenCalled()
  })

  it('lead inexistente', async () => {
    vi.stubGlobal('fetch', router(null))
    expect(await processWelcome(ID, CONFIG)).toEqual({ ok: false, error: 'lead_not_found' })
  })

  it('no repite el envío si email1_sent_at ya está marcado', async () => {
    const f = router(row({ email1_sent_at: '2026-10-08T12:00:00Z' })); vi.stubGlobal('fetch', f)
    expect(await processWelcome(ID, CONFIG)).toEqual({ ok: true, state: 'already_sent' })
    expect(resendCalls(f)).toHaveLength(0)
  })

  it('no manda nada a quien se dio de baja', async () => {
    const f = router(row({ unsubscribed_at: '2026-10-08T12:00:00Z' })); vi.stubGlobal('fetch', f)
    expect(await processWelcome(ID, CONFIG)).toEqual({ ok: true, state: 'unsubscribed' })
    expect(resendCalls(f)).toHaveLength(0)
  })

  it('no manda si otra fila con la misma dirección ya recibió la bienvenida (tope por dirección)', async () => {
    const other = { ...BASE_ROW, id: 'otra', email1_sent_at: '2026-10-01T00:00:00Z' }
    const f = vi.fn(async (url: string, init: any = {}) => {
      if (url.startsWith('https://api.resend.com')) return { ok: true, status: 200, json: async () => ({}), text: async () => '' }
      if ((init.method ?? 'GET') === 'GET') return { ok: true, json: async () => (url.includes('email=ilike.') ? [row(), other] : [row()]) }
      return { ok: true, json: async () => [{ id: ID }] }
    })
    vi.stubGlobal('fetch', f)
    expect(await processWelcome(ID, CONFIG)).toEqual({ ok: true, state: 'already_sent' })
    expect(resendCalls(f)).toHaveLength(0)
  })

  it('si Resend falla, libera la fila para reintentar', async () => {
    const f = vi.fn(async (url: string, init: any = {}) => {
      if (url.startsWith('https://api.resend.com')) return { ok: false, status: 422, json: async () => ({}), text: async () => 'bad' }
      if ((init.method ?? 'GET') === 'GET') return { ok: true, json: async () => [row()] }
      return { ok: true, json: async () => [{ id: ID }] }
    })
    vi.stubGlobal('fetch', f)
    const r = await processWelcome(ID, CONFIG)
    expect(r.ok).toBe(false)
    const patches = f.mock.calls.filter((c: any[]) => c[1]?.method === 'PATCH').map((c: any[]) => JSON.parse(c[1].body))
    expect(patches.at(-1)).toEqual({ email1_sent_at: null })
  })

  it('manda una vez y marca email1_sent_at', async () => {
    const f = router(row()); vi.stubGlobal('fetch', f)
    expect(await processWelcome(ID, CONFIG)).toEqual({ ok: true })
    expect(resendCalls(f)).toHaveLength(1)
    expect(f.mock.calls.some((c: any[]) => (c[1]?.method ?? 'GET') === 'PATCH')).toBe(true)
  })
})

describe('C-35 · List-Unsubscribe y dirección postal (COM-9)', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('el correo trae baja con un clic a lead-unsubscribe y la dirección de la LLC', () => {
    const r = renderEmail('welcome', LEAD, CONFIG)
    expect(r.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
    expect(r.headers?.['List-Unsubscribe']).toContain(`/functions/v1/lead-unsubscribe?t=invest&id=${LEAD.id}`)
    expect(r.headers?.['List-Unsubscribe']).toContain('mailto:support@moyiq.app')
    expect(r.html).toContain('10482 NW 31st Terrace, Office 1D, Doral, FL 33172, USA')
  })

  it('sendViaResend manda las cabeceras a Resend', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', f)
    await sendViaResend('a@x.com', renderEmail('welcome', LEAD, CONFIG), CONFIG)
    const body = JSON.parse(f.mock.calls[0][1].body)
    expect(body.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })
})

describe('C-35 · bienvenida de Invest con select acotado (COM-7)', () => {
  afterEach(() => { vi.unstubAllGlobals() })
  it('fetchLeadById pide las columnas de control (email1_sent_at, unsubscribed_at), no select=*', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    vi.stubGlobal('fetch', f)
    await fetchLeadById(LEAD.id, CONFIG)
    expect(f.mock.calls[0][0]).toContain('select=id,email,perfil,email1_sent_at,unsubscribed_at&')
  })
})
