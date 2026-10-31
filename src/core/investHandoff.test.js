import { describe, it, expect, vi } from 'vitest'
import { buildInvestUrl, openInvest, requestHandoff } from './investHandoff.js'

const reply = (body, status = 200) => ({ ok: status < 400, status, json: async () => body })
const session = (token = 'jwt') => ({ auth: { getSession: async () => ({ data: { session: token ? { access_token: token } : null } }) } })
const good = () => vi.fn(async () => reply({ ok: true, token_hash: 'hash', uid: 'u1' }))

describe('requestHandoff', () => {
  it('manda el JWT y nunca un refresh token', async () => {
    const f = good()
    expect(await requestHandoff('jwt', f)).toEqual({ ok: true, tokenHash: 'hash', uid: 'u1' })
    const [url, init] = f.mock.calls[0]
    expect(String(url)).toMatch(/\/functions\/v1\/invest-handoff$/)
    expect(init.headers.Authorization).toBe('Bearer jwt')
    expect(init.body).toBe('{}')
  })
  it('sin sesión no llama a la función', async () => {
    const f = good()
    expect(await requestHandoff(null, f)).toEqual({ ok: false, error: 'session_required' })
    expect(f).not.toHaveBeenCalled()
  })
  it('traduce los errores', async () => {
    expect(await requestHandoff('j', async () => reply({ ok: false, error: 'link_failed' }, 502))).toEqual({ ok: false, error: 'link_failed' })
    expect(await requestHandoff('j', async () => { throw new Error('red') })).toEqual({ ok: false, error: 'network' })
    expect((await requestHandoff('j', async () => ({ ok: false, status: 500, json: async () => { throw new Error() } }))).error).toBe('http_500')
    expect(await requestHandoff('j', async () => reply({ ok: true }))).toMatchObject({ ok: false })
  })
})

describe('buildInvestUrl', () => {
  it('todo va en el fragmento', () => {
    const url = new URL(buildInvestUrl({ tokenHash: 'h/1', uid: 'u1', aporte: { amount: 150, ccy: 'CLP', n: 2, usd: 0.16 } }))
    expect(url.origin + url.pathname).toBe('https://invest.moyiq.app/app/')
    expect(url.search).toBe('')
    const f = new URLSearchParams(url.hash.slice(1))
    expect(Object.fromEntries(f)).toEqual({ handoff: 'h/1', uid: 'u1', aporte: '150', ccy: 'CLP', n: '2', usd: '0.16' })
  })
  it('sin handoff abre Invest igual, sin token', () => {
    expect(buildInvestUrl()).toBe('https://invest.moyiq.app/app/')
    expect(buildInvestUrl({ aporte: { amount: 1, n: 1, usd: null } })).toBe('https://invest.moyiq.app/app/#aporte=1&n=1')
  })
})

describe('openInvest', () => {
  const fakeWin = (tab) => ({ open: vi.fn(() => tab), location: { assign: vi.fn() } })

  it('abre la pestaña antes de esperar y le corta el opener', async () => {
    const tab = { location: {}, opener: 'app' }
    const win = fakeWin(tab)
    let openedBeforeFetch = false
    const fetchImpl = vi.fn(async () => { openedBeforeFetch = win.open.mock.calls.length === 1; return reply({ ok: true, token_hash: 'hash', uid: 'u1' }) })
    const res = await openInvest({ win, client: session(), fetchImpl })
    expect(openedBeforeFetch).toBe(true)
    expect(tab.opener).toBeNull()
    expect(tab.location.href).toBe('https://invest.moyiq.app/app/#handoff=hash&uid=u1')
    expect(res.ok).toBe(true)
  })
  it('falla el handoff: Invest abre sin token y pide iniciar sesión', async () => {
    const tab = { location: {} }
    await openInvest({ win: fakeWin(tab), client: session(), fetchImpl: async () => reply({ ok: false, error: 'link_failed' }, 502) })
    expect(tab.location.href).toBe('https://invest.moyiq.app/app/')
  })
  it('sin sesión tampoco se queda en blanco', async () => {
    const tab = { location: {} }
    const f = good()
    await openInvest({ win: fakeWin(tab), client: session(null), fetchImpl: f })
    expect(f).not.toHaveBeenCalled()
    expect(tab.location.href).toBe('https://invest.moyiq.app/app/')
  })
  it('ventana bloqueada: navega en la misma pestaña', async () => {
    const win = fakeWin(null)
    await openInvest({ win, client: session(), fetchImpl: good() })
    expect(win.location.assign).toHaveBeenCalledWith('https://invest.moyiq.app/app/#handoff=hash&uid=u1')
  })
  it('los aportes viajan con el handoff', async () => {
    const tab = { location: {} }
    await openInvest({ aporte: { amount: 150, ccy: 'CLP', n: 2, usd: null }, win: fakeWin(tab), client: session(), fetchImpl: good() })
    expect(tab.location.href).toContain('&aporte=150&ccy=CLP&n=2')
  })
})
