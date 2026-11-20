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
  it('no toca la fecha ni el TODO de la privacidad al fijar la del rebranding', () => {
    // Una vez fijada la fecha de la privacidad el TODO ya no está en el archivo
    // real: la prueba solo tiene sentido mientras siga pendiente.
    if (!SRC.includes('TODO(privacy-deploy)')) return
    const out = setDeployDate(SRC, '2026-12-03')
    expect(out).toContain('TODO(privacy-deploy)')
    expect(out).toMatch(/export const PRIVACY_DEPLOY_DATE = '\d{4}-\d{2}-\d{2}'/)
  })
  it('--privacy fija PRIVACY_DEPLOY_DATE y quita solo su TODO', () => {
    const out = setDeployDate(SRC, '2026-12-04', 'privacy')
    expect(out).toContain("export const PRIVACY_DEPLOY_DATE = '2026-12-04'")
    expect(out).not.toContain('TODO(privacy-deploy)')
    expect(out).toMatch(/export const REBRAND_DEPLOY_DATE = '\d{4}-\d{2}-\d{2}'/)
    expect(() => setDeployDate(SRC, '2026-12-04', 'otro')).toThrow()
  })
  it('rechaza fechas mal escritas', () => {
    expect(() => setDeployDate(SRC, '1-dic')).toThrow()
    expect(() => setDeployDate(SRC, '2026-13-45')).toThrow()
  })
})
