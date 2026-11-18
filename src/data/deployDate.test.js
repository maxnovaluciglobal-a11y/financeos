// Fecha del despliegue del rebranding: un solo lugar (deployDate.js) del que
// salen la vigencia de los legales y el id de la nota de Novedades.
// Con PREDEPLOY=1 (paso previo a integrar a main) falla si sigue el TODO.
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { REBRAND_DEPLOY_DATE } from './deployDate.js'
import { LEGAL_EFFECTIVE_DATE, LEGAL_VERSION, LAST_UPDATED } from '../pages/legal/legalMeta.js'
import { RELEASE_NOTES } from './releaseNotes.js'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const TODO = 'TODO(rebrand' // TODO(rebrand) y TODO(rebrand-deploy)

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

  it.runIf(process.env.PREDEPLOY === '1')('PREDEPLOY: no queda ningún TODO(rebrand…) en src/, supabase/functions/ ni public/', () => {
    const left = []
    for (const d of ['src', 'supabase/functions', 'public']) {
      for (const file of walk(join(ROOT, d))) {
        readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
          if (line.includes(TODO)) left.push(`${relative(ROOT, file)}:${i + 1}`)
        })
      }
    }
    expect(left).toEqual([])
  })
})
