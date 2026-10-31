import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchSnapshot, loadSnapshot, readSnapshot, SNAPSHOT_KEY, SNAPSHOT_TTL_MS } from './investBridge.js'

const memStorage = () => {
  const m = new Map()
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }
}

function client({ rows = [], error = null, uid = 'u1' } = {}) {
  const eq = vi.fn(async () => ({ data: rows, error }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  return {
    from, eq,
    auth: { getSession: async () => ({ data: { session: uid ? { user: { id: uid } } : null } }) },
  }
}
const ok = (body) => ({ ok: true, json: async () => body })
function api(routes) {
  return vi.fn(async (url) => {
    for (const [re, body] of routes) if (re.test(String(url))) return body === null ? { ok: false, status: 502, json: async () => ({}) } : ok(body)
    return { ok: false, status: 404, json: async () => ({}) }
  })
}
const rows = [
  { ticker: 'AAPL', asset_type: 'Stock', shares: 10, avg_cost: 100, fx_at_cost: null },
  { ticker: 'SQM-B.SN', asset_type: 'Stock', shares: 10, avg_cost: 47000, fx_at_cost: null },
  { ticker: 'BTC-USD', asset_type: 'Crypto', shares: 1, avg_cost: 10000, fx_at_cost: null },
]
const QUOTES = {
  AAPL: { price: 120, changePct: 0, currency: 'USD', marketTime: 1000 },
  'SQM-B.SN': { price: 47000, changePct: 0, currency: 'CLP', marketTime: 900 },
  _errors: { X: 'ticker_not_found' },
}
const CRYPTO = { 'BTC-USD': { price: 20000, changePct: 0, currency: 'USD', marketTime: 1100 } }
const FX = { rates: { CLP: 940, MXN: 17 }, sources: { CLP: 'mindicador', MXN: 'fallback' }, updatedAt: '2026-10-30T12:00:00.000Z' }

describe('fetchSnapshot', () => {
  it('lee solo las filas de la cuenta de la sesión y valúa con precios y FX reales', async () => {
    const c = client({ rows })
    const f = api([[/api\/quote/, QUOTES], [/api\/crypto/, CRYPTO], [/fx-latam/, FX]])
    const s = await fetchSnapshot({ client: c, fetchImpl: f })
    expect(c.from).toHaveBeenCalledWith('portfolio_holdings')
    expect(c.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(s.status).toBe('live')
    expect(s.valueUsd).toBeCloseTo(1200 + 500 + 20000)
    expect(s.coingecko).toBe(true)
    expect(s.fx.rates).toEqual({ CLP: 940 })
    expect(s.fx.at).toBe(Date.parse(FX.updatedAt))
  })
  it('sin posiciones no llama a ninguna API de mercado', async () => {
    const f = api([])
    const s = await fetchSnapshot({ client: client(), fetchImpl: f })
    expect(s.status).toBe('empty')
    expect(f).not.toHaveBeenCalled()
  })
  it('caen los precios: valor al costo; cae el FX: lo local queda fuera', async () => {
    const onlyFx = api([[/fx-latam/, FX]])
    const a = await fetchSnapshot({ client: client({ rows }), fetchImpl: onlyFx })
    expect(a.status).toBe('cost')
    expect(a.valueUsd).toBeCloseTo(1000 + 500 + 10000)
    const nothing = api([])
    const b = await fetchSnapshot({ client: client({ rows }), fetchImpl: nothing })
    expect(b.status).toBe('cost')
    expect(b.excluded).toBe(1)
    expect(b.valueUsd).toBeCloseTo(1000 + 10000)
  })
  it('una tasa de respaldo no convierte: SN fuera aunque fx-latam responda', async () => {
    const fb = { rates: { CLP: 960 }, sources: { CLP: 'fallback' } }
    const s = await fetchSnapshot({ client: client({ rows }), fetchImpl: api([[/api\/quote/, QUOTES], [/api\/crypto/, CRYPTO], [/fx-latam/, fb]]) })
    expect(s.excluded).toBe(1)
  })
  it('ARS: pide el MEP de Invest solo si hay posiciones en pesos', async () => {
    const ars = [{ ticker: 'GGAL.BA', asset_type: 'Stock', shares: 1, avg_cost: 1200, fx_at_cost: null }]
    const f = api([[/api\/quote/, { 'GGAL.BA': { price: 2400, changePct: 0, currency: 'ARS' } }], [/fx-latam/, { rates: { ARS: 1000 } }], [/fx-ars/, { mep: { rate: 1200 } }]])
    const s = await fetchSnapshot({ client: client({ rows: ars }), fetchImpl: f })
    expect(s.valueUsd).toBeCloseTo(2)
    expect(s.fx.rates.ARS).toBe(1200)
    const us = api([[/api\/quote/, QUOTES], [/fx-latam/, FX]])
    await fetchSnapshot({ client: client({ rows: rows.slice(0, 1) }), fetchImpl: us })
    expect(us.mock.calls.some(c => String(c[0]).includes('fx-ars'))).toBe(false)
  })
  it('sin sesión o si la tabla falla, es un error y no un portafolio vacío', async () => {
    await expect(fetchSnapshot({ client: client({ uid: null }), fetchImpl: api([]) })).rejects.toThrow('session_required')
    await expect(fetchSnapshot({ client: client({ error: { message: 'x' } }), fetchImpl: api([]) })).rejects.toThrow('holdings_failed')
    await expect(fetchSnapshot({ client: null })).rejects.toThrow('auth_unavailable')
  })
})

describe('loadSnapshot', () => {
  let storage
  beforeEach(() => { storage = memStorage() })

  it('guarda el resultado y lo reutiliza durante 5 minutos', async () => {
    const f = api([[/api\/quote/, QUOTES], [/api\/crypto/, CRYPTO], [/fx-latam/, FX]])
    const c = client({ rows })
    await loadSnapshot({ storage, client: c, fetchImpl: f })
    expect(readSnapshot(storage).status).toBe('live')
    await loadSnapshot({ storage, client: c, fetchImpl: f })
    expect(c.from).toHaveBeenCalledTimes(1)
  })
  it('vencido o forzado vuelve a pedir', async () => {
    const c = client({ rows: [] })
    storage.setItem(SNAPSHOT_KEY, JSON.stringify({ v: 1, at: Date.now() - SNAPSHOT_TTL_MS - 1, status: 'empty' }))
    await loadSnapshot({ storage, client: c, fetchImpl: api([]) })
    await loadSnapshot({ storage, client: c, fetchImpl: api([]), force: true })
    expect(c.from).toHaveBeenCalledTimes(2)
  })
  it('dos pantallas a la vez hacen una sola carga', async () => {
    const c = client({ rows: [] })
    await Promise.all([loadSnapshot({ storage, client: c, fetchImpl: api([]) }), loadSnapshot({ storage, client: c, fetchImpl: api([]) })])
    expect(c.from).toHaveBeenCalledTimes(1)
  })
  it('un fallo no borra el último valor guardado', async () => {
    storage.setItem(SNAPSHOT_KEY, JSON.stringify({ v: 1, at: 1, status: 'live', valueUsd: 5 }))
    await expect(loadSnapshot({ storage, client: client({ error: {} }), fetchImpl: api([]) })).rejects.toThrow()
    expect(readSnapshot(storage).valueUsd).toBe(5)
  })
  it('ignora un valor guardado ilegible o de otra versión', () => {
    storage.setItem(SNAPSHOT_KEY, '{mal')
    expect(readSnapshot(storage)).toBeNull()
    storage.setItem(SNAPSHOT_KEY, JSON.stringify({ v: 0 }))
    expect(readSnapshot(storage)).toBeNull()
  })
})
