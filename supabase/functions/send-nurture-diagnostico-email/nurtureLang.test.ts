import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  renderEmail,
  pickLang,
  fetchLeadById,
  fetchEligibleForEmail2,
  fetchEligibleForEmail3,
  fetchEligibleForEmail4,
  NURTURE_MODES,
  type DiagnosticoLead,
  type NurtureEmailConfig,
} from './nurtureEmailLogic.ts'
import { UNSUBSCRIBE_LABEL, actionBlock } from './nurtureTemplates.ts'

const CONFIG: NurtureEmailConfig = {
  supabaseUrl: 'https://proj.supabase.co',
  serviceRole: 'srv-key',
  resendApiKey: 're_key',
  fromEmail: 'MOY IQ <hola@moyiq.app>',
  cronSecret: 'sekret',
  landingUrl: 'https://moyiq.app/',
}
const LANGS = ['es', 'en', 'pt', 'de'] as const
const LABELS = ['Crítico', 'Regular', 'Bueno', 'Excelente', null]
const VOSEO = /\b(tenés|podés|querés|sabés|usá|escribí|hacé|mirá|elegí|registrate|probá)\b/i
const lead = (lang: unknown, label: string | null = 'Regular', score: number | null = 42): DiagnosticoLead =>
  ({ id: 'lead-1', email: 'a@b.com', score, label, lang: lang as string | null })
const text = (r: { subject: string; html: string }) => `${r.subject}\n${r.html}`

afterEach(() => { vi.unstubAllGlobals() })

describe('pickLang', () => {
  it('usa el idioma del lead si es uno de los 4, si no es', () => {
    expect(pickLang('en')).toBe('en')
    expect(pickLang('pt_BR')).toBe('pt')
    for (const v of [null, undefined, 'fr', 'auto']) expect(pickLang(v)).toBe('es')
  })
})

describe('renderEmail por idioma', () => {
  it('asuntos distintos por idioma (se elige la plantilla del lead)', () => {
    for (const m of NURTURE_MODES) {
      const subjects = new Set(LANGS.map((l) => renderEmail(m, lead(l), CONFIG).subject))
      expect(subjects.size).toBe(4)
    }
  })

  it('null, sin campo lang y "fr" caen a español (idéntico a es)', () => {
    for (const m of NURTURE_MODES) {
      const es = renderEmail(m, lead('es'), CONFIG)
      expect(renderEmail(m, lead(null), CONFIG)).toEqual(es)
      expect(renderEmail(m, lead('fr'), CONFIG)).toEqual(es)
      expect(renderEmail(m, { id: 'lead-1', email: 'a@b.com', score: 42, label: 'Regular' }, CONFIG)).toEqual(es)
    }
  })

  it('cada paso existe en los 4 idiomas con asunto y html no vacíos, y link de baja', () => {
    for (const l of LANGS) for (const m of NURTURE_MODES) for (const label of LABELS) {
      const r = renderEmail(m, lead(l, label), CONFIG)
      expect(r.subject.trim().length).toBeGreaterThan(0)
      expect(r.html.trim().length).toBeGreaterThan(0)
      expect(r.html).toContain('https://moyiq.app/unsubscribe.html?id=lead-1')
      expect(r.html).toContain(UNSUBSCRIBE_LABEL[l])
    }
  })

  it('cada label tiene su bloque de acción propio en los 4 idiomas', () => {
    for (const l of LANGS) {
      const blocks = new Set(LABELS.map((label) => actionBlock(l, label)))
      expect(blocks.size).toBe(5)
    }
  })

  it('welcome muestra score y label traducido (label llega siempre en español)', () => {
    const en = renderEmail('welcome', lead('en', 'Regular', 42), CONFIG).html
    expect(en).toContain('42/100 (Fair)')
    expect(renderEmail('welcome', lead('de', 'Crítico', 10), CONFIG).html).toContain('10/100 (Kritisch)')
    expect(renderEmail('welcome', lead('pt', 'Bueno', 70), CONFIG).html).toContain('70/100 (Bom)')
    expect(renderEmail('welcome', lead('en', null, null), CONFIG).html).toContain('your result')
  })

  it('email 4: en apunta a /en/score-check.html; pt/de/es a diagnostico.html', () => {
    expect(renderEmail('day12', lead('en'), CONFIG).html).toContain('https://moyiq.app/en/score-check.html?ref=diagnostico-d12')
    for (const l of ['es', 'pt', 'de']) {
      expect(renderEmail('day12', lead(l), CONFIG).html).toContain('https://moyiq.app/diagnostico.html?ref=diagnostico-d12')
    }
  })

  it('mismos ref= de signup/upgrade en los 4 idiomas', () => {
    const refs = { welcome: 'ref=diagnostico"', day2: 'ref=diagnostico-d2', day5: 'ref=diagnostico-d5', day12: 'ref=diagnostico-d12' }
    for (const l of LANGS) for (const m of NURTURE_MODES) {
      expect(renderEmail(m, lead(l), CONFIG).html).toContain(refs[m])
    }
  })

  it('sin "!" ni "¡" en ningún idioma', () => {
    for (const l of LANGS) for (const m of NURTURE_MODES) for (const label of LABELS) {
      expect(text(renderEmail(m, lead(l, label), CONFIG))).not.toMatch(/[!¡]/)
    }
  })

  it('español sin voseo', () => {
    for (const m of NURTURE_MODES) for (const label of LABELS) {
      expect(text(renderEmail(m, lead('es', label), CONFIG))).not.toMatch(VOSEO)
    }
  })

  it('alemán usa "Sie" y nunca du/dein', () => {
    for (const m of NURTURE_MODES) for (const label of LABELS) {
      const t = text(renderEmail(m, lead('de', label), CONFIG))
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
    await fetchEligibleForEmail3(CONFIG)
    await fetchEligibleForEmail4(CONFIG)
    for (const [url] of fetchMock.mock.calls) {
      expect(url).toContain('select=*')
      expect(url).not.toContain('lang')
    }
  })
})
