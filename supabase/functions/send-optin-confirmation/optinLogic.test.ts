import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  processOptin,
  renderOptinEmail,
  confirmUrl,
  COPY,
  SOURCES,
  type OptinRow,
} from './optinLogic.ts'

const ID = '0b6f1c2e-3d4a-4b5c-8d9e-0f1a2b3c4d5e'
const TOKEN = '9f8e7d6c-5b4a-4321-8fed-cba987654321'
const CONFIG = {
  supabaseUrl: 'https://proj.supabase.co',
  serviceRole: 'srv-key',
  resendApiKey: 're_key',
  fromEmail: 'MOY IQ <hola@moyiq.app>',
  replyTo: 'support@moyiq.app',
  landingUrl: 'https://moyiq.app/',
}

function row(over: Partial<OptinRow> = {}): OptinRow {
  return {
    id: ID,
    email: 'ana@example.com',
    lang: 'es',
    consent_marketing: true,
    consent_token: TOKEN,
    consent_confirmed_at: null,
    optin_email_sent_at: null,
    ...over,
  }
}

const ok = (body: unknown = {}) => ({ ok: true, status: 200, json: async () => body, text: async () => '' })
const fail = (status: number) => ({ ok: false, status, json: async () => ({}), text: async () => 'err' })

// GET de la fila (id=eq), GET del rate limit (optin_email_sent_at=gte), PATCH claim/release, POST a Resend.
function router(opts: { row?: OptinRow | null; recent?: number; claim?: boolean; resend?: any[] } = {}) {
  const resend = opts.resend ? [...opts.resend] : null
  return vi.fn(async (url: string, init: any = {}) => {
    if (url.startsWith('https://api.resend.com')) return resend ? resend.shift() ?? ok() : ok()
    if ((init.method ?? 'GET') === 'GET') {
      if (url.includes('optin_email_sent_at=gte.')) return ok(Array.from({ length: opts.recent ?? 0 }, (_, i) => ({ id: String(i) })))
      return ok(opts.row === null ? [] : [opts.row ?? row()])
    }
    if (init.method === 'PATCH') {
      if (init.headers?.Prefer === 'return=representation') return ok(opts.claim === false ? [] : [{ id: ID }])
      return ok()
    }
    throw new Error('unexpected ' + url)
  })
}
const resendCalls = (m: any) => m.mock.calls.filter((c: any[]) => c[0].startsWith('https://api.resend.com'))

afterEach(() => { vi.unstubAllGlobals() })

describe('confirmUrl', () => {
  it('es y pt van a /confirmar.html, en y de a /en/confirm.html, con el token en ?t=', () => {
    expect(confirmUrl(CONFIG.landingUrl, 'es', TOKEN)).toBe(`https://moyiq.app/confirmar.html?t=${TOKEN}`)
    expect(confirmUrl(CONFIG.landingUrl, 'pt', TOKEN)).toBe(`https://moyiq.app/confirmar.html?t=${TOKEN}`)
    expect(confirmUrl(CONFIG.landingUrl, 'en', TOKEN)).toBe(`https://moyiq.app/en/confirm.html?t=${TOKEN}`)
    expect(confirmUrl(CONFIG.landingUrl, 'de', TOKEN)).toBe(`https://moyiq.app/en/confirm.html?t=${TOKEN}`)
  })
})

describe('renderOptinEmail', () => {
  it('es: asunto, enlace con el token, aviso de que sin confirmar no hay marketing; sin publicidad ni exclamaciones', () => {
    const e = renderOptinEmail(row(), CONFIG)
    expect(e.subject).toBe(COPY.es.subject)
    expect(e.html).toContain(`https://moyiq.app/confirmar.html?t=${TOKEN}`)
    expect(e.text).toContain(`https://moyiq.app/confirmar.html?t=${TOKEN}`)
    expect(e.text).toContain('sin confirmación no te enviamos correos de marketing')
    expect(e.text + e.subject).not.toMatch(/[!¡]/)
    expect(e.html).not.toMatch(/US\$|Pro\b|upgrade|signup/i)
  })

  it('en/pt/de usan su idioma; de en "Sie"; idioma desconocido cae a español', () => {
    expect(renderOptinEmail(row({ lang: 'en' }), CONFIG).subject).toBe(COPY.en.subject)
    expect(renderOptinEmail(row({ lang: 'pt' }), CONFIG).subject).toBe(COPY.pt.subject)
    const de = renderOptinEmail(row({ lang: 'de' }), CONFIG)
    expect(de.subject).toBe(COPY.de.subject)
    expect(de.text).toContain('Anmeldung bestätigen')
    expect(de.text).not.toMatch(/\bdu\b|\bdein/i)
    expect(renderOptinEmail(row({ lang: 'fr' }), CONFIG).subject).toBe(COPY.es.subject)
    expect(renderOptinEmail(row({ lang: undefined }), CONFIG).subject).toBe(COPY.es.subject)
  })

  it('los 4 idiomas tienen las mismas claves', () => {
    const keys = (o: object) => Object.keys(o).sort().join()
    for (const l of ['en', 'pt', 'de'] as const) expect(keys(COPY[l])).toBe(keys(COPY.es))
  })
})

describe('processOptin', () => {
  it('valida source e id sin tocar la red', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    expect(await processOptin({ source: 'invest', id: ID }, CONFIG)).toEqual({ ok: false, error: 'invalid_source' })
    expect(await processOptin({ source: 'starter', id: 'x' }, CONFIG)).toEqual({ ok: false, error: 'invalid_id' })
    expect(await processOptin(null, CONFIG)).toEqual({ ok: false, error: 'invalid_source' })
    expect(f).not.toHaveBeenCalled()
  })

  it('las tres fuentes apuntan a su tabla', () => {
    expect(SOURCES).toEqual({ starter: 'starter_leads', diagnostico: 'diagnostico_leads', demo: 'demo_leads' })
  })

  it('sin API key de Resend no lee nada', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    expect(await processOptin({ source: 'starter', id: ID }, { ...CONFIG, resendApiKey: undefined })).toEqual({ ok: false, error: 'resend_not_configured' })
    expect(f).not.toHaveBeenCalled()
  })

  it('404 lógico si la fila no existe', async () => {
    vi.stubGlobal('fetch', router({ row: null }))
    expect(await processOptin({ source: 'demo', id: ID }, CONFIG)).toEqual({ ok: false, error: 'not_found' })
  })

  it('no manda nada a quien no marcó la casilla o no tiene token', async () => {
    for (const r of [row({ consent_marketing: false }), row({ consent_token: null })]) {
      const f = router({ row: r }); vi.stubGlobal('fetch', f)
      expect(await processOptin({ source: 'starter', id: ID }, CONFIG)).toEqual({ ok: false, error: 'no_consent' })
      expect(resendCalls(f)).toHaveLength(0)
    }
  })

  it('idempotente: ya confirmado o ya enviado no manda de nuevo', async () => {
    let f = router({ row: row({ consent_confirmed_at: '2026-10-08T12:00:00Z' }) }); vi.stubGlobal('fetch', f)
    expect(await processOptin({ source: 'starter', id: ID }, CONFIG)).toEqual({ ok: true, state: 'already_confirmed' })
    f = router({ row: row({ optin_email_sent_at: '2026-10-08T12:00:00Z' }) }); vi.stubGlobal('fetch', f)
    expect(await processOptin({ source: 'starter', id: ID }, CONFIG)).toEqual({ ok: true, state: 'already_sent' })
    f = router({ claim: false }); vi.stubGlobal('fetch', f)
    expect(await processOptin({ source: 'starter', id: ID }, CONFIG)).toEqual({ ok: true, state: 'already_sent' })
    expect(resendCalls(f)).toHaveLength(0)
  })

  it('rate limit: 3 correos de confirmación a la misma dirección en 24 h corta', async () => {
    const f = router({ recent: 3 }); vi.stubGlobal('fetch', f)
    expect(await processOptin({ source: 'diagnostico', id: ID }, CONFIG)).toEqual({ ok: false, error: 'rate_limited' })
    expect(resendCalls(f)).toHaveLength(0)
    const q = f.mock.calls.find((c: any[]) => c[0].includes('optin_email_sent_at=gte.'))[0]
    expect(q).toContain('/rest/v1/diagnostico_leads?')
    expect(q).toContain('email=eq.ana%40example.com')
  })

  it('reclama con PATCH condicional, manda al email de la fila y devuelve sent', async () => {
    const f = router(); vi.stubGlobal('fetch', f)
    expect(await processOptin({ source: 'diagnostico', id: ID }, CONFIG)).toEqual({ ok: true, state: 'sent' })
    const claim = f.mock.calls.find((c: any[]) => c[1]?.method === 'PATCH')
    expect(claim[0]).toContain('/rest/v1/diagnostico_leads?id=eq.' + ID)
    expect(claim[0]).toContain('optin_email_sent_at=is.null')
    const body = JSON.parse(resendCalls(f)[0][1].body)
    expect(body).toMatchObject({ to: 'ana@example.com', reply_to: 'support@moyiq.app', from: CONFIG.fromEmail })
    expect(body.html).toContain(TOKEN)
  })

  it('si Resend falla libera el reclamo para poder reintentar', async () => {
    const f = router({ resend: [fail(422)] }); vi.stubGlobal('fetch', f)
    expect(await processOptin({ source: 'starter', id: ID }, CONFIG)).toEqual({ ok: false, error: 'resend_422' })
    const release = f.mock.calls.find((c: any[]) => c[1]?.method === 'PATCH' && c[1].headers.Prefer === 'return=minimal')
    expect(JSON.parse(release[1].body)).toEqual({ optin_email_sent_at: null })
  })

  it('reintenta una vez ante 5xx de Resend', async () => {
    const f = router({ resend: [fail(503), ok()] }); vi.stubGlobal('fetch', f)
    expect(await processOptin({ source: 'starter', id: ID }, CONFIG)).toEqual({ ok: true, state: 'sent' })
    expect(resendCalls(f)).toHaveLength(2)
  })
})
