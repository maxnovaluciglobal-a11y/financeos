// D5 (08-oct-2026): nada de emoji de bandera en la UI. En Windows se ven como
// "CL"/"MX" y no respetan el tema; el país se marca con <CountryBadge>.
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..')
const FLAG = /\p{Regional_Indicator}{2}/u

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(jsx?|css)$/.test(f) && !/\.test\.js$/.test(f)) out.push(p)
  }
  return out
}

describe('sin emoji de bandera (D5)', () => {
  it('ningún archivo de src (código ni textos i18n) usa banderas emoji', () => {
    const files = walk(ROOT)
    expect(files.length).toBeGreaterThan(100)
    const offenders = files.filter(p => FLAG.test(readFileSync(p, 'utf8'))).map(p => p.slice(ROOT.length + 1))
    expect(offenders).toEqual([])
  })
})
