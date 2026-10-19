// Enlaces de los correos hacia la app (auditoría 360, COM-2). Los botones de los
// correos de Starter y del Diagnóstico apuntaban a app.moyiq.app/import, /signup,
// /upgrade y /dashboard: un 404 de Vercel, porque la app vive bajo /app/ y no
// enruta por ruta. Este archivo fija el contrato entre las tres piezas:
// plantillas de correo -> ?open= que lee la app -> redirecciones de vercel.json
// para los correos que ya salieron.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { pageFromSearch, authTabFromSearch } from './deepLink.js'
import { APP_DESTINATIONS, APP_URL, appLink } from '../../supabase/functions/_shared/appLinks.ts'
import { STARTER_TEMPLATES } from '../../supabase/functions/send-nurture-starter-email/nurtureTemplates.ts'
import { DIAGNOSTICO_TEMPLATES } from '../../supabase/functions/send-nurture-diagnostico-email/nurtureTemplates.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const LANGS = ['es', 'en', 'pt', 'de']

describe('pageFromSearch (?open= -> página de la app)', () => {
  it.each([
    ['?open=import', 'import'],
    ['?open=dashboard', 'dashboard'],
    ['?open=upgrade', 'advisor'],
    ['?ref=starter-d5&open=upgrade', 'advisor'],
    ['?open=import&ref=starter-welcome', 'import'],
  ])('%s -> %s', (search, page) => {
    expect(pageFromSearch(search)).toBe(page)
  })

  it.each([
    [''], [undefined], [null], ['?ref=starter-d2'], ['?open='], ['?open=signup'],
    ['?open=settings'], ['?open=advisor'], ['?open=admin'], ['?open=IMPORT'], ['?open=import%20'],
  ])('%j -> null (se ignora)', (search) => {
    expect(pageFromSearch(search)).toBeNull()
  })

  it('no se deja engañar por claves del prototipo', () => {
    for (const v of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      expect(pageFromSearch(`?open=${v}`)).toBeNull()
    }
  })
})

describe('authTabFromSearch', () => {
  it('?open=signup abre la pestaña de crear cuenta', () => {
    expect(authTabFromSearch('?open=signup&ref=diagnostico')).toBe('signup')
  })
  it('cualquier otra cosa abre el login de siempre', () => {
    for (const s of ['', undefined, '?open=import', '?open=SIGNUP', '?ref=diagnostico']) {
      expect(authTabFromSearch(s)).toBe('login')
    }
  })
})

describe('contrato de los correos con la app', () => {
  it('appLink arma una URL bajo /app/ con open y ref', () => {
    const u = new URL(appLink('import', 'starter-welcome'))
    expect(u.origin).toBe('https://app.moyiq.app')
    expect(u.pathname).toBe('/app/')
    expect(u.searchParams.get('open')).toBe('import')
    expect(u.searchParams.get('ref')).toBe('starter-welcome')
    expect(APP_URL).toBe('https://app.moyiq.app/app/')
  })

  it('la app entiende cada destino que un correo puede pedir', () => {
    for (const d of APP_DESTINATIONS) {
      if (d === 'signup') expect(authTabFromSearch(`?open=${d}`)).toBe('signup')
      else expect(pageFromSearch(`?open=${d}`), d).not.toBeNull()
    }
  })

  const renderedBodies = []
  for (const lang of LANGS) {
    for (const step of Object.keys(STARTER_TEMPLATES[lang])) {
      renderedBodies.push([`starter/${lang}/${step}`, STARTER_TEMPLATES[lang][step].body])
    }
    for (const step of Object.keys(DIAGNOSTICO_TEMPLATES[lang])) {
      const ctx = { score: 42, label: 'Regular', unsubUrl: 'https://moyiq.app/unsubscribe.html?id=x', landingUrl: 'https://moyiq.app', marketingConfirmed: true }
      renderedBodies.push([`diagnostico/${lang}/${step}`, DIAGNOSTICO_TEMPLATES[lang][step](ctx).body])
    }
  }
  const appHrefs = renderedBodies.flatMap(([where, body]) =>
    [...body.matchAll(/href="([^"]+)"/g)]
      .map((m) => ({ where, url: new URL(m[1].replace(/&amp;/g, '&')) }))
      .filter(({ url }) => url.hostname === 'app.moyiq.app'))

  it('hay botones hacia la app en los 4 idiomas de las dos secuencias (el test no es vacío)', () => {
    expect(appHrefs.length).toBe(24)
    for (const lang of LANGS) {
      expect(appHrefs.filter((h) => h.where.startsWith(`starter/${lang}/`)).length).toBe(3)
      expect(appHrefs.filter((h) => h.where.startsWith(`diagnostico/${lang}/`)).length).toBe(3)
    }
  })

  it('ningún botón apunta a una ruta fuera de /app/ (eran 404 en Vercel)', () => {
    for (const { where, url } of appHrefs) {
      expect(url.pathname, where).toBe('/app/')
    }
  })

  it('cada botón pide un destino que la app entiende y trae su ref', () => {
    for (const { where, url } of appHrefs) {
      expect(APP_DESTINATIONS, where).toContain(url.searchParams.get('open'))
      expect(url.searchParams.get('ref'), where).toMatch(/^(starter|diagnostico)-?[a-z0-9-]*$/)
    }
  })

  it('el mismo botón lleva el mismo destino y ref en los 4 idiomas', () => {
    const key = (h) => `${h.where.split('/')[0]}/${h.where.split('/')[2]}`
    const targets = new Map()
    for (const h of appHrefs) {
      const k = key(h)
      const v = `${h.url.searchParams.get('open')}|${h.url.searchParams.get('ref')}`
      if (targets.has(k)) expect(v, h.where).toBe(targets.get(k))
      else targets.set(k, v)
    }
  })
})

describe('redirecciones de vercel.json para los correos que ya salieron', () => {
  const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'))
  const redirects = vercel.redirects

  it.each(APP_DESTINATIONS)('/%s redirige de forma permanente a /app/?open=<destino>', (d) => {
    const r = redirects.find((x) => x.source === `/${d}`)
    expect(r, `falta la redirección de /${d}`).toBeTruthy()
    expect(r.destination).toBe(`/app/?open=${d}`)
    expect(r.permanent).toBe(true)
    expect(r.has).toBeUndefined()
  })

  it('las redirecciones de dominio (financeospro.com) siguen antes que las de ruta', () => {
    const idx = (pred) => redirects.findIndex(pred)
    const lastHost = Math.max(...redirects.map((r, i) => (r.has ? i : -1)))
    const firstPath = idx((r) => APP_DESTINATIONS.some((d) => r.source === `/${d}`))
    expect(lastHost).toBeGreaterThanOrEqual(0)
    expect(firstPath).toBeGreaterThan(lastHost)
  })

  it('el rewrite de /app/ sigue sirviendo el destino de las redirecciones', () => {
    const rewrite = vercel.rewrites.find((r) => r.destination === '/app/index.html')
    expect(rewrite).toBeTruthy()
    expect(new RegExp(`^${rewrite.source}$`).test('/app/')).toBe(true)
  })
})
