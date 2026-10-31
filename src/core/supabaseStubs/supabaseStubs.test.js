import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import * as realtime from './realtime.js'
import * as storage from './storage.js'

const here = dirname(fileURLToPath(import.meta.url))
const srcRoot = join(here, '..', '..')
const require = createRequire(import.meta.url)
const supabaseDist = readFileSync(join(dirname(require.resolve('@supabase/supabase-js')), 'index.mjs'), 'utf8')

const importedFrom = (pkg) => {
  const m = supabaseDist.match(new RegExp(`import \\{([^}]+)\\} from "${pkg}"`))
  return m ? m[1].split(',').map(s => s.trim()).filter(Boolean) : []
}
const sources = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f)
  if (statSync(p).isDirectory()) return f === 'supabaseStubs' ? [] : sources(p)
  return /\.jsx?$/.test(f) && !/\.test\./.test(f) ? [p] : []
})

describe('stubs de Supabase (V4)', () => {
  it('cubren lo que supabase-js importa de realtime-js y storage-js', () => {
    expect(importedFrom('@supabase/realtime-js').length).toBeGreaterThan(0)
    for (const name of importedFrom('@supabase/realtime-js')) expect(realtime[name], name).toBeDefined()
    expect(importedFrom('@supabase/storage-js').length).toBeGreaterThan(0)
    for (const name of importedFrom('@supabase/storage-js')) expect(storage[name], name).toBeDefined()
  })
  it('tienen todo método que supabase-js llama sobre el cliente de Realtime', () => {
    const used = [...new Set([...supabaseDist.matchAll(/this\.realtime\.(\w+)\(/g)].map(m => m[1]))]
    expect(used).toContain('setAuth')
    const client = new realtime.RealtimeClient()
    for (const m of used) expect(typeof client[m], m).toBe('function')
  })
  it('setAuth no falla y devuelve una promesa, como el cliente real', async () => {
    await expect(new realtime.RealtimeClient().setAuth('token')).resolves.toBeUndefined()
    await expect(new realtime.RealtimeClient().setAuth()).resolves.toBeUndefined()
  })
  it('la app no usa Realtime ni Storage de Supabase (si los usa, hay que quitar el alias)', () => {
    const offenders = sources(srcRoot).filter((f) => {
      const code = readFileSync(f, 'utf8')
      return /[Cc]lient\??\.(storage|realtime|channel)\b|\.removeChannel\(|\.removeAllChannels\(|\.storage\.from\(/.test(code)
    })
    expect(offenders).toEqual([])
  })
  it('vite.config.js solo aplica el alias a esos dos paquetes', () => {
    const cfg = readFileSync(join(srcRoot, '..', 'vite.config.js'), 'utf8')
    expect(cfg).toContain("find: /^@supabase\\/realtime-js$/")
    expect(cfg).toContain("find: /^@supabase\\/storage-js$/")
  })
})
