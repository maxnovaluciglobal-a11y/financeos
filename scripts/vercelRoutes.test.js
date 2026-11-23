// C11 y C19 de la auditoría de branding (23-nov-2026): en app.moyiq.app y
// demo.moyiq.app la raíz iba a www.moyiq.app y de ahí a moyiq.app (dos saltos),
// y cualquier ruta fuera de /app/ (p. ej. /login) daba el 404 genérico de
// Vercel, sin marca. Ahora la raíz va directo a la landing y lo demás a /app/.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
const build = readFileSync(new URL('../build.js', import.meta.url), 'utf8')

// Vercel evalúa las redirecciones en orden, antes que los archivos, y usa la
// primera que coincide. Las fuentes de acá son rutas fijas o un grupo con regex.
const toRegex = (source) => new RegExp(`^${source}$`)
function redirectFor(path) {
  return vercel.redirects.find((r) => toRegex(r.source).test(path)) ?? null
}

describe('redirecciones de la raíz y de rutas fuera de /app/', () => {
  it('la raíz va directo a https://moyiq.app/, sin pasar por www', () => {
    const r = redirectFor('/')
    expect(r.destination).toBe('https://moyiq.app/')
    expect(r.permanent).toBe(true)
    expect(JSON.stringify(vercel)).not.toContain('www.moyiq.app')
  })

  it('/index.html (el archivo que deja build.js) también apunta a moyiq.app sin www', () => {
    expect(build).toContain('url=https://moyiq.app/')
    expect(build).not.toContain('www.moyiq.app')
  })

  it.each(['/login', '/zzz', '/app', '/settings/profile', '/apple-touch-icon.png'])('%s va a /app/ en un salto', (path) => {
    const r = redirectFor(path)
    expect(r, path).toBeTruthy()
    expect(r.destination).toBe('/app/')
    expect(r.has).toBeUndefined()
  })

  it('las redirecciones de los correos viejos siguen teniendo prioridad', () => {
    for (const d of ['signup', 'delete-account', 'upgrade', 'import', 'dashboard']) {
      expect(redirectFor(`/${d}`).destination).toBe(`/app/?open=${d}`)
    }
  })

  it.each([
    '/app/', '/app/assets/index-abc.js', '/app/manifest.webmanifest', '/app/sw.js',
    '/.well-known/assetlinks.json', '/favicon.svg', '/index.html',
    '/api/fixer', '/_vercel/insights/script.js',
  ])('%s no se redirige (la app, sus archivos, funciones y Vercel)', (path) => {
    expect(redirectFor(path), path).toBeNull()
  })
})
