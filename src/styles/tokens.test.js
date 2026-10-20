// BRD-4 / BRD-10: un solo origen de color. tokens.css define la paleta;
// tokens.js la repite para lo que no lee CSS; ningún archivo de src/ usa un
// hex que no sea de la paleta.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TOKENS_LIGHT, TOKENS_DARK, EXTRA_ALLOWED_HEX } from './tokens.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, '..')
const css = readFileSync(join(HERE, 'tokens.css'), 'utf8')

function hexVars(block) {
  const out = {}
  for (const m of block.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{3,8})\b/g)) out[m[1]] = m[2].toUpperCase()
  return out
}

const darkStart = css.indexOf('[data-theme="dark"]')
const lightCss = css.slice(0, darkStart)
const darkCss = css.slice(darkStart)

// Excepciones con motivo: el logo de Google (colores de su marca, botón de
// "Continuar con Google").
const EXEMPT = { 'components/AuthGate.jsx': ['#EA4335', '#4285F4', '#FBBC05', '#34A853'] }

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, files)
    else if (/\.(jsx?|css)$/.test(name) && !/\.test\.jsx?$/.test(name)) files.push(p)
  }
  return files
}

describe('tokens de diseño (BRD-4, BRD-10)', () => {
  it('tokens.js repite exactamente los hex de tokens.css (claro y oscuro)', () => {
    const up = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.toUpperCase()]))
    expect(hexVars(lightCss)).toEqual(up(TOKENS_LIGHT))
    expect(hexVars(darkCss)).toEqual(up(TOKENS_DARK))
  })

  it('globals.css importa tokens.css y no define colores propios', () => {
    const g = readFileSync(join(HERE, 'globals.css'), 'utf8')
    expect(g).toMatch(/@import '\.\/tokens\.css';/)
    expect(g.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/)
  })

  it('ningún archivo de src/ usa un hex fuera de la paleta', () => {
    const allowed = new Set([...Object.values(TOKENS_LIGHT), ...Object.values(TOKENS_DARK), ...EXTRA_ALLOWED_HEX].map((h) => h.toUpperCase()))
    const bad = []
    for (const f of walk(SRC)) {
      const rel = relative(SRC, f)
      if (rel === 'styles/tokens.css' || rel === 'styles/tokens.js') continue
      const text = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
      for (const m of text.matchAll(/#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b/g)) {
        const hex = m[0].toUpperCase()
        if (allowed.has(hex) || (EXEMPT[rel] || []).includes(hex)) continue
        bad.push(`${rel}: ${m[0]}`)
      }
    }
    expect(bad).toEqual([])
  })
})
