// Fecha del despliegue del rebranding: un solo lugar (deployDate.js) del que
// salen la vigencia de los legales y el id de la nota de Novedades.
// En main (CI o rama local), con RELEASE=1 (./deploy.sh) o PREDEPLOY=1 falla si
// sigue el TODO. Para fijar la fecha: node scripts/setDeployDate.mjs AAAA-MM-DD
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { PRIVACY_DEPLOY_DATE, PRIVACY_PREVIOUS_DATE, REBRAND_DEPLOY_DATE, TERMS_DEPLOY_DATE, TERMS_PREVIOUS_DATE } from './deployDate.js'
import { LEGAL_EFFECTIVE_DATE, LEGAL_VERSION, LAST_UPDATED, PRIVACY_EFFECTIVE_DATE, PRIVACY_LAST_UPDATED, PRIVACY_REPLACES, PRIVACY_VERSION, TERMS_EFFECTIVE_DATE, TERMS_LAST_UPDATED, TERMS_REPLACES, TERMS_VERSION } from '../pages/legal/legalMeta.js'
import { RELEASE_NOTES } from './releaseNotes.js'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const TODOS = ['TODO(rebrand', 'TODO(privacy-deploy'] // TODO(rebrand), TODO(rebrand-deploy) y TODO(privacy-deploy)

function localBranch() {
  try { return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { return '' }
}
// Candado de publicación: el TODO no puede llegar a producción.
export function releaseGate(env = process.env, branch = localBranch()) {
  return env.PREDEPLOY === '1' || env.RELEASE === '1' || env.GITHUB_REF === 'refs/heads/main' || branch === 'main'
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(js|jsx|ts|tsx|html|css)$/.test(name) && !/\.test\./.test(name)) out.push(p)
  }
  return out
}

describe('fecha del despliegue del rebranding', () => {
  it('es una fecha válida', () => {
    expect(REBRAND_DEPLOY_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(Number.isNaN(new Date(`${REBRAND_DEPLOY_DATE}T12:00:00Z`).getTime())).toBe(false)
  })

  it('la vigencia legal y su versión salen de esa fecha', () => {
    expect(LEGAL_EFFECTIVE_DATE).toBe(REBRAND_DEPLOY_DATE)
    expect(LEGAL_VERSION).toBe(REBRAND_DEPLOY_DATE.slice(0, 7))
    expect(LAST_UPDATED.es).toContain(String(Number(REBRAND_DEPLOY_DATE.slice(0, 4))))
  })

  it('la nota de Novedades del cambio de nombre usa esa fecha y va primero', () => {
    const note = RELEASE_NOTES.find(n => n.items.es.some(l => l.includes('ahora es moyiq')))
    expect(note.id).toBe(REBRAND_DEPLOY_DATE)
    expect(RELEASE_NOTES[0]).toBe(note)
    expect(note.id > RELEASE_NOTES[1].id).toBe(true)
  })

  it('ninguna otra fecha de despliegue queda escrita a mano en legales ni Novedades', () => {
    for (const f of ['src/pages/legal/legalMeta.js', 'src/data/releaseNotes.js']) {
      expect(readFileSync(join(ROOT, f), 'utf8')).not.toContain(`'${REBRAND_DEPLOY_DATE}'`)
    }
  })

  it('la Política de Privacidad tiene vigencia y versión propias, posteriores a la del 18-nov (LEG-N1)', () => {
    expect(PRIVACY_DEPLOY_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(PRIVACY_EFFECTIVE_DATE).toBe(PRIVACY_DEPLOY_DATE)
    expect(PRIVACY_VERSION).toBe(PRIVACY_DEPLOY_DATE)
    expect(PRIVACY_REPLACES).toBe(PRIVACY_PREVIOUS_DATE)
    expect(PRIVACY_EFFECTIVE_DATE > PRIVACY_PREVIOUS_DATE).toBe(true)
    expect(PRIVACY_PREVIOUS_DATE > REBRAND_DEPLOY_DATE).toBe(true)
    expect(PRIVACY_LAST_UPDATED.es).toContain(`reemplaza a la versión ${PRIVACY_PREVIOUS_DATE}`)
    expect(PRIVACY_LAST_UPDATED.es).not.toBe(LAST_UPDATED.es)
    for (const lang of ['en', 'pt', 'de']) expect(PRIVACY_LAST_UPDATED[lang]).toContain(PRIVACY_PREVIOUS_DATE)
  })

  it('N4 (ronda 3): la política de la app tiene la misma fecha que la landing (24-nov, reemplaza a 20-nov)', () => {
    expect(PRIVACY_DEPLOY_DATE).toBe('2026-11-24')
    expect(PRIVACY_PREVIOUS_DATE).toBe('2026-11-20')
  })

  it('R3-2 (ronda 4): los Términos de la app tienen la vigencia de la landing (24-nov, reemplaza a 18-nov) en los 4 idiomas', () => {
    expect(TERMS_DEPLOY_DATE).toBe('2026-11-24')
    expect(TERMS_PREVIOUS_DATE).toBe(REBRAND_DEPLOY_DATE)
    expect(TERMS_EFFECTIVE_DATE).toBe(TERMS_DEPLOY_DATE)
    expect(TERMS_VERSION).toBe(TERMS_DEPLOY_DATE)
    expect(TERMS_REPLACES).toBe('2026-11-18')
    expect(TERMS_EFFECTIVE_DATE > REBRAND_DEPLOY_DATE).toBe(true)
    expect(TERMS_LAST_UPDATED).toEqual({
      es: 'Vigente desde el 24 de noviembre de 2026 · reemplaza a la versión 2026-11-18',
      en: 'Effective November 24, 2026 · replaces version 2026-11-18',
      pt: 'Em vigor desde 24 de novembro de 2026 · substitui a versão 2026-11-18',
      de: 'Gültig ab 24. November 2026 · ersetzt die Fassung 2026-11-18',
    })
    for (const lang of ['es', 'en', 'pt', 'de']) expect(TERMS_LAST_UPDATED[lang]).not.toContain('18 ')
    // Licencia y descargo no cambiaron dentro de la app: siguen con la fecha del rebranding.
    expect(LAST_UPDATED.en).toBe('Effective November 18, 2026')
  })

  it('el TODO(privacy-deploy) sigue junto a PRIVACY_DEPLOY_DATE mientras la fecha no esté fijada', () => {
    const src = readFileSync(join(ROOT, 'src/data/deployDate.js'), 'utf8')
    if (src.includes('TODO(privacy-deploy)')) expect(src).toMatch(/TODO\(privacy-deploy\)[^\n]*\n(?:\/\/[^\n]*\n)*export const PRIVACY_DEPLOY_DATE/)
  })

  it('el candado se activa en main, con RELEASE=1 y con PREDEPLOY=1, y no en otra rama', () => {
    expect(releaseGate({}, 'rebrand/entrega-1')).toBe(false)
    expect(releaseGate({}, 'main')).toBe(true)
    expect(releaseGate({ GITHUB_REF: 'refs/heads/main' }, 'HEAD')).toBe(true)
    expect(releaseGate({ GITHUB_REF: 'refs/pull/9/merge' }, 'HEAD')).toBe(false)
    expect(releaseGate({ RELEASE: '1' }, 'x')).toBe(true)
    expect(releaseGate({ PREDEPLOY: '1' }, 'x')).toBe(true)
  })

  it('./deploy.sh corre los tests con RELEASE=1', () => {
    expect(readFileSync(join(ROOT, 'deploy.sh'), 'utf8')).toMatch(/^RELEASE=1 npm test/m)
  })

  it.runIf(releaseGate())('release: no queda ningún TODO(rebrand…) ni TODO(privacy-deploy) en src/, supabase/functions/ ni public/', () => {
    const left = []
    for (const d of ['src', 'supabase/functions', 'public']) {
      for (const file of walk(join(ROOT, d))) {
        readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
          if (TODOS.some(t => line.includes(t))) left.push(`${relative(ROOT, file)}:${i + 1}`)
        })
      }
    }
    expect(left).toEqual([])
  })
})
