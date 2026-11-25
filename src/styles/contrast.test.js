// Contraste del nivel 3 (revisión del plan §A1): lee los tokens REALES de
// tokens.css (claro y oscuro), compone las superposiciones con alfa (texto al
// 72/84/92 %, lupa recortada al 6–8 %, chip al 14 %) sobre los TRES puntos de
// Impulso y los dos de Profundidad, y falla con un par bajo 4,5:1 (texto) o
// 3:1 (objetos: bordes de campo, foco, barras, "+", pestaña activa). WCAG 2.1,
// fórmula de luminancia relativa. Si se cambia un color en tokens.css y algún
// par cae, este test lo dice antes del despliegue.
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'tokens.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')

// ── Lectura de tokens.css: declaraciones por tema, var() resuelto ──
function blocks(selectorTest) {
  const out = {}
  // Solo bloques de nivel superior (sin @media), en orden: el último gana.
  const top = css.replace(/@(media|supports)[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')
  for (const m of top.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectorTest(m[1].trim())) continue
    for (const d of m[2].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[d[1]] = d[2].trim()
  }
  return out
}
const isRoot = (sel) => sel.split(',').map(s => s.trim()).some(s => s === ':root' || s === '[data-theme="light"]')
const isDark = (sel) => sel.split(',').map(s => s.trim()).some(s => s === '[data-theme="dark"]')
const LIGHT = blocks(isRoot)
const DARK = { ...LIGHT, ...blocks(isDark) }

function resolve(theme, name, depth = 0) {
  const raw = theme[name]
  if (raw == null) throw new Error(`token sin definir: ${name}`)
  const v = raw.match(/^var\((--[a-z0-9-]+)\)$/)
  if (v) { if (depth > 12) throw new Error('var() circular'); return resolve(theme, v[1], depth + 1) }
  return raw
}

// ── Color ──
const hex = (h) => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) }
// '#RRGGBB' | 'rgb(r g b / a)' → [r, g, b, a]
function parse(c) {
  if (c.startsWith('#')) return [...hex(c), 1]
  const m = c.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*(?:[/,]\s*([\d.]+))?\s*\)$/)
  if (!m) throw new Error(`color no soportado: ${c}`)
  return [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]]
}
const over = (top, base) => { const [r, g, b, a] = top; return [0, 1, 2].map(i => Math.round([r, g, b][i] * a + base[i] * (1 - a))) }
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
// Compone una pila de capas (de abajo hacia arriba) sobre un fondo opaco.
const stack = (base, ...layers) => layers.reduce((acc, l) => over(parse(l), acc), hex(base))
const tok = (theme, name) => resolve(theme, name)

const TEXT = 4.5, LARGE = 3, OBJECT = 3
const fails = []
beforeEach(() => { fails.length = 0 })
function check(label, fg, bg, min) {
  const r = ratio(fg, bg)
  if (r + 1e-9 < min) fails.push(`${label}: ${r.toFixed(2)} < ${min}`)
  return r
}

// ── 1. Sobre degradado: 3 puntos de Impulso y 2 de Profundidad ──
const IMPULSO = ['--impulso-0', '--impulso-59', '--impulso-100'].map(n => tok(LIGHT, n))
const PROF = ['--profundidad-0', '--profundidad-100'].map(n => tok(LIGHT, n))
const LOUPE = [0.06, 0.08]    // lupa recortada (manual 6–12 %; A1: ≤ 6 % detrás de texto)
const loupe = (a) => `rgb(255 255 255 / ${a})`

describe('contraste del nivel 3 sobre degradado (A1)', () => {
  it('texto principal, secundario (92 %) y chips (14 %) sobre los 3 puntos de Impulso, con y sin lupa', () => {
    for (const stop of IMPULSO) {
      for (const a of [0, ...LOUPE]) {
        const base = stack(stop, loupe(a))
        const tag = `Impulso ${stop} lupa ${a}`
        check(`${tag} · texto`, stack(stop, tok(LIGHT, '--on-grad-text')), base, TEXT)
        // El 92 % se compone sobre el fondo con la lupa debajo.
        check(`${tag} · texto 92 %`, over(parse(tok(LIGHT, '--on-grad-text-2')), base), base, TEXT)
        // Chip translúcido (token) + texto blanco encima, también con la lupa debajo.
        const chip = over(parse(tok(LIGHT, '--on-grad-chip')), base)
        check(`${tag} · texto sobre chip`, hex('#FFFFFF'), chip, TEXT)
        // El chip del prototipo (14 %) pasa solo sin lupa: por eso el token es más bajo.
        if (a === 0) check(`${tag} · texto sobre chip 14 %`, hex('#FFFFFF'), over([255, 255, 255, 0.14], base), TEXT)
        // Línea del ritmo ideal (objeto) y la lima como texto GRANDE.
        check(`${tag} · línea ideal`, over(parse(tok(LIGHT, '--on-grad-ideal')), base), base, OBJECT)
        check(`${tag} · lima texto grande`, hex(tok(LIGHT, '--on-grad-accent')), base, LARGE)
      }
    }
    expect(fails).toEqual([])
  })

  it('las alfas que la revisión descartó (84 % y 72 %) siguen fallando sobre Impulso: no se usan', () => {
    // Documenta por qué --on-grad-text-2 es 92 %: con 84 % y lupa, o 72 %, cae bajo 4,5.
    const p = hex(IMPULSO[2])
    const withLoupe = stack(IMPULSO[2], loupe(0.08))
    expect(ratio(over([255, 255, 255, 0.84], withLoupe), withLoupe)).toBeLessThan(TEXT)
    expect(ratio(over([255, 255, 255, 0.72], p), p)).toBeLessThan(TEXT)
    expect(tok(LIGHT, '--on-grad-text-2')).toMatch(/\/ \.9[2-9]\)|\/ 1\)/)
  })

  it('sobre Profundidad: texto, 72/84/92 %, lima como texto normal y chip 14 %, con lupa', () => {
    for (const stop of PROF) {
      for (const a of [0, ...LOUPE]) {
        const base = stack(stop, loupe(a))
        const tag = `Profundidad ${stop} lupa ${a}`
        for (const alpha of [1, 0.92, 0.84, 0.72]) check(`${tag} · blanco ${alpha}`, over([255, 255, 255, alpha], base), base, TEXT)
        check(`${tag} · lima texto`, hex(tok(LIGHT, '--on-grad-accent')), base, TEXT)
        check(`${tag} · texto sobre chip 14 %`, hex('#FFFFFF'), over(parse(tok(LIGHT, '--on-grad-chip')), base), TEXT)
        check(`${tag} · barra lima sobre track`, hex(tok(LIGHT, '--on-grad-accent')), over(parse(tok(LIGHT, '--on-grad-track')), base), OBJECT)
      }
    }
    expect(fails).toEqual([])
  })

  it('la lupa recortada detrás de texto queda en 6 % o menos', () => {
    expect(Number(tok(LIGHT, '--on-grad-loupe'))).toBeLessThanOrEqual(0.06)
  })
})

// ── 2. Pares semánticos de la interfaz, claro y oscuro ──
const THEMES = { claro: LIGHT, oscuro: DARK }
const SURFACES = ['--color-bg', '--color-surface', '--color-surface-raised', '--color-fill']
const TEXTS = ['--text-primary', '--text-subtle', '--text-secondary', '--color-brand-text', '--color-income-text', '--color-over-text', '--color-warn-text']
const OBJECTS = ['--color-border-field', '--color-focus', '--color-brand', '--color-income', '--color-over', '--color-warn', '--color-action', '--chart-income', '--chart-expense']

// Superficie opaca resultante (las del oscuro llevan alfa sobre el fondo/superficie).
function surfaceRgb(theme, name) {
  const bg = hex(tok(theme, '--color-bg'))
  const v = tok(theme, name)
  const c = parse(v)
  if (c[3] === 1) return c.slice(0, 3)
  // Un relleno translúcido se mide encima de la superficie de tarjeta (el peor caso).
  return over(c, over(parse(tok(theme, '--color-surface')), bg))
}

describe('contraste de los tokens semánticos (claro y oscuro)', () => {
  for (const [name, theme] of Object.entries(THEMES)) {
    it(`${name}: texto ≥ 4,5 y objetos ≥ 3 sobre fondo, tarjeta, elevado y relleno`, () => {
      for (const s of SURFACES) {
        const bg = surfaceRgb(theme, s)
        for (const t of TEXTS) check(`${name} ${t} / ${s}`, parse(tok(theme, t)).slice(0, 3), bg, TEXT)
        for (const o of OBJECTS) {
          // El "+" y la pestaña activa viven en la barra (fondo/elevado), nunca sobre un relleno.
          if (o === '--color-action' && s === '--color-fill') continue
          check(`${name} ${o} / ${s}`, parse(tok(theme, o)).slice(0, 3), bg, OBJECT)
        }
      }
      // Texto sobre rellenos de marca y de dato.
      check(`${name} texto sobre botón primario`, hex(tok(theme, '--text-on-brand')), hex(tok(theme, '--color-brand')), TEXT)
      check(`${name} texto sobre franja de marca`, hex(tok(theme, '--color-brand-solid-fg')), hex(tok(theme, '--color-brand-solid')), TEXT)
      check(`${name} texto sobre borrar`, hex(tok(theme, '--color-on-over')), hex(tok(theme, '--color-over-solid')), TEXT)
      check(`${name} grafito sobre lima`, hex(tok(theme, '--text-on-accent')), hex(tok(theme, '--color-accent')), TEXT)
      // "+" y pestaña activa: ícono sobre el violeta (objeto) y el violeta sobre la barra.
      check(`${name} ícono sobre "+"`, hex(tok(theme, '--color-action-fg')), hex(tok(theme, '--color-action')), OBJECT)
      check(`${name} etiqueta de pestaña activa`, hex(tok(theme, '--tabbar-label-active')), surfaceRgb(theme, '--color-surface-raised'), TEXT)
      // Texto de dato sobre su propio tinte (StateTag, avisos).
      for (const k of ['income', 'over', 'warn']) {
        const tint = surfaceRgb(theme, `--color-${k}-bg`)
        check(`${name} ${k} texto / tinte`, hex(tok(theme, `--color-${k}-text`)), tint, TEXT)
        check(`${name} texto principal / tinte ${k}`, hex(tok(theme, '--text-primary')), tint, TEXT)
        check(`${name} texto secundario / tinte ${k}`, hex(tok(theme, '--text-secondary')), tint, TEXT)
      }
      // Chip elegido de marca (morado 100/22 %) con texto de marca.
      check(`${name} marca / chip elegido`, hex(tok(theme, '--color-brand-text')), surfaceRgb(theme, '--color-brand-muted'), TEXT)
      expect(fails).toEqual([])
    })
  }

  it('en oscuro el violeta de acción no es #7A21FF (2,88:1, A1.5)', () => {
    expect(tok(DARK, '--color-action').toUpperCase()).not.toBe('#7A21FF')
  })
})

// ── 3. Cápsula inferior translúcida sobre lo que pasa por detrás (A11Y-N3) ──
// El material es color-mix(superficie elevada X %, transparent): el contraste
// de las etiquetas se mide contra la mezcla con lo que queda detrás (la escena
// morada del Inicio, el fondo o la lima), no contra la superficie sólida. El
// desenfoque promedia el fondo, así que cada parada del degradado es un caso.
// '--x' → [r, g, b, a] resolviendo color-mix(in srgb, var(--y) N%, transparent).
function material(theme, name) {
  const raw = tok(theme, name)
  const m = raw.match(/^color-mix\(in srgb,\s*var\((--[a-z0-9-]+)\)\s+([\d.]+)%,\s*transparent\)$/)
  if (m) return [...parse(tok(theme, m[1])).slice(0, 3), +m[2] / 100]
  return parse(raw)
}
const BEHIND = ['--impulso-0', '--impulso-59', '--impulso-100', '--profundidad-0', '--profundidad-100', '--color-bg', '--color-accent']

describe('contraste de la cápsula inferior sobre la escena (A11Y-N3)', () => {
  for (const [name, theme] of Object.entries(THEMES)) {
    it(`${name}: etiquetas inactiva y activa ≥ 4,5 sobre el material translúcido con cualquier fondo detrás`, () => {
      const fg = parse(tok(theme, '--tabbar-fg')).slice(0, 3)
      const fgOn = parse(tok(theme, '--tabbar-label-active')).slice(0, 3)
      const icOn = parse(tok(theme, '--tabbar-fg-active')).slice(0, 3)
      for (const b of BEHIND) {
        const pill = over(material(theme, '--tabbar-bg'), hex(tok(theme, b)))
        check(`${name} etiqueta / cápsula sobre ${b}`, fg, pill, TEXT)
        const activePill = over(material(theme, '--tabbar-active-bg'), pill)
        check(`${name} etiqueta activa / píldora sobre ${b}`, fgOn, activePill, TEXT)
        check(`${name} ícono activo / píldora sobre ${b}`, icOn, activePill, OBJECT)
      }
      expect(fails).toEqual([])
    })
  }

  it('el gris de etiqueta anterior (gris 600 al 82 %) fallaba sobre la escena: no se usa', () => {
    // Documenta la medición de la auditoría: #6B6F78 sobre ~#E4D8F4 → 3,7:1.
    const pill = over([255, 255, 255, 0.82], hex(tok(LIGHT, '--impulso-59')))
    expect(ratio(hex(tok(LIGHT, '--gray-600')), pill)).toBeLessThan(TEXT)
  })
})

// ── 4. Hojas con material de vidrio (24-nov-2026, interruptor Transparencias) ──
// La hoja es color-mix(superficie 94 %, transparent) sobre la página oscurecida
// por el velo. Se mide el peor caso: negro o blanco puro detrás, además de los
// fondos de marca. Con Transparencias apagadas o "Reducir transparencia" la
// hoja es sólida (html[data-glass="off"] y @media en tokens.css).
describe('contraste del texto sobre las hojas de vidrio', () => {
  for (const [name, theme] of Object.entries(THEMES)) {
    it(`${name}: texto principal, secundario y tenue ≥ 4,5 con cualquier fondo detrás`, () => {
      const mat = material(theme, '--sheet-bg')
      for (const b of [...BEHIND.map(n => hex(tok(theme, n))), [0, 0, 0], [255, 255, 255]]) {
        const bg = over(mat, b)
        for (const t of ['--text-primary', '--text-secondary', '--text-subtle']) check(`${name} ${t} / hoja sobre ${b}`, parse(tok(theme, t)).slice(0, 3), bg, TEXT)
      }
      expect(fails).toEqual([])
    })
  }
  it('apagado, reducido o sin backdrop-filter: barra y hojas sólidas', () => {
    expect(css).toMatch(/html\[data-glass="off"\]\s*\{[^}]*--tabbar-blur:\s*none[^}]*--sheet-bg:\s*var\(--color-surface\)/)
    expect(css).toMatch(/prefers-reduced-transparency:\s*reduce/)
    expect(css).toMatch(/@supports not \(\(backdrop-filter/)
  })
})
