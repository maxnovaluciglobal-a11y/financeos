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

// SEG-1: las altas de Starter y demo pasan por lead-submit (no por /rest/v1/rpc).
describe('leads por lead-submit', () => {
  function gateway(body = { ok: true, id: null }) {
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => body }))
    vi.stubGlobal('fetch', f)
    return f
  }
  it('demo: POST a /functions/v1/lead-submit con rpc, args y token, sin apikey', async () => {
    const f = gateway()
    expect(await lv.registerDemoLead('a@b.co', 'Ana', true, 'es', 'tok')).toBe(true)
    const [url, init] = f.mock.calls[0]
    expect(url).toBe('https://p.supabase.co/functions/v1/lead-submit')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    const body = JSON.parse(init.body)
    expect(body.rpc).toBe('register_demo_lead')
    expect(body.args).toMatchObject({ p_email: 'a@b.co', p_nombre: 'Ana', p_consent_marketing: true })
    expect(body.turnstileToken).toBe('tok')
  })
  it('starter sin token (sin site key): mismo endpoint, sin turnstileToken', async () => {
    const f = gateway()
    expect(await lv.registerStarterLead('a@b.co', 'es', false)).toBe(true)
    const body = JSON.parse(f.mock.calls[0][1].body)
    expect(f.mock.calls[0][0]).toBe('https://p.supabase.co/functions/v1/lead-submit')
    expect(body.rpc).toBe('register_starter_lead')
    expect(body).not.toHaveProperty('turnstileToken')
  })
  it('un 403 captcha_failed devuelve false sin lanzar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403, json: async () => ({ ok: false, error: 'captcha_failed' }) })))
    expect(await lv.registerDemoLead('a@b.co', 'Ana', false, 'es', '')).toBe(false)
  })
})
