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
import { LICENSE_CONTENT } from './licenseContent.jsx'
import { DISCLAIMER_CONTENT } from './disclaimerContent.jsx'
import { CANCEL_URLS, COMPANY, LAST_UPDATED, LEGAL_LANGS, pickLang, SUPPORT_EMAIL } from './legalMeta.js'
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
          expect(text).toContain(LAST_UPDATED[lang])
        })

        it('has no exclamation marks and no emoji', () => {
          expect(text).not.toMatch(/[!¡]/)
          expect(text).not.toMatch(/\p{Extended_Pictographic}/u)
        })

        it('names the operator and the support email', () => {
          expect(text).toContain('MAXNOVA & LUCI Global LLC')
          expect(text).toContain(SUPPORT_EMAIL)
        })

        it('never claims there are no accounts; a trial appears only as a conditional clause in the terms', () => {
          expect(text).not.toMatch(NO_ACCOUNTS)
          const TRIAL = /\btrial\b|prueba gratis|prueba gratuita|teste gratuito|período de teste|periodo de teste|Testphase|kostenlos testen|Probezeit/i
          if (page === 'terms') {
            expect(text).toMatch(/si se ofrece|if offered|se oferecido|falls angeboten/)
          } else {
            expect(text).not.toMatch(TRIAL)
          }
        })

        it('uses MOY IQ as product name (FinanceOS only as former name)', () => {
          expect(text).toContain('MOY IQ')
          const stripped = text.replace(/[^.]*FinanceOS[^.]*\./g, (sentence) =>
            /antes|previously|chamava|früher/i.test(sentence) ? '' : sentence,
          )
          expect(stripped).not.toMatch(/FinanceOS/)
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
      for (const word of ['Supabase', 'Stripe', 'Resend', 'Vercel', 'Formspree', 'AES-GCM', 'IndexedDB', 'Google']) {
        expect(text).toContain(word)
      }
    })
  }
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
      else expect(text).toContain(CANCEL_URLS[lang].replace(/^https:\/\//, ''))
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
