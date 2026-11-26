import { describe, it, expect, vi, afterEach } from 'vitest'
import { htmlToText, decodeEntities } from './emailText.ts'
import { emailButton, emailLayout, EMAIL_LEGAL_LINE } from './emailLayout.ts'
import { renderEmail as renderAuth, sendViaResend as sendAuth } from '../auth-email-hook/emailHookLogic.ts'
import {
  renderKeyEmail, renderTrialEndingEmail, renderPaymentFailedEmail, renderProEndedEmail, sendKeyEmail,
  type WebhookConfig,
} from '../stripe-webhook/webhookLogic.ts'
import { renderEmail as renderStarter, sendViaResend as sendStarter } from '../send-nurture-starter-email/nurtureEmailLogic.ts'
import { renderEmail as renderDiag } from '../send-nurture-diagnostico-email/nurtureEmailLogic.ts'
import { renderEmail as renderInvest, sendViaResend as sendInvest } from '../send-nurture-invest-email/nurtureEmailLogic.ts'
import { renderTrialEmail } from '../send-trial-activation-email/trialActivationLogic.ts'
import { renderReportEmail, sendReportEmail } from '../send-report-email/reportEmailLogic.ts'

afterEach(() => { vi.unstubAllGlobals() })

describe('htmlToText', () => {
  it('saca head, preheader oculto e imágenes; deja el texto de los bloques', () => {
    const html = emailLayout({ lang: 'es', preheader: 'Texto oculto', title: 'Título', bodyHtml: '<h1>Hola</h1><p>Primer párrafo.</p><p>Segundo &amp; último.</p>' })
    const t = htmlToText(html)
    expect(t).not.toContain('Texto oculto')
    expect(t).not.toContain('Título')
    expect(t).not.toMatch(/<|>/)
    expect(t).toContain('Hola\n')
    expect(t).toContain('Primer párrafo.\n')
    expect(t).toContain('Segundo & último.')
  })

  it('enlaces: "texto (URL)"; el logo sin texto desaparece; mailto con el mismo texto queda una vez', () => {
    const html = emailLayout({ lang: 'es', bodyHtml: emailButton('https://app.moyiq.app/app/?a=1&amp;b=2', 'Abrir moyiq →'), footerHtml: EMAIL_LEGAL_LINE })
    const t = htmlToText(html)
    expect(t).toContain('Abrir moyiq → (https://app.moyiq.app/app/?a=1&b=2)')
    expect(t).not.toContain('https://moyiq.app)') // enlace del logo
    expect(t).toContain('moyiq · MAXNOVA & LUCI Global LLC · support@moyiq.app')
    expect(t).not.toContain('mailto:')
  })

  it('listas, saltos y entidades numéricas', () => {
    const t = htmlToText('<ul><li>Uno</li><li>Dos</li></ul><p>a<br>b &#8212; c &#x2192; d&nbsp;e</p>')
    expect(t).toContain('- Uno\n- Dos')
    expect(t).toContain('a\nb — c → d e')
  })

  it('no deja más de una línea en blanco seguida y termina en salto de línea', () => {
    const t = htmlToText('<p>a</p><p></p><p></p><div></div><p>b</p>')
    expect(t).toBe('a\n\nb\n')
  })

  it('decodeEntities deja intacto lo que no conoce', () => {
    expect(decodeEntities('&foo; &amp; &#65;')).toBe('&foo; & A')
  })
})

const LANGS = ['es', 'en', 'pt', 'de'] as const
const WCFG = { supabaseUrl: 'https://x.supabase.co', serviceRole: 's', resendApiKey: 're', fromEmail: 'moyiq <licencias@moyiq.app>', alertEmail: 'a@x.com', portalUrl: 'https://billing.stripe.com/p/login/X' } as unknown as WebhookConfig
const NCFG = { supabaseUrl: 'https://x.supabase.co', serviceRole: 's', resendApiKey: 're', fromEmail: 'moyiq <hola@moyiq.app>', cronSecret: 'c', landingUrl: 'https://moyiq.app' }
const BILLING = { endsAt: '2026-12-02T12:00:00Z', amountCents: 499, currency: 'usd', interval: 'month' as const }

// Los 11 tipos que salían solo con HTML (auditoría de correos 18-nov-2026).
function allRendered() {
  const out: Array<{ name: string; html: string; text?: string }> = []
  for (const l of LANGS) {
    for (const act of ['signup', 'magiclink', 'recovery', 'email_change', 'invite', 'reauthentication'] as const) {
      for (const brand of ['moyiq', 'invest'] as const) out.push({ name: `auth-${brand}-${act}-${l}`, ...renderAuth(brand, act, 'https://x.supabase.co/auth/v1/verify?token=t', l) })
    }
    out.push({ name: `licencia-${l}`, ...renderKeyEmail('FNOS-AB12-CD34-EF56', 'pro', WCFG, 'year', null, l) })
    out.push({ name: `inicio-prueba-${l}`, ...renderKeyEmail('FNOS-AB12-CD34-EF56', 'pro', WCFG, 'month', BILLING, l, true) })
    out.push({ name: `fin-prueba-${l}`, ...renderTrialEndingEmail(BILLING, WCFG, l) })
    out.push({ name: `pago-fallido-${l}`, ...renderPaymentFailedEmail(WCFG, l) })
    out.push({ name: `fin-pro-${l}`, ...renderProEndedEmail(l) })
    for (const m of ['welcome', 'day2', 'day5'] as const) out.push({ name: `starter-${m}-${l}`, ...renderStarter(m, { id: 'l1', email: 'l@x.com', lang: l } as any, NCFG) })
    for (const m of ['welcome', 'day2', 'day5', 'day12'] as const) out.push({ name: `diag-${m}-${l}`, ...renderDiag(m, { id: 'l1', email: 'l@x.com', score: 42, label: 'Regular', lang: l } as any, NCFG) })
    for (const m of ['welcome', 'day2', 'day5'] as const) out.push({ name: `invest-${m}-${l}`, ...renderInvest(m, { id: 'l1', email: 'l@x.com', perfil: 'moderado', lang: l }, { ...NCFG, landingUrl: 'https://invest.moyiq.app' }) })
    for (const st of ['day1', 'day3', 'day10'] as const) out.push({ name: `trial-${st}-${l}`, ...renderTrialEmail(st, { id: '22222222-2222-4222-8222-222222222222', email: 't@x.com', lang: l, trial_started_at: '2026-11-08T00:00:00Z', trial_ends_at: '2026-11-22T00:00:00Z' } as any, { ...NCFG, portalUrl: 'https://billing.stripe.com/p/login/X' } as any) })
    out.push({ name: `reporte-${l}`, ...renderReportEmail({ to: 'c@x.com', clientName: 'Ana', month: '2026-10', pdfBase64: '', filename: 'r.pdf', lang: l, senderEmail: 'asesor@x.com' }) })
  }
  return out
}

describe('parte de texto plano en los 11 tipos de correo', () => {
  it('cada render trae texto, sin etiquetas y con el mismo contenido que el HTML', () => {
    const all = allRendered()
    expect(all.length).toBe(4 * (12 + 5 + 3 + 4 + 3 + 3 + 1))
    for (const r of all) {
      expect(r.text, r.name).toBeTruthy()
      expect(r.text, r.name).not.toMatch(/<\/?[a-z][^>]*>/i)
      expect(r.text, r.name).not.toMatch(/&(amp|lt|gt|quot|nbsp);/)
      expect(r.text, r.name).not.toMatch(/MOY\sIQ/)
      // Todo enlace del cuerpo (salvo el del logo) aparece en el texto.
      const body = r.html.split(/<td class="mq-body[^"]*" lang=/)[1] ?? r.html
      for (const href of body.matchAll(/href="(https?:[^"]+)"/g)) {
        expect(r.text, `${r.name} ${href[1]}`).toContain(href[1].replace(/&amp;/g, '&'))
      }
    }
  })

  it('los envíos mandan "text" a Resend', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', f)
    await sendAuth('a@x.com', renderAuth('moyiq', 'signup', 'https://x/verify', 'es'), 're')
    await sendKeyEmail('a@x.com', 'FNOS-AB12-CD34-EF56', 'pro', 'cs_1', WCFG)
    await sendStarter('a@x.com', renderStarter('welcome', { id: 'l1', email: 'l@x.com', lang: 'es' } as any, NCFG), NCFG)
    await sendInvest('a@x.com', renderInvest('welcome', { id: 'l1', email: 'l@x.com', perfil: 'moderado' }, NCFG), NCFG)
    await sendReportEmail({ to: 'c@x.com', clientName: 'Ana', month: '2026-10', pdfBase64: 'AA==', filename: 'r.pdf', lang: 'es' }, { resendApiKey: 're', fromEmail: 'moyiq <licencias@moyiq.app>' } as any)
    expect(f).toHaveBeenCalledTimes(5)
    for (const call of f.mock.calls) {
      const body = JSON.parse(call[1].body)
      expect(typeof body.text).toBe('string')
      expect(body.text.length).toBeGreaterThan(40)
    }
  })
})

describe('pie legal en facturación y reporte', () => {
  it('licencia, prueba, fin de prueba, pago fallido, fin de Pro y reporte nombran la LLC y soporte', () => {
    for (const l of LANGS) {
      const mails = [
        renderKeyEmail('FNOS-AB12-CD34-EF56', 'pro', WCFG, 'year', null, l),
        renderKeyEmail('FNOS-AB12-CD34-EF56', 'pro', WCFG, 'month', BILLING, l, true),
        renderTrialEndingEmail(BILLING, WCFG, l),
        renderPaymentFailedEmail(WCFG, l),
        renderProEndedEmail(l),
        renderReportEmail({ to: 'c@x.com', clientName: null as any, month: '2026-10', pdfBase64: '', filename: 'r.pdf', lang: l }),
      ]
      for (const m of mails) {
        expect(m.html).toContain('MAXNOVA &amp; LUCI Global LLC')
        expect(m.text).toContain('moyiq · MAXNOVA & LUCI Global LLC · support@moyiq.app')
      }
    }
  })
})
