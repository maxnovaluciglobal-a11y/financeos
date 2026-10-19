// licenseValidator (auditoría 360: ING-3, C-21): formato, hash de la cuenta,
// caché y modo sin red, con fetch simulado.
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mem = new Map()
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)) },
  removeItem: (k) => { mem.delete(k) },
  key: (i) => [...mem.keys()][i] ?? null,
  get length() { return mem.size },
  clear: () => mem.clear(),
}
const del = vi.fn(async () => ({ error: null }))
vi.mock('../core/authClient.js', () => ({ authClient: { from: () => ({ delete: () => ({ eq: del }) }) } }))
vi.stubEnv('VITE_SUPABASE_URL', 'https://p.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon')

const lv = await import('./licenseValidator.js')
const HASH = 'c9ad25682b492de062fd50b3f0be43c1c53bffb62e785005129af6639bba35db' // sha256('FNOS-ABCD-EFGH-IJKL')

function server(valid, plan = 'pro') {
  const f = vi.fn(async (_url, init) => ({ ok: true, json: async () => ({ valid, plan, p: JSON.parse(init.body).p_key }) }))
  vi.stubGlobal('fetch', f)
  return f
}

beforeEach(() => { mem.clear(); vi.unstubAllGlobals() })

describe('formato de la licencia', () => {
  it('acepta FNOS-XXXX-XXXX-XXXX (normaliza) y el hash de 64 hex de la cuenta', () => {
    expect(lv.normalizeLicenseInput(' fnos-abcd-efgh-ijkl ')).toBe('FNOS-ABCD-EFGH-IJKL')
    expect(lv.normalizeLicenseInput(HASH.toUpperCase())).toBe(HASH)
    for (const bad of ['', 'FNOS-ABCD', 'ABCD-EFGH-IJKL-MNOP', 'x'.repeat(64), null]) expect(lv.normalizeLicenseInput(bad)).toBeNull()
    expect(lv.isLicenseHash(HASH)).toBe(true)
    expect(lv.isLicenseHash('FNOS-ABCD-EFGH-IJKL')).toBe(false)
  })
})

describe('validateLicense', () => {
  it('manda al servidor el hash, nunca la clave, y guarda la caché', async () => {
    const f = server(true)
    expect(await lv.validateLicense('fnos-abcd-efgh-ijkl')).toBe(true)
    expect(JSON.parse(f.mock.calls[0][1].body).p_key).toBe(HASH)
    expect(lv.getLicenseKey()).toBe('FNOS-ABCD-EFGH-IJKL')
    expect(lv.getLicensePlan()).toBe('pro')
  })
  it('con el hash de la cuenta (C-39/C-21) valida igual y guarda el hash', async () => {
    const f = server(true)
    expect(await lv.validateLicense(HASH)).toBe(true)
    expect(JSON.parse(f.mock.calls[0][1].body).p_key).toBe(HASH)
    expect(lv.getLicenseKey()).toBe(HASH)
  })
  it('clave inválida según el servidor: false y sin caché', async () => {
    server(false)
    expect(await lv.validateLicense('FNOS-ABCD-EFGH-IJKL')).toBe(false)
    expect(lv.getLicenseKey()).toBe('')
  })
  it('sin red solo acepta la clave ya activada', async () => {
    server(true)
    await lv.validateLicense('FNOS-ABCD-EFGH-IJKL')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(await lv.validateLicense('FNOS-ABCD-EFGH-IJKL')).toBe(true)
    expect(await lv.validateLicense('FNOS-ZZZZ-ZZZZ-ZZZZ')).toBe(false)
  })
  it('isLicenseActive desactiva una licencia vencida sin llamar al servidor', () => {
    localStorage.setItem('fnos_license_v2', JSON.stringify({ key: 'FNOS-ABCD-EFGH-IJKL', plan: 'pro', exp: Date.now() - 1000, ts: Date.now() }))
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    expect(lv.isLicenseActive()).toBe(false)
    expect(lv.getLicenseKey()).toBe('')
    expect(f).not.toHaveBeenCalled()
  })
})

describe('entitlement de la cuenta', () => {
  it('clearServerEntitlement borra la fila de la cuenta', async () => {
    expect(await lv.clearServerEntitlement('uid-1')).toBe(true)
    expect(del).toHaveBeenCalledWith('user_id', 'uid-1')
  })
})
