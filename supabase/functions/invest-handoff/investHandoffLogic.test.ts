import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { bearerToken, createHandoff, generateHandoffToken, getAuthUser } from './investHandoffLogic.ts'
import { corsHeaders, isAllowedOrigin } from './cors.ts'

const config = { supabaseUrl: 'https://auth.example', serviceRole: 'service-role-key' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

// Auth de mentira: /user valida el JWT y /admin/generate_link emite el enlace.
function auth({ user = { id: 'u1', email: 'ana@example.com' } as unknown, link = { hashed_token: 'hash-1' } as unknown, userStatus = 200, linkStatus = 200 } = {}) {
  return vi.fn(async (url: string | URL | Request) => {
    const u = String(url)
    if (u.endsWith('/auth/v1/user')) return json(user, userStatus)
    if (u.endsWith('/auth/v1/admin/generate_link')) return json(link, linkStatus)
    return json({}, 404)
  }) as unknown as typeof fetch
}

describe('bearerToken', () => {
  it('saca el token del encabezado y rechaza lo demás', () => {
    expect(bearerToken('Bearer abc')).toBe('abc')
    expect(bearerToken('bearer abc')).toBe('abc')
    expect(bearerToken('Basic abc')).toBeNull()
    expect(bearerToken(null)).toBeNull()
  })
})

describe('getAuthUser', () => {
  it('valida el JWT contra Auth', async () => {
    const f = auth()
    expect(await getAuthUser('jwt', config, f)).toEqual({ id: 'u1', email: 'ana@example.com' })
    const [, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer jwt')
  })
  it('token vencido o Auth caído: null', async () => {
    expect(await getAuthUser('jwt', config, auth({ userStatus: 401 }))).toBeNull()
    expect(await getAuthUser('jwt', config, (async () => { throw new Error('red') }) as unknown as typeof fetch)).toBeNull()
  })
})

describe('generateHandoffToken', () => {
  it('pide un magic link con la clave de servicio y sin redirect', async () => {
    const f = auth()
    expect(await generateHandoffToken('ana@example.com', config, f)).toBe('hash-1')
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(String(url)).toBe('https://auth.example/auth/v1/admin/generate_link')
    expect(init.headers.Authorization).toBe('Bearer service-role-key')
    expect(JSON.parse(init.body)).toEqual({ type: 'magiclink', email: 'ana@example.com' })
  })
  it('acepta hashed_token dentro de properties (forma de supabase-js)', async () => {
    expect(await generateHandoffToken('a@b.c', config, auth({ link: { properties: { hashed_token: 'hash-2' } } }))).toBe('hash-2')
  })
  it('sin token o con error: null', async () => {
    expect(await generateHandoffToken('a@b.c', config, auth({ link: {} }))).toBeNull()
    expect(await generateHandoffToken('a@b.c', config, auth({ linkStatus: 500 }))).toBeNull()
  })
})

describe('createHandoff', () => {
  it('sesión válida: devuelve solo token_hash y uid', async () => {
    const r = await createHandoff('Bearer jwt', config, auth())
    expect(r).toEqual({ status: 200, body: { ok: true, token_hash: 'hash-1', uid: 'u1' } })
  })
  it('sin sesión o con token inválido: 401 y no se genera ningún enlace', async () => {
    const f = auth({ userStatus: 401 })
    expect((await createHandoff('Bearer malo', config, f)).status).toBe(401)
    expect((await createHandoff(null, config, f)).status).toBe(401)
    const urls = (f as unknown as ReturnType<typeof vi.fn>).mock.calls.map(c => String(c[0]))
    expect(urls.some(u => u.includes('generate_link'))).toBe(false)
  })
  it('una cuenta sin correo no tiene magic link: 422', async () => {
    const r = await createHandoff('Bearer jwt', config, auth({ user: { id: 'u1' } }))
    expect(r).toEqual({ status: 422, body: { ok: false, error: 'no_email' } })
  })
  it('Auth no emite el enlace: 502 sin datos del error', async () => {
    const r = await createHandoff('Bearer jwt', config, auth({ linkStatus: 500 }))
    expect(r).toEqual({ status: 502, body: { ok: false, error: 'link_failed' } })
  })
})

describe('CORS y origen', () => {
  it('la app y el desarrollo local pasan; el demo y lo ajeno, no', () => {
    expect(isAllowedOrigin('https://app.moyiq.app')).toBe(true)
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true)
    expect(isAllowedOrigin('https://demo.moyiq.app')).toBe(false)
    expect(isAllowedOrigin('https://evil.example')).toBe(false)
    expect(isAllowedOrigin(null)).toBe(false)
  })
  it('un origen ajeno no recibe su propio origen en el CORS', () => {
    expect(corsHeaders('https://evil.example')['Access-Control-Allow-Origin']).toBe('https://app.moyiq.app')
  })
})

describe('index.ts', () => {
  const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
  it('la respuesta no se cachea y el token no llega a un log', () => {
    expect(src).toContain('"Cache-Control": "no-store"')
    expect(src).not.toMatch(/console\.\w+\([^)]*(token|result\.body|hashed)/)
  })
})
