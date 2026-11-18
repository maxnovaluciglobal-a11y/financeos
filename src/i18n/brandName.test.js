// Rebranding moyiq (Entrega 1, plan §4 Fase 1.3): el nombre se escribe
// "moyiq" (y "Moyiq" al inicio de frase), nunca "MOY IQ". Esta prueba recorre
// src/ y supabase/functions/ y falla si aparece "MOY IQ" fuera de los alias
// permitidos: el aviso del cambio de nombre, el nombre anterior en los
// legales y los tests que comprueban justamente que el nombre viejo no está.
// Las migraciones de supabase/ no se revisan: son historia ya aplicada.
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const DIRS = ['src', 'supabase/functions']
const EXT = /\.(js|jsx|ts|tsx|mjs|css|html|json)$/

// Archivos de la rama del sistema visual (rebrand/entrega-1-sistema), que los
// cambia en paralelo. TODO(rebrand): sacar estas entradas al integrar esa rama.
const OWNED_BY_SYSTEM_BRANCH = [/^src\/styles\//, /^src\/components\/Logo\.jsx$/]

// Alias permitidos: cada ocurrencia de "MOY IQ" tiene que estar dentro de uno.
const ALLOWED_ALIASES = [
  // Aviso "MOY IQ ahora es moyiq" (Novedades y legales), 4 idiomas.
  /MOY IQ ahora (es|se llama) moyiq/,
  /MOY IQ is now (called )?moyiq/,
  /O MOY IQ agora (é|se chama) moyiq/,
  /MOY IQ heißt jetzt moyiq/,
  // Nombre anterior (legales de licencia y metadatos SEO "antes MOY IQ").
  /antes MOY IQ/,
  /previously called MOY IQ/,
  /se chamava MOY IQ/,
  /früher MOY IQ/,
  // Ruta real de la carpeta del proyecto en comentarios.
  /02 - MOY IQ\//,
]

// Tests cuyo trabajo es verificar que el nombre viejo no aparece o que se
// reemplaza (sus "MOY IQ" son datos de entrada o la condición negada).
const TEST_FIXTURES = new Set([
  'src/i18n/brandName.test.js',
  'src/pages/legal/legal.test.js',
  'supabase/functions/_shared/emailBrandAll.test.ts',
  'supabase/functions/_shared/emailSender.test.ts',
])
// Comentarios que explican el alias en su propio archivo.
const ALIAS_COMMENTS = ['"MOY IQ" aparece aquí a propósito']

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (EXT.test(name)) out.push(p)
  }
  return out
}

function offendingLines(text) {
  const bad = []
  text.split('\n').forEach((line, i) => {
    if (!line.includes('MOY IQ')) return
    if (ALIAS_COMMENTS.some(c => line.includes(c))) return
    let rest = line
    for (const re of ALLOWED_ALIASES) rest = rest.replace(new RegExp(re.source, 'g'), '')
    if (rest.includes('MOY IQ')) bad.push(i + 1)
  })
  return bad
}

describe('nombre de marca: moyiq, nunca "MOY IQ"', () => {
  it('la regla reconoce los alias y rechaza el resto', () => {
    expect(offendingLines('Bienvenido a MOY IQ')).toEqual([1])
    expect(offendingLines('x\nMOY IQ ahora es moyiq: cambia el nombre')).toEqual([])
    expect(offendingLines('<title>Moyiq (antes MOY IQ)</title>')).toEqual([])
    expect(offendingLines('MOY IQ ahora es moyiq. MOY IQ Pro')).toEqual([1])
  })

  it('src/ y supabase/functions/ solo usan los alias permitidos', () => {
    const offenders = []
    let scanned = 0
    for (const d of DIRS) {
      for (const file of walk(join(ROOT, d))) {
        const rel = relative(ROOT, file).split('\\').join('/')
        if (TEST_FIXTURES.has(rel) || OWNED_BY_SYSTEM_BRANCH.some(re => re.test(rel))) continue
        scanned++
        for (const n of offendingLines(readFileSync(file, 'utf8'))) offenders.push(`${rel}:${n}`)
      }
    }
    expect(scanned).toBeGreaterThan(300)
    expect(offenders).toEqual([])
  })
})
