import { describe, it, expect, vi } from 'vitest'
import { createInvestApi, normChangePct, normalizeQuote, normTicker, TTL, INVEST_API_ORIGIN } from './investApi.js'

const json = (body, ok = true) => ({ ok, json: async () => body })
function fakeFetch(handler) {
  const calls = []
  const fn = vi.fn(async (url) => { calls.push(String(url)); return handler(new URL(String(url))) })
  fn.calls = calls
  return fn
}
const quoteBody = (url) => {
  const out = {}
  for (const t of url.searchParams.get('ticker').split(',')) out[t] = { ticker: t, price: 100, changePct: 0.0123, currency: 'USD' }
  return json(out)
}

describe('normalización', () => {
  it('changePct: /api/quote en fracción, /api/marketbar en puntos', () => {
    expect(normChangePct(0.0123)).toBe(0.0123)
    expect(normChangePct(1.23, 'points')).toBeCloseTo(0.0123, 12)
    expect(normChangePct(null)).toBeNull()
    expect(normChangePct('x')).toBeNull()
  })
  it('conserva el horario de la sesión (tradingStart/tradingEnd) para "Mercado cerrado"', () => {
    const q = normalizeQuote({ price: 190, marketTime: 1763755200000, tradingStart: 1763735400000, tradingEnd: 1763758800000 }, 'AAPL')
    expect(q).toMatchObject({ tradingStart: 1763735400000, tradingEnd: 1763758800000 })
    expect(normalizeQuote({ price: 1 }).tradingStart).toBeNull()
  })
  it('una cotización sin precio no existe', () => {
    expect(normalizeQuote({ price: 0 })).toBeNull()
    expect(normalizeQuote({ price: 10, changePct: 0.01 }, 'aapl')).toMatchObject({ ticker: 'AAPL', price: 10, changePct: 0.01 })
  })
  it('normTicker valida como la API', () => {
    expect(normTicker(' aapl ')).toBe('AAPL')
    expect(normTicker('^GSPC')).toBe('^GSPC')
    expect(normTicker('BRK-B')).toBe('BRK-B')
    expect(normTicker('a b')).toBeNull()
    expect(normTicker('<script>')).toBeNull()
    expect(normTicker('X'.repeat(16))).toBeNull()
  })
})

describe('quotes: lotes, caché en memoria y pedidos en vuelo', () => {
  it('pide en lotes de 10 y sin repetir tickers', async () => {
    const f = fakeFetch(quoteBody)
    const api = createInvestApi({ fetchImpl: f })
    const list = Array.from({ length: 23 }, (_, i) => `T${i}`)
    const r = await api.quotes([...list, 'T1', 't2', 'mal ticker'])
    expect(Object.keys(r)).toHaveLength(23)
    expect(f.calls).toHaveLength(3)
    expect(f.calls[0].startsWith(`${INVEST_API_ORIGIN}/api/quote?ticker=`)).toBe(true)
    expect(f.calls.every(u => new URL(u).searchParams.get('ticker').split(',').length <= 10)).toBe(true)
  })
  it('lo fresco sale de la caché; vencido el TTL se vuelve a pedir', async () => {
    let t = 1000
    const f = fakeFetch(quoteBody)
    const api = createInvestApi({ fetchImpl: f, now: () => t })
    await api.quotes(['AAPL'])
    await api.quotes(['AAPL'])
    expect(f.calls).toHaveLength(1)
    t += TTL.quote + 1
    await api.quotes(['AAPL'])
    expect(f.calls).toHaveLength(2)
  })
  it('dos pedidos iguales a la vez comparten la misma llamada', async () => {
    const f = fakeFetch(quoteBody)
    const api = createInvestApi({ fetchImpl: f })
    const [a, b] = await Promise.all([api.quotes(['MSFT']), api.quotes(['MSFT'])])
    expect(f.calls).toHaveLength(1)
    expect(a.MSFT.price).toBe(100)
    expect(b.MSFT.price).toBe(100)
  })
  it('un fallo no se cachea y devuelve vacío', async () => {
    let fail = true
    const f = fakeFetch((u) => (fail ? json({}, false) : quoteBody(u)))
    const api = createInvestApi({ fetchImpl: f })
    expect(await api.quotes(['AAPL'])).toEqual({})
    fail = false
    expect((await api.quotes(['AAPL'])).AAPL.price).toBe(100)
  })
  it('la red caída o el tope de tiempo devuelven vacío sin romper', async () => {
    const api = createInvestApi({ fetchImpl: async () => { throw new Error('offline') } })
    expect(await api.quotes(['AAPL'])).toEqual({})
    expect(await api.quote('AAPL')).toBeNull()
  })
  it('crypto va por /api/crypto en lotes de 30', async () => {
    const f = fakeFetch((u) => {
      const out = {}
      for (const s of u.searchParams.get('symbols').split(',')) out[s] = { price: 2, changePct: -0.05 }
      return json(out)
    })
    const api = createInvestApi({ fetchImpl: f })
    const r = await api.crypto(Array.from({ length: 31 }, (_, i) => `C${i}-USD`))
    expect(Object.keys(r)).toHaveLength(31)
    expect(f.calls).toHaveLength(2)
    expect(f.calls[0]).toContain('/api/crypto?symbols=')
  })
})

describe('marketbar, history, news y tipos de cambio', () => {
  it('marketbar pasa changePct de puntos a fracción', async () => {
    const api = createInvestApi({ fetchImpl: async () => json({ items: [{ sym: '^GSPC', label: 'S&P 500', price: 6000, change: 60, changePct: 1, spark: [1, '2', 'x'] }], missing: [] }) })
    const r = await api.marketbar()
    expect(r.items[0].changePct).toBeCloseTo(0.01, 12)
    expect(r.items[0].spark).toEqual([1, 2])
  })
  it('history agrega ts en segundos UTC y descarta cierres no positivos', async () => {
    const f = fakeFetch(() => json({ data: [{ date: '2026-11-18', open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }, { date: '2026-11-19', close: 0 }] }))
    const api = createInvestApi({ fetchImpl: f })
    const h = await api.history('aapl', '1y')
    expect(h).toEqual([{ date: '2026-11-18', ts: Date.UTC(2026, 10, 18) / 1000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }])
    expect(f.calls[0]).toContain('/api/history?ticker=AAPL&range=1y&interval=1d')
    expect(await api.history('AAPL', '3y')).toBeNull()
    expect(f.calls).toHaveLength(1)
  })
  it('news sin tickers no manda tickers en la URL', async () => {
    const f = fakeFetch(() => json({ items: [{ title: 'x', link: 'https://a.b' }, { title: 'y', link: 'javascript:alert(1)' }] }))
    const api = createInvestApi({ fetchImpl: f })
    const r = await api.news()
    expect(f.calls[0]).toBe(`${INVEST_API_ORIGIN}/api/news`)
    expect(r.items).toHaveLength(1)
    await api.news({ tickers: ['aapl', 'AAPL', 'bad ticker'] })
    expect(f.calls[1]).toBe(`${INVEST_API_ORIGIN}/api/news?tickers=AAPL`)
  })
  it('fundamentals en lotes de 10 y fx-latam / fx-ars cacheados', async () => {
    const f = fakeFetch((u) => {
      if (u.pathname === '/api/fundamentals') return json(Object.fromEntries(u.searchParams.get('ticker').split(',').map(t => [t, { peRatio: 10 }])))
      return json({ rates: { CLP: 950 } })
    })
    const api = createInvestApi({ fetchImpl: f })
    const fu = await api.fundamentals(Array.from({ length: 12 }, (_, i) => `F${i}`))
    expect(Object.keys(fu)).toHaveLength(12)
    await api.fxLatam(); await api.fxLatam()
    expect(f.calls.filter(u => u.includes('fx-latam'))).toHaveLength(1)
    expect(api.stats().hits).toBeGreaterThan(0)
    api.clear()
    expect(api.stats().cached).toBe(0)
  })
})
