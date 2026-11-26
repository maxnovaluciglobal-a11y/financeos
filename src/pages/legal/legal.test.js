// Textos legales dentro de la app (Privacy/Terms/License/Disclaimer × es/en/pt/de).
// Renderiza el contenido de cada idioma con renderToStaticMarkup (sin DOM ni useT) y
// verifica hechos que ya se desalinearon antes: "sin cuentas" cuando la cuenta es
// obligatoria, proveedores, garantía de 14 días, fecha visible, voz (sin voseo, sin
// exclamaciones, "Sie" en alemán) y que no haya links a moyiq.app/de/ sin publicar.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PRIVACY_CONTENT } from './privacyContent.jsx'
import { TERMS_CONTENT } from './termsContent.jsx'
import { LICENSE_CONTENT, PLANS as LICENSE_PLANS } from './licenseContent.jsx'
import { DISCLAIMER_CONTENT } from './disclaimerContent.jsx'
import { sanitizeLogMessage } from '../../core/feedback.js'
import { COMPANY, LAST_UPDATED, LEGAL_EFFECTIVE_DATE, LEGAL_LANGS, LICENSE_LAST_UPDATED, PRIVACY_LAST_UPDATED, TERMS_LAST_UPDATED, pickLang, REBRAND_NOTICE, STRIPE_PORTAL_URL, SUPPORT_EMAIL } from './legalMeta.js'
import { DE_LEGAL_PUBLISHED, DE_LEGAL_URLS, deLegalRef } from './deLegal.js'

const here = dirname(fileURLToPath(import.meta.url))

const PAGES = {
  privacy: { content: PRIVACY_CONTENT, file: 'privacyContent.jsx' },
  terms: { content: TERMS_CONTENT, file: 'termsContent.jsx' },
  license: { content: LICENSE_CONTENT, file: 'licenseContent.jsx' },
  disclaimer: { content: DISCLAIMER_CONTENT, file: 'disclaimerContent.jsx' },
}

function render(page, lang) {
  const { title, sub, Body } = PAGES[page].content[lang]
  const html = renderToStaticMarkup(
    createElement('div', null, createElement('h1', null, title), createElement('p', null, sub), createElement(Body)),
  )
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
  return { html, text }
}

const VOSEO = /\b(tenés|podés|querés|sabés|usá|escribí|hacé|mirá|elegí|necesitás|leé|entrá|cancelá|activá)\b/i
const NO_ACCOUNTS = /no user accounts|there are no (user )?accounts|no hay cuentas|sin cuentas|não há contas|sem contas|keine (Benutzer)?konten/i
const ACCOUNT_REQUIRED = {
  es: /cuenta gratuita/,
  en: /free account/,
  pt: /conta gratuita/,
  de: /kostenlose[sn]? (Benutzer)?[Kk]onto/,
}

describe('legal pages × languages', () => {
  for (const page of Object.keys(PAGES)) {
    for (const lang of LEGAL_LANGS) {
      describe(`${page} / ${lang}`, () => {
        const { html, text } = render(page, lang)

        it('renders non-empty content with the last-updated date', () => {
          expect(text.length).toBeGreaterThan(800)
          expect(text).toContain((page === 'privacy' ? PRIVACY_LAST_UPDATED : page === 'terms' ? TERMS_LAST_UPDATED : page === 'license' ? LICENSE_LAST_UPDATED : LAST_UPDATED)[lang])
        })

        it('has no exclamation marks and no emoji', () => {
          expect(text).not.toMatch(/[!¡]/)
          expect(text).not.toMatch(/\p{Extended_Pictographic}/u)
        })

        it('names the operator and the support email', () => {
          expect(text).toContain('MAXNOVA & LUCI Global LLC')
          expect(text).toContain(SUPPORT_EMAIL)
        })

        it('never claims there are no accounts; the trial is the no-card 14-day one, only in terms and license', () => {
          expect(text).not.toMatch(NO_ACCOUNTS)
          const TRIAL = /\btrial\b|prueba gratis|prueba gratuita|prueba de Pro|teste gratuito|teste do Pro|período de teste|periodo de teste|Testphase|kostenlos testen|Probezeit/i
          // Modelo A (26-nov-2026): sin tarjeta y sin cobro; ya no es "si se ofrece".
          const NO_CARD = { es: /sin tarjeta|No se pide tarjeta/, en: /no card|No card/, pt: /sem cartão|Não é pedido cartão/, de: /ohne Karte|keine Karte/ }
          expect(text).not.toMatch(/si se ofrece|if offered|se oferecido|falls angeboten/)
          if (page === 'privacy') {
            // D1/D2: el HMAC del correo de la prueba y el borrado de la copia a los 90 días.
            expect(text).toMatch(/HMAC/)
            expect(text).toMatch(/90/)
          } else if (page === 'terms' || page === 'license') {
            expect(text).toMatch(TRIAL)
            expect(text).toMatch(NO_CARD[lang])
            expect(text).not.toMatch(/se convierte automáticamente|converts automatically|se converte automaticamente|wird das Abo ab dem 15/)
          } else {
            expect(text).not.toMatch(TRIAL)
          }
        })

        if (page === 'license') {
          it('lists sync and browser notifications under Pro, not Starter, and no generic multi-currency claim', () => {
            const plans = LICENSE_PLANS[lang]
            const starter = plans[0].allowed.join(' ')
            const pro = plans[1].allowed.join(' ')
            expect(starter).not.toMatch(/sincroniz|sync|Synchronis/i)
            expect(pro).toMatch(/sincroniz|sync|Synchronis/i)
            expect(pro).toMatch(/navegador|browser|Browser/)
            expect(pro).not.toMatch(/^Multi-?moeda$|^Multi-?moneda$|^Multi-currency$|^Multiwährung$/m)
            for (const item of plans[1].allowed) expect(item).not.toMatch(/^(Multi-moneda|Multi-currency|Multimoeda|Multiwährung)$/)
          })
        }

        it('uses moyiq as product name (MOY IQ and FinanceOS only as former names)', () => {
          expect(text).toContain('moyiq')
          expect(text).toContain(REBRAND_NOTICE[lang])
          const stripped = text
            .replace(REBRAND_NOTICE[lang], '')
            .replace(/[^.]*(FinanceOS|MOY IQ)[^.]*\./g, (sentence) =>
              /antes|previously|chamava|früher/i.test(sentence) ? '' : sentence,
            )
          expect(stripped).not.toMatch(/FinanceOS|MOY IQ/)
        })

        if (lang === 'es') {
          it('Spanish has no voseo', () => {
            expect(text).not.toMatch(VOSEO)
          })
        }

        if (lang === 'de') {
          it('German uses formal Sie, never du/dein', () => {
            expect(text).toMatch(/\bSie\b/)
            expect(text).not.toMatch(/\bdu\b|\bdein/i)
          })

          it('German has no links to moyiq.app/de/ while unpublished', () => {
            if (!DE_LEGAL_PUBLISHED) {
              expect(html).not.toMatch(/<a[^>]+href="[^"]*moyiq\.app\/de\//)
            }
          })
        }
      })
    }
  }
})

describe('privacy facts', () => {
  for (const lang of LEGAL_LANGS) {
    it(`${lang}: account required, processors and encryption named`, () => {
      const { text } = render('privacy', lang)
      expect(text).toMatch(ACCOUNT_REQUIRED[lang])
      for (const word of ['Supabase', 'Stripe', 'Resend', 'Vercel', 'Cloudflare', 'Turnstile', 'mindicador.cl', 'dolarapi.com', 'AES-GCM', 'IndexedDB', 'Google']) {
        expect(text).toContain(word)
      }
      // Formspree no se usa en el código (auditoría 360, LEG-N1): no se declara.
      expect(text).not.toContain('Formspree')
    })
  }
})

// Auditoría 360 del 19-nov-2026 (LEG-N1, LEG-N2, LEG-N8, SEC-N7): la política de la
// app repite lo que la de la landing ya publica y lo que el código hace.
const INVEST_PROFILE = { es: /Perfil de inversionista/, en: /Investor profile/, pt: /Perfil de investidor/, de: /Anlegerprofil/ }
const CHILE = { es: /Si vives en Chile/, en: /If you live in Chile/, pt: /Se você mora no Chile/, de: /Wenn Sie in Chile leben/ }
const BRAZIL = { es: /Si vives en Brasil/, en: /If you live in Brazil/, pt: /Se você mora no Brasil/, de: /Wenn Sie in Brasilien leben/ }
const NO_CLICK_CLAIM = /no se registran eventos ni clics|no events or clicks are recorded|não são registrados eventos nem cliques|Ereignisse oder Klicks werden nicht aufgezeichnet/
const STRIPE_MANUAL_ONLY = /Dos pasos no son automáticos|Two steps are not automatic|Dois passos não são automáticos|Zwei Schritte erfolgen nicht automatisch/

describe('privacy: alineada con la landing y el código (auditoría 360, 19-nov-2026)', () => {
  for (const lang of LEGAL_LANGS) {
    it(`${lang}: Chile (Ley 21.719) y Brasil (LGPD) con sus autoridades`, () => {
      const { text } = render('privacy', lang)
      expect(text).toMatch(CHILE[lang])
      expect(text).toContain('21.719')
      expect(text).toContain('18.623-07')
      expect(text).toContain('Agencia de Protección de Datos Personales')
      expect(text).toMatch(BRAZIL[lang])
      expect(text).toContain('ANPD')
    })

    it(`${lang}: perfil de inversionista declarado, sin uso para recomendar, borrado con la cuenta`, () => {
      const { text } = render('privacy', lang)
      expect(text).toMatch(INVEST_PROFILE[lang])
      expect(text).toContain('invest.moyiq.app')
      expect(text).toMatch(/recomendar|recommend|Anlageempfehlungen/)
    })

    it(`${lang}: comentarios/NPS y clics de Resend declarados; sin la frase de "no se registran clics"`, () => {
      const { text } = render('privacy', lang)
      expect(text).toContain('NPS')
      expect(text).not.toMatch(NO_CLICK_CLAIM)
      expect(text).toMatch(/medición de clics|click measurement|medição de cliques|Klickmessung/)
    })

    it(`${lang}: la cancelación en Stripe al borrar la cuenta es automática, con respaldo manual`, () => {
      const { text } = render('privacy', lang)
      expect(text).not.toMatch(STRIPE_MANUAL_ONLY)
    })
  }

  it('los 4 idiomas nombran las autoridades de México, Argentina, Perú y Colombia (LEG-N8)', () => {
    for (const lang of LEGAL_LANGS) {
      const { text } = render('privacy', lang)
      for (const word of ['Secretaría Anticorrupción y Buen Gobierno', 'AAIP', 'Protección de Datos Personales', 'SIC']) {
        expect(text, `${lang}: ${word}`).toContain(word)
      }
    }
  })

  it('el registro técnico dice lo que hace sanitizeLogMessage: tapa los números de 3 o más cifras', () => {
    expect(sanitizeLogMessage('error 12 en 1234')).toBe('error 12 en #')
    const said = { es: 'números de tres o más cifras', en: 'numbers of three or more digits', pt: 'números de três ou mais algarismos', de: 'Zahlen ab drei Ziffern' }
    for (const lang of LEGAL_LANGS) expect(render('privacy', lang).text, lang).toContain(said[lang])
  })

  it('Turnstile: la lista de usos incluye recuperar el acceso y la encuesta y no se presenta como cerrada', () => {
    const said = {
      es: ['entre otros', 'al recuperar el acceso', 'la encuesta'],
      en: ['among others', 'recover access', 'the survey'],
      pt: ['entre outros', 'ao recuperar o acesso', 'a pesquisa'],
      de: ['unter anderem', 'Wiederherstellung des Zugangs', 'der Umfrage'],
    }
    for (const lang of LEGAL_LANGS) {
      const { text } = render('privacy', lang)
      const i = text.indexOf('Turnstile')
      const near = text.slice(i, i + 600)
      for (const w of said[lang]) expect(near, `${lang}: ${w}`).toContain(w)
    }
  })

  it('cada origen externo de la CSP de vercel.json está declarado en la política (4 idiomas)', () => {
    const vercel = JSON.parse(readFileSync(join(here, '../../../vercel.json'), 'utf8'))
    const csp = vercel.headers.flatMap(h => h.headers).find(h => h.key === 'Content-Security-Policy').value
    const hosts = [...new Set((csp.match(/(?:https|wss):\/\/[^\s;]+/g) || []).map(u => new URL(u.replace(/^wss:/, 'https:')).hostname))]
    // Origen → palabra que la política tiene que decir. Origen nuevo sin entrada = falla:
    // antes de sumarlo a la CSP hay que declararlo en privacyContent.jsx y en la landing.
    const DECLARED_AS = [
      [/\.supabase\.co$/, 'Supabase'],
      [/^(ve\.)?dolarapi\.com$/, 'dolarapi.com'],
      [/^mindicador\.cl$/, 'mindicador.cl'],
      [/^challenges\.cloudflare\.com$/, 'Turnstile'],
      [/^invest\.moyiq\.app$/, 'invest.moyiq.app'],
    ]
    expect(hosts.length).toBeGreaterThan(3)
    for (const host of hosts) {
      const entry = DECLARED_AS.find(([re]) => re.test(host))
      expect(entry, `origen de la CSP sin declarar: ${host}`).toBeTruthy()
      for (const lang of LEGAL_LANGS) expect(render('privacy', lang).text, `${lang}: ${host}`).toContain(entry[1])
    }
  })
})

describe('privacy: double opt-in for marketing emails', () => {
  for (const lang of LEGAL_LANGS) {
    it(`${lang}: describes the double opt-in`, () => {
      expect(render('privacy', lang).text).toMatch(/double opt-in|doble opt-in|Double-Opt-in/i)
    })
  }
})

describe('terms facts', () => {
  for (const lang of LEGAL_LANGS) {
    it(`${lang}: 14-day technical guarantee, 30 clients, support email`, () => {
      const { text } = render('terms', lang)
      expect(text).toMatch(/\b14\b/)
      expect(text).toMatch(/\b30\b/)
      expect(text).toContain(SUPPORT_EMAIL)
      expect(text).toMatch(ACCOUNT_REQUIRED[lang])
      expect(text).not.toMatch(/no questions asked|sin preguntas|sem perguntas|ohne Angabe von Gründen erstatten/i)
    })
  }
})

describe('review completed: no draft markers left', () => {
  for (const { file } of Object.values(PAGES)) {
    it(`${file} has no pending-review markers or draft notices`, () => {
      const src = readFileSync(join(here, file), 'utf8')
      expect(src).not.toMatch(/PRÜFUNG AUSSTEHEND|REVISIÓN LEGAL PENDIENTE|LEGAL REVIEW PENDING|punto de partida informativo|informational starting point|ponto de partida informativo|Entwurf und wird derzeit/)
    })
  }
})

// Página de cancelación que nombra el texto de Términos de cada idioma (el
// portugués cita la española). Antes venía de un CANCEL_URLS de legalMeta.js
// que la app no usaba (C15).
const TERMS_CANCEL_PAGE = { es: 'moyiq.app/cancelar.html', en: 'moyiq.app/en/cancel.html', pt: 'moyiq.app/cancelar.html' }

describe('company identification and renewal facts', () => {
  for (const lang of LEGAL_LANGS) {
    for (const page of ['terms', 'privacy']) {
      it(`${page}/${lang}: names the Florida LLC, its Document Number and address`, () => {
        const { text } = render(page, lang)
        expect(text).toContain(COMPANY.documentNumber)
        expect(text).toContain(COMPANY.address)
        expect(text).toContain('Florida')
      })
    }
    it(`terms/${lang}: automatic renewal and online cancellation`, () => {
      const { text } = render('terms', lang)
      expect(text).toMatch(/automáticamente|automatically|automaticamente|verlängert sich/)
      if (lang === 'de') expect(text).toMatch(/Verträge hier kündigen/)
      else expect(text).toContain(TERMS_CANCEL_PAGE[lang])
    })
  }
})

describe('deLegalRef', () => {
  it('renders plain text (no link) when unpublished', () => {
    const out = deLegalRef('impressum', 'Impressum', false)
    expect(typeof out).toBe('string')
    expect(out).toContain('moyiq.app/de/impressum.html')
    expect(out).not.toContain('https://')
  })

  it('renders a link when published', () => {
    const html = renderToStaticMarkup(deLegalRef('agb', 'AGB', true))
    expect(html).toContain(`href="${DE_LEGAL_URLS.agb}"`)
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('covers the four German legal texts', () => {
    for (const key of ['impressum', 'agb', 'widerruf', 'datenschutz']) {
      expect(DE_LEGAL_URLS[key]).toMatch(/^https:\/\/moyiq\.app\/de\/.+\.html$/)
    }
  })
})

describe('pickLang', () => {
  it('routes de to German and unknown languages to Spanish', () => {
    expect(pickLang(PRIVACY_CONTENT, 'de')).toBe(PRIVACY_CONTENT.de)
    expect(pickLang(PRIVACY_CONTENT, 'fr')).toBe(PRIVACY_CONTENT.es)
  })
})

describe('LEG-12: portal de Stripe en el Menú', () => {
  it('el portal es el link público de inicio de sesión de Stripe (el mismo de la landing)', () => {
    expect(STRIPE_PORTAL_URL).toMatch(/^https:\/\/billing\.stripe\.com\/p\/login\/[A-Za-z0-9]+$/)
  })

  it('el Menú lo ofrece solo con Pro, en una pestaña nueva y con su explicación', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(new URL('../More/index.jsx', import.meta.url), 'utf8')
    expect(src).toMatch(/isPro && !noCardTrial && STRIPE_PORTAL_URL/)
    expect(src).toMatch(/target="_blank" rel="noopener noreferrer"/)
    expect(src).toContain("t('menu.manageSubHint')")
  })
})

describe('legal version (rebranding moyiq)', () => {
  it('has an ISO effective date and shows it in the 4 languages', () => {
    expect(LEGAL_EFFECTIVE_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(LAST_UPDATED.es).toMatch(/^Vigente desde el \d{1,2} de \p{L}+ de \d{4}$/u)
    expect(LAST_UPDATED.en).toMatch(/^Effective \p{L}+ \d{1,2}, \d{4}$/u)
    expect(LAST_UPDATED.pt).toMatch(/^Em vigor desde \d{1,2} de \p{L}+ de \d{4}$/u)
    expect(LAST_UPDATED.de).toMatch(/^Gültig ab \d{1,2}\. \p{L}+ \d{4}$/u)
  })
})

describe('legalMeta sin duplicar cancelUrl (C15)', () => {
  it('no exporta CANCEL_URLS: la fuente única es utils/cancelUrl.js', async () => {
    const meta = await import('./legalMeta.js')
    expect('CANCEL_URLS' in meta).toBe(false)
  })
})
