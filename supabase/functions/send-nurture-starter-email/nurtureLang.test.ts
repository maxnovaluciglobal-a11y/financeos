import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  renderEmail,
  pickLang,
  fetchLeadById,
  fetchEligibleForEmail2,
  NURTURE_MODES,
  type NurtureEmailConfig,
} from './nurtureEmailLogic.ts'
import { STARTER_TEMPLATES, UNSUBSCRIBE_LABEL } from './nurtureTemplates.ts'

const CONFIG: NurtureEmailConfig = {
  supabaseUrl: 'https://proj.supabase.co',
  serviceRole: 'srv-key',
  resendApiKey: 're_key',
  fromEmail: 'MOY IQ <hola@moyiq.app>',
  cronSecret: 'sekret',
  landingUrl: 'https://moyiq.app',
}
const LANGS = ['es', 'en', 'pt', 'de'] as const
const VOSEO = /\b(tenés|podés|querés|sabés|usá|escribí|hacé|mirá|elegí|registrate|probá)\b/i
const lead = (lang: unknown) => ({ id: 'lead-1', email: 'a@b.com', lang: lang as string | null })
const text = (r: { subject: string; html: string }) => `${r.subject}\n${r.html}`

afterEach(() => { vi.unstubAllGlobals() })

describe('pickLang', () => {
  it('usa el idioma del lead si es uno de los 4', () => {
    expect(pickLang('en')).toBe('en')
    expect(pickLang('pt-BR')).toBe('pt')
    expect(pickLang('DE')).toBe('de')
  })
  it('cae a es para null, undefined, desconocido o basura', () => {
    for (const v of [null, undefined, '', 'fr', 42]) expect(pickLang(v)).toBe('es')
  })
})

describe('renderEmail por idioma', () => {
  it('elige la plantilla del idioma del lead', () => {
    for (const l of LANGS) {
      for (const m of NURTURE_MODES) {
        expect(renderEmail(m, lead(l), CONFIG).subject).toBe(STARTER_TEMPLATES[l][m].subject)
      }
    }
  })

  it('null, sin campo lang y "fr" caen a español (idéntico a es)', () => {
    for (const m of NURTURE_MODES) {
      const es = renderEmail(m, lead('es'), CONFIG)
      expect(renderEmail(m, lead(null), CONFIG)).toEqual(es)
      expect(renderEmail(m, lead('fr'), CONFIG)).toEqual(es)
      expect(renderEmail(m, { id: 'lead-1', email: 'a@b.com' }, CONFIG)).toEqual(es)
    }
  })

  it('cada paso existe en los 4 idiomas con asunto y html no vacíos, y link de baja', () => {
    for (const l of LANGS) {
      for (const m of NURTURE_MODES) {
        const r = renderEmail(m, lead(l), CONFIG)
        expect(r.subject.trim().length).toBeGreaterThan(0)
        expect(r.html.trim().length).toBeGreaterThan(0)
        expect(r.html).toContain('https://moyiq.app/unsubscribe.html?id=lead-1&t=starter')
        expect(r.html).toContain(UNSUBSCRIBE_LABEL[l])
      }
    }
  })

  it('mismos links y ref= en los 4 idiomas', () => {
    const refs = { welcome: 'ref=starter-welcome', day2: 'ref=starter-d2', day5: 'ref=starter-d5' }
    for (const l of LANGS) for (const m of NURTURE_MODES) {
      expect(renderEmail(m, lead(l), CONFIG).html).toContain(refs[m])
    }
  })

  it('sin "!" ni "¡" en ningún idioma', () => {
    for (const l of LANGS) for (const m of NURTURE_MODES) {
      expect(text(renderEmail(m, lead(l), CONFIG))).not.toMatch(/[!¡]/)
    }
  })

  it('español sin voseo', () => {
    for (const m of NURTURE_MODES) expect(text(renderEmail(m, lead('es'), CONFIG))).not.toMatch(VOSEO)
  })

  it('alemán usa "Sie" y nunca du/dein', () => {
    for (const m of NURTURE_MODES) {
      const t = text(renderEmail(m, lead('de'), CONFIG))
      expect(t).toMatch(/\bSie\b|\bIhr/)
      expect(t).not.toMatch(/\bdu\b|\bdein/i)
    }
  })

  it('portugués usa "você"', () => {
    expect(renderEmail('welcome', lead('pt'), CONFIG).html).toContain('você')
  })
})

describe('lecturas compatibles antes y después de la migración de lang', () => {
  it('fetchLeadById y el cron piden select=* (nunca una columna lang explícita)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    vi.stubGlobal('fetch', fetchMock)
    await fetchLeadById('lead-1', CONFIG)
    await fetchEligibleForEmail2(CONFIG)
    for (const [url] of fetchMock.mock.calls) {
      expect(url).toContain('select=*')
      expect(url).not.toContain('lang')
    }
  })
})
