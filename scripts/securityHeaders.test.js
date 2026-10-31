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

// SEG-1 / SEG-7: Cloudflare Turnstile carga api.js y su iframe desde challenges.cloudflare.com.
describe('Turnstile en la CSP', () => {
  it('script-src y frame-src permiten challenges.cloudflare.com, y nada más se abre', () => {
    expect(dir('script-src')).toContain('https://challenges.cloudflare.com')
    expect(dir('frame-src')).toEqual(['https://challenges.cloudflare.com'])
    expect(dir('connect-src')).not.toContain('https://challenges.cloudflare.com')
  })
})
