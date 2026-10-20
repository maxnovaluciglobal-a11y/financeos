// BRD-13: la app tiene vista previa al compartir (Open Graph + Twitter) y la
// imagen existe en public/ con el tamaño declarado.
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const html = readFileSync(join(ROOT, 'index.html'), 'utf8')
const meta = (attr, name) => html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]+)"`))?.[1]

describe('vista previa al compartir (BRD-13)', () => {
  it('declara og:title, og:description, og:image y twitter:card', () => {
    for (const k of ['og:title', 'og:description', 'og:image', 'og:url']) expect(meta('property', k)).toBeTruthy()
    expect(meta('name', 'twitter:card')).toBe('summary_large_image')
    expect(meta('property', 'og:description')).not.toMatch(/!|¡/)
  })
  it('la imagen está en public/ y mide 1200x630', () => {
    const url = meta('property', 'og:image')
    expect(url).toBe('https://app.moyiq.app/app/og-app.png')
    const file = join(ROOT, 'public', 'og-app.png')
    expect(existsSync(file)).toBe(true)
    const png = readFileSync(file)
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630])
  })
})
