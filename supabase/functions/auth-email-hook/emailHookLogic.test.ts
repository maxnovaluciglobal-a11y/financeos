// supabase/functions/auth-email-hook/emailHookLogic.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { detectBrand, buildActionUrl, renderEmail, sendViaResend, pickLang } from './emailHookLogic.ts'

describe('detectBrand', () => {
  it('detecta Invest por el host de redirect_to', () => {
    expect(detectBrand('https://invest.moyiq.app/app/')).toBe('invest')
  })
  it('detecta Invest por el dominio legacy financeospro', () => {
    expect(detectBrand('https://invest.financeospro.com/')).toBe('invest')
  })
  it('default a moyiq para app.moyiq.app', () => {
    expect(detectBrand('https://app.moyiq.app/app/')).toBe('moyiq')
  })
  it('default a moyiq para demo.moyiq.app', () => {
    expect(detectBrand('https://demo.moyiq.app/app/')).toBe('moyiq')
  })
  it('default a moyiq si redirect_to viene vacío/null', () => {
    expect(detectBrand(null)).toBe('moyiq')
    expect(detectBrand(undefined)).toBe('moyiq')
    expect(detectBrand('')).toBe('moyiq')
  })
  it('default a moyiq para localhost (dev)', () => {
    expect(detectBrand('http://localhost:5173/')).toBe('moyiq')
  })
})

describe('buildActionUrl', () => {
  it('arma la URL de /auth/v1/verify con los params correctos', () => {
    const url = buildActionUrl(
      { supabaseUrl: 'https://nelwgbcddwiaimzbcuas.supabase.co' },
      'abc123hash',
      'recovery',
      'https://app.moyiq.app/app/',
    )
    expect(url).toContain('https://nelwgbcddwiaimzbcuas.supabase.co/auth/v1/verify?')
    expect(url).toContain('token=abc123hash')
    expect(url).toContain('type=recovery')
    expect(url).toContain('redirect_to=https%3A%2F%2Fapp.moyiq.app%2Fapp%2F')
  })
  it('no duplica la barra si supabaseUrl trae slash final', () => {
    const url = buildActionUrl(
      { supabaseUrl: 'https://nelwgbcddwiaimzbcuas.supabase.co/' },
      'x',
      'signup',
      'https://invest.moyiq.app/',
    )
    expect(url.startsWith('https://nelwgbcddwiaimzbcuas.supabase.co/auth/v1/verify?')).toBe(true)
  })
})

describe('renderEmail', () => {
  it('MOY IQ: remitente y paleta correctos', () => {
    const r = renderEmail('moyiq', 'recovery', 'https://x.test/verify')
    expect(r.fromEmail).toBe('MOY IQ <hola@moyiq.app>')
    expect(r.html).toContain('https://x.test/verify')
    expect(r.subject).toBe('Restablece tu contraseña')
  })
  it('Invest: remitente y paleta correctos, distinto de MOY IQ', () => {
    const r = renderEmail('invest', 'recovery', 'https://x.test/verify')
    expect(r.fromEmail).toBe('MOY IQ Invest <invest@moyiq.app>')
    expect(r.html).toContain('Invest')
    expect(r.html).not.toEqual(renderEmail('moyiq', 'recovery', 'https://x.test/verify').html)
  })
  it('signup: copy distinto de recovery', () => {
    const signup = renderEmail('moyiq', 'signup', 'https://x.test/verify')
    const recovery = renderEmail('moyiq', 'recovery', 'https://x.test/verify')
    expect(signup.subject).not.toBe(recovery.subject)
  })
  it('tipo desconocido cae al copy genérico sin tirar error', () => {
    const r = renderEmail('moyiq', 'reauthentication', 'https://x.test/verify')
    expect(r.subject).toBeTruthy()
    expect(r.html).toContain('https://x.test/verify')
  })
  it('siempre incluye el link de acción en el HTML', () => {
    for (const brand of ['moyiq', 'invest'] as const) {
      for (const type of ['signup', 'recovery', 'magiclink', 'email_change', 'invite'] as const) {
        const r = renderEmail(brand, type, 'https://action.test/go')
        expect(r.html).toContain('https://action.test/go')
      }
    }
  })
})

describe('sendViaResend', () => {
  afterEach(() => vi.restoreAllMocks())

  it('éxito al primer intento', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true })
    const rendered = renderEmail('moyiq', 'recovery', 'https://x.test')
    const res = await sendViaResend('user@test.com', rendered, 'key')
    expect(res.ok).toBe(true)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('reintenta una vez si el primer intento falla, y funciona', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'boom' })
      .mockResolvedValueOnce({ ok: true })
    const rendered = renderEmail('moyiq', 'recovery', 'https://x.test')
    const res = await sendViaResend('user@test.com', rendered, 'key')
    expect(res.ok).toBe(true)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('falla tras dos intentos', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' })
    const rendered = renderEmail('moyiq', 'recovery', 'https://x.test')
    const res = await sendViaResend('user@test.com', rendered, 'key')
    expect(res.ok).toBe(false)
    expect(res.error).toBe('resend_500')
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })
})

describe('renderEmail por idioma (user_metadata.lang)', () => {
  const url = 'https://x.supabase.co/auth/v1/verify?token=t'
  it.each([
    ['es', 'Restablece tu contraseña', 'Elegir contraseña nueva'],
    ['en', 'Reset your password', 'Choose a new password'],
    ['pt', 'Redefina sua senha', 'Escolher nova senha'],
    ['de', 'Passwort zurücksetzen', 'Neues Passwort wählen'],
  ] as const)('recovery en %s', (lang, subject, cta) => {
    const r = renderEmail('moyiq', 'recovery', url, lang)
    expect(r.subject).toBe(subject)
    expect(r.html).toContain(cta)
    expect(r.html).toContain(`lang="${lang}"`)
  })

  it.each(['signup', 'magiclink', 'email_change', 'invite', 'reauthentication'] as const)('%s tiene texto propio en los 4 idiomas', (type) => {
    const subjects = (['es', 'en', 'pt', 'de'] as const).map(l => renderEmail('moyiq', type, url, l).subject)
    expect(new Set(subjects).size).toBe(4)
  })

  it('sin idioma: español, como siempre', () => {
    expect(renderEmail('moyiq', 'signup', url).subject).toBe('Confirma tu cuenta de MOY IQ')
  })

  it('pickLang con user_metadata.lang ausente, inválido o regional', () => {
    expect(pickLang(undefined)).toBe('es')
    expect(pickLang('fr')).toBe('es')
    expect(pickLang('en-US')).toBe('en')
  })

  it('la marca Invest también se traduce', () => {
    expect(renderEmail('invest', 'signup', url, 'en').subject).toBe('Confirm your MOY IQ Invest account')
  })

  it('ningún texto con exclamaciones; el alemán no tutea', () => {
    for (const lang of ['es', 'en', 'pt', 'de'] as const) {
      for (const type of ['recovery', 'signup', 'magiclink', 'email_change', 'invite'] as const) {
        const { subject, html } = renderEmail('moyiq', type, url, lang)
        expect(subject + html).not.toMatch(/[¡!]/)
        if (lang === 'de') expect(subject + html).not.toMatch(/\b(du|dein|deine|dich|dir)\b/i)
      }
    }
  })
})
