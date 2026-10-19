import { describe, it, expect, vi, afterEach } from 'vitest'
import { bearerToken, isConfirmed, getAuthUser, deleteAccount, followupMessage, CONFIRM_WORD } from './deleteAccountLogic.ts'
import { corsHeaders, ALLOWED_ORIGINS, FALLBACK_ORIGIN } from './cors.ts'

const CONFIG = { supabaseUrl: 'https://proj.supabase.co', serviceRole: 'srv-key' }
const USER = { id: '11111111-2222-3333-4444-555555555555', email: 'ana@ejemplo.com' }

afterEach(() => { vi.unstubAllGlobals() })

function mockFetch(handlers: Array<(url: string, init: RequestInit) => Response | Promise<Response>>) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  let i = 0
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init })
    const h = handlers[Math.min(i++, handlers.length - 1)]
    return h(url, init)
  }))
  return calls
}
const ok = (body: unknown, status = 200) => () => new Response(JSON.stringify(body), { status })

describe('delete-account (C-22): confirmación y sesión', () => {
  it('exige la palabra de confirmación exacta en el body', () => {
    expect(isConfirmed({ confirm: CONFIRM_WORD })).toBe(true)
    for (const b of [null, undefined, {}, { confirm: 'delete' }, { confirm: true }, 'DELETE', { confirm: 'BORRAR' }]) {
      expect(isConfirmed(b)).toBe(false)
    }
  })
  it('bearerToken solo acepta "Bearer <token>"', () => {
    expect(bearerToken('Bearer a.b.c')).toBe('a.b.c')
    for (const h of [null, undefined, '', 'Basic x', 'Bearer', 'Bearer a b']) expect(bearerToken(h as any)).toBeNull()
  })
  it('getAuthUser toma id y email del token verificado por Auth', async () => {
    const calls = mockFetch([ok({ id: USER.id, email: USER.email })])
    expect(await getAuthUser('tok', CONFIG)).toEqual(USER)
    expect(calls[0].url).toBe('https://proj.supabase.co/auth/v1/user')
    expect((calls[0].init.headers as any).Authorization).toBe('Bearer tok')
  })
  it('getAuthUser devuelve null con token inválido, sin id o con error de red', async () => {
    mockFetch([ok({ msg: 'bad jwt' }, 401)])
    expect(await getAuthUser('tok', CONFIG)).toBeNull()
    mockFetch([ok({ email: 'x@y.com' })])
    expect(await getAuthUser('tok', CONFIG)).toBeNull()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('net') }))
    expect(await getAuthUser('tok', CONFIG)).toBeNull()
    expect(await getAuthUser('', CONFIG)).toBeNull()
  })
})

describe('delete-account (C-22): borrado', () => {
  it('borra los datos con el id y el email de la sesión y después auth.users', async () => {
    const calls = mockFetch([
      ok({ ok: true, rows_deleted: { licenses: 1 }, stripe_subscriptions: [], newsletter_followup: false }),
      ok({}, 200),
    ])
    const r = await deleteAccount(USER, CONFIG)
    expect(r).toEqual({ ok: true, status: 200, stripeSubscriptions: [], newsletterFollowup: false })
    expect(calls[0].url).toBe('https://proj.supabase.co/rest/v1/rpc/delete_account_data')
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ p_user_id: USER.id, p_email: USER.email })
    expect(calls[1].url).toBe(`https://proj.supabase.co/auth/v1/admin/users/${USER.id}`)
    expect(calls[1].init.method).toBe('DELETE')
    expect((calls[1].init.headers as any).Authorization).toBe('Bearer srv-key')
  })
  it('si el borrado de datos falla, no toca auth.users', async () => {
    for (const first of [ok({}, 500), ok({ ok: false, error: 'bad_args' }), () => { throw new Error('net') }]) {
      const calls = mockFetch([first as any, ok({})])
      const r = await deleteAccount(USER, CONFIG)
      expect(r).toMatchObject({ ok: false, status: 503, error: 'data_delete_failed' })
      expect(calls).toHaveLength(1)
    }
  })
  it('auth.users ya borrado (404) cuenta como hecho; otro error se informa', async () => {
    mockFetch([ok({ ok: true }), ok({}, 404)])
    expect((await deleteAccount(USER, CONFIG)).ok).toBe(true)
    mockFetch([ok({ ok: true }), ok({}, 500)])
    expect(await deleteAccount(USER, CONFIG)).toMatchObject({ ok: false, error: 'auth_delete_failed' })
  })
  it('devuelve las suscripciones de Stripe activas que hay que cancelar', async () => {
    mockFetch([ok({ ok: true, stripe_subscriptions: ['sub_123', '', null], newsletter_followup: true }), ok({})])
    const r = await deleteAccount(USER, CONFIG)
    expect(r.stripeSubscriptions).toEqual(['sub_123'])
    expect(r.newsletterFollowup).toBe(true)
  })
})

describe('delete-account (C-22): aviso a soporte', () => {
  it('sin pasos manuales no hay aviso', () => {
    expect(followupMessage({ ok: true, status: 200, stripeSubscriptions: [], newsletterFollowup: false }, USER.email)).toBeNull()
    expect(followupMessage({ ok: false, status: 503, stripeSubscriptions: ['sub_1'] }, USER.email)).toBeNull()
  })
  it('Stripe pendiente: lleva el id de la suscripción y no el email', () => {
    const m = followupMessage({ ok: true, status: 200, stripeSubscriptions: ['sub_9'], newsletterFollowup: false }, USER.email)!
    expect(m.text).toContain('sub_9')
    expect(m.text).not.toContain(USER.email)
  })
  it('newsletter pendiente: lleva el email para encontrar el contacto', () => {
    const m = followupMessage({ ok: true, status: 200, stripeSubscriptions: [], newsletterFollowup: true }, USER.email)!
    expect(m.text).toContain(USER.email)
  })
})

describe('CORS de delete-account', () => {
  it('solo la app (no el demo) y los encabezados del navegador', () => {
    for (const o of ALLOWED_ORIGINS) expect(corsHeaders(o)['Access-Control-Allow-Origin']).toBe(o)
    expect(ALLOWED_ORIGINS).not.toContain('https://demo.moyiq.app')
    expect(corsHeaders('https://evil.example')['Access-Control-Allow-Origin']).toBe(FALLBACK_ORIGIN)
    const allowed = corsHeaders(null)['Access-Control-Allow-Headers'].split(',').map((h) => h.trim())
    for (const h of ['authorization', 'apikey', 'content-type']) expect(allowed).toContain(h)
  })
})
