import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { goalDisplayColor, contrast, DARK_SURFACES } from './goalColor.js'
import { LEGACY_COLOR_MAP } from './legacyColors.js'

const ok = hex => DARK_SURFACES.every(s => contrast(hex, s) >= 3)

describe('color de meta en oscuro (objeto ≥ 3:1)', () => {
  it('el morado de marca (meta nueva y Navy convertido) pasa a morado 300', () => {
    expect(contrast('#3C2282', '#1C1D21')).toBeLessThan(1.5) // el problema de partida
    expect(goalDisplayColor('#3C2282', true)).toBe('#A897DA')
    expect(goalDisplayColor('#3c2282', true)).toBe('#A897DA')
    expect(goalDisplayColor('#2D1964', true)).toBe('#A897DA')
    expect(ok('#A897DA')).toBe(true)
  })
  it('en claro no cambia nada', () => {
    expect(goalDisplayColor('#3C2282', false)).toBe('#3C2282')
  })
  it('cualquier color de la paleta de metas, convertido o viejo, queda ≥ 3:1 en oscuro', () => {
    const map = LEGACY_COLOR_MAP || {}
    const samples = [...Object.keys(map), ...Object.values(map), '#1a6b4a', '#7c3aed', '#2563eb', '#000000', '#14213D']
    for (const h of samples) expect(ok(goalDisplayColor(h, true)), h).toBe(true)
  })
  it('un color ya legible se respeta y uno inválido se devuelve igual', () => {
    expect(goalDisplayColor('#D0F06E', true)).toBe('#D0F06E')
    expect(goalDisplayColor('var(--grn)', true)).toBe('var(--grn)')
    expect(goalDisplayColor(undefined, true)).toBe(undefined)
  })
  it('las superficies coinciden con tokens.css', () => {
    const css = readFileSync(fileURLToPath(new URL('../styles/tokens.css', import.meta.url)), 'utf8')
    expect(css).toMatch(/--gray-900: #1C1D21;/)
    expect(css).toMatch(/--gray-800: #2A2C31;/)
    expect(css).toMatch(/--purple-300: #A897DA;/)
  })
})
