// MKT-13: el manifest de la PWA trae íconos maskable, capturas (narrow y wide),
// accesos directos a destinos que la app entiende (?open=) y categorías; los
// archivos existen en public/ con el tamaño declarado.
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pageFromSearch } from '../src/utils/deepLink.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const cfg = readFileSync(join(ROOT, 'vite.config.js'), 'utf8')
const pngSize = (f) => { const b = readFileSync(f); return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}` }

describe('manifest de la PWA (MKT-13)', () => {
  it('íconos maskable, categorías y descripción', () => {
    expect(cfg).toMatch(/purpose: 'maskable'/)
    expect(cfg).toMatch(/categories: \['finance'/)
    expect(cfg).toMatch(/description: '/)
  })
  it('capturas narrow y wide que existen y miden lo declarado', () => {
    const shots = [...cfg.matchAll(/\{ src: '(screenshots\/[^']+)', sizes: '(\d+x\d+)'[^}]*form_factor: '(narrow|wide)'/g)]
    expect(shots.map(m => m[3])).toEqual(expect.arrayContaining(['narrow', 'wide']))
    for (const [, src, size] of shots) {
      const f = join(ROOT, 'public', src)
      expect(existsSync(f), src).toBe(true)
      expect(pngSize(f), src).toBe(size)
    }
  })
  it('los accesos directos van a destinos que deepLink abre', () => {
    const urls = [...cfg.matchAll(/url: '\/app\/(\?open=[a-z-]+)'/g)].map(m => m[1])
    expect(urls.length).toBeGreaterThanOrEqual(2)
    for (const u of urls) expect(pageFromSearch(u), u).toBeTruthy()
  })
})
