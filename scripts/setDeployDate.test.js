import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { setDeployDate } from './setDeployDate.mjs'

const SRC = readFileSync(fileURLToPath(new URL('../src/data/deployDate.js', import.meta.url)), 'utf8')

describe('setDeployDate', () => {
  it('fija la fecha y quita el TODO', () => {
    const out = setDeployDate(SRC, '2026-12-03')
    expect(out).toContain("export const REBRAND_DEPLOY_DATE = '2026-12-03'")
    expect(out).not.toContain('TODO(rebrand')
  })
  it('rechaza fechas mal escritas', () => {
    expect(() => setDeployDate(SRC, '1-dic')).toThrow()
    expect(() => setDeployDate(SRC, '2026-13-45')).toThrow()
  })
})
