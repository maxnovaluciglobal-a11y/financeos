// Cabeceras de seguridad de la app (auditoría 360, C-18 / SEG-3).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const all = vercel.headers.find(h => h.source === '/(.*)' && !h.has)
const get = (k) => all.headers.find(h => h.key === k)?.value
const csp = get('Content-Security-Policy') || ''
const dir = (name) => (csp.split(';').map(s => s.trim()).find(s => s.startsWith(name + ' ')) || '').split(/\s+/).slice(1)

describe('cabeceras de seguridad (vercel.json)', () => {
  it('aplica a todas las rutas, con anti-clickjacking, nosniff y referrer', () => {
    expect(dir('frame-ancestors')).toEqual(["'none'"])
    expect(get('X-Frame-Options')).toBe('DENY')
    expect(get('X-Content-Type-Options')).toBe('nosniff')
    expect(get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(dir('object-src')).toEqual(["'none'"])
  })

  // Dictado del alta rápida (19-nov-2026): el micrófono solo para el propio
  // origen; cámara, ubicación, pagos y USB siguen cerrados.
  it('Permissions-Policy: micrófono solo para el propio origen, el resto cerrado', () => {
    const pp = get('Permissions-Policy')
    expect(pp).toContain('microphone=(self)')
    for (const f of ['camera=()', 'geolocation=()', 'payment=()', 'usb=()']) expect(pp).toContain(f)
  })

  it('sin unsafe-inline ni unsafe-eval en scripts', () => {
    expect(dir('script-src')).not.toContain("'unsafe-inline'")
    expect(dir('script-src')).not.toContain("'unsafe-eval'")
  })

  it('el único manejador inline del index.html (fuentes) está permitido por hash', () => {
    const handlers = [...html.matchAll(/\son\w+="([^"]+)"/g)].map(m => m[1])
    expect(handlers).toEqual(["this.media='all'"])
    const hash = `'sha256-${createHash('sha256').update(handlers[0]).digest('base64')}'`
    expect(dir('script-src')).toContain(hash)
    expect([...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/g)]).toHaveLength(0)
  })

  it('connect-src incluye Supabase y las fuentes de tasas que usa la app', () => {
    const c = dir('connect-src')
    for (const h of ['https://nelwgbcddwiaimzbcuas.supabase.co', 'https://dolarapi.com', 'https://ve.dolarapi.com', 'https://mindicador.cl', 'https://invest.moyiq.app']) expect(c).toContain(h)
    const src = ['utils/tasaVE.js', 'utils/tasaAR.js', 'utils/indicadores.js'].map(f => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')).join('\n')
    for (const host of new Set([...src.matchAll(/https:\/\/([a-z0-9.-]+)/g)].map(m => m[1]))) expect(c, host).toContain('https://' + host)
  })
})

// Miniaturas de noticias (25-nov-2026): se sirven por el proxy propio
// invest.moyiq.app/api/img; img-src abre solo ese origen (ya declarado en la
// política) y nunca los CDN de terceros ni https: genérico.
describe('img-src: miniaturas de noticias por el proxy de Invest', () => {
  it("es 'self', data:, blob: y https://invest.moyiq.app, nada más", async () => {
    expect(dir('img-src')).toEqual(["'self'", 'data:', 'blob:', 'https://invest.moyiq.app'])
    const { NEWS_IMG_HOSTS, newsImageSrc } = await import('../src/utils/investMarket.js')
    for (const h of NEWS_IMG_HOSTS) expect(csp).not.toContain(h)
    expect(new URL(newsImageSrc(`https://${NEWS_IMG_HOSTS[0]}/a.jpg`)).origin).toBe('https://invest.moyiq.app')
  })
})

// SEG-1 / SEG-7: Cloudflare Turnstile carga api.js y su iframe desde challenges.cloudflare.com.
describe('Turnstile en la CSP', () => {
  it('script-src y frame-src permiten challenges.cloudflare.com, y nada más se abre', () => {
    expect(dir('script-src')).toContain('https://challenges.cloudflare.com')
    expect(dir('frame-src')).toEqual(['https://challenges.cloudflare.com'])
    expect(dir('connect-src')).not.toContain('https://challenges.cloudflare.com')
  })
})

// S4 (revisión pre-tiendas, 23-nov-2026): la app de tienda empaqueta index.html
// sin las cabeceras de Vercel, así que el HTML lleva la misma CSP en un <meta>.
describe('CSP en el <meta> del index.html (app de tienda)', () => {
  const metaCsp = (/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html) || [])[1] || ''
  const mdir = (name) => (metaCsp.split(';').map(s => s.trim()).find(s => s.startsWith(name + ' ')) || '').split(/\s+/).slice(1)
  const names = (p) => p.split(';').map(s => s.trim().split(/\s+/)[0]).filter(Boolean)

  it('existe y va antes de cualquier script o estilo', () => {
    expect(metaCsp).not.toBe('')
    const at = html.indexOf('http-equiv="Content-Security-Policy"')
    expect(at).toBeLessThan(html.indexOf('<script'))
    expect(at).toBeLessThan(html.indexOf('<link'))
  })
  it('mismas directivas que la cabecera, salvo frame-ancestors (no vale en meta)', () => {
    expect(names(metaCsp)).toEqual(names(csp).filter(n => n !== 'frame-ancestors'))
    for (const n of names(metaCsp)) {
      if (n === 'connect-src') continue
      expect(mdir(n), n).toEqual(dir(n))
    }
  })
  it('connect-src: lo de la cabecera más el dominio de la API para la app nativa', () => {
    expect(mdir('connect-src')).toEqual(["'self'", 'https://app.moyiq.app', ...dir('connect-src').slice(1)])
    expect(mdir('script-src')).not.toContain("'unsafe-inline'")
  })
})
