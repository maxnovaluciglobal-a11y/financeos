// El demo usa datos reales del mercado con respaldo de ejemplo pieza por pieza
// (demo/demoMarketApi.js). Fuente "en vivo" falsa: nada sale a la red.
import { describe, it, expect, vi } from 'vitest'
import '../pages/Investments/i18n/investStrings.js'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { translate } from '../i18n/translate.js'
import { createDemoMarketApi, createSampleMarketApi, isSample, keepRealQuotes, mergePrices, sampleTickers } from './demoMarketApi.js'
import { keepsReal } from '../pages/Investments/market/useMarket.js'
import { sampleEarnings, sampleFundamentals } from './demoInvestAsset.js'
import { demoInvestRows } from './demoInvest.js'
import { demoMarketBar } from './demoMarket.js'
import { anchorDemoAlerts } from '../pages/Investments/follow/useFollowData.js'
import { demoAlerts } from './demoInvestFollow.js'
import { demoMarketData, demoState, loadEarningsWith } from '../pages/Investments/market/useMarket.js'
import { MarketView, samplePart } from '../pages/Investments/market/Market.jsx'
import { queuePlanAporte, takePlanQueue } from '../utils/investNav.js'

const t = (k, v) => translate('es', k, v)
const NOW = Date.parse('2026-11-23T15:00:00Z')

// Respuestas reales de ejemplo (forma de investApi).
const BAR = { items: [{ sym: '^GSPC', price: 7237.17, changePct: 0.047, spark: [] }, { sym: '^VIX', price: 26.62, changePct: -0.1, spark: [] }], missing: [], fetchedAt: NOW }
const ROWS = [{ date: '2026-11-20', ts: 1795132800, close: 760 }, { date: '2026-11-21', ts: 1795219200, close: 765 }]
function fakeLive(over = {}) {
  const calls = []
  const rec = (name, fn) => (...a) => { calls.push([name, ...a]); return Promise.resolve(fn(...a)) }
  return {
    calls,
    api: {
      quotes: rec('quotes', (list) => Object.fromEntries(list.map(tk => [tk, { ticker: tk, price: 663.91, changePct: 0.01, currency: 'USD', source: 'yahoo' }]))),
      crypto: rec('crypto', (list) => Object.fromEntries(list.map(tk => [tk, { ticker: tk, price: 61412, changePct: 0.007, currency: 'USD', source: 'coingecko' }]))),
      history: rec('history', () => ROWS),
      marketbar: rec('marketbar', () => BAR),
      news: rec('news', () => ({ items: [{ id: 1, title: 'Real headline', link: 'https://finance.yahoo.com/x', cat: 'Macro' }], fetchedAt: null })),
      earnings: rec('earnings', (tk) => ({ ticker: tk, nextDate: '2027-01-27', source: 'finnhub' })),
      fundamentals: rec('fundamentals', (list) => Object.fromEntries(list.map(tk => [tk, { dividendYield: 0.01, source: 'fmp' }]))),
      fxLatam: rec('fxLatam', () => ({ rates: { CLP: 1017 }, sources: { CLP: 'mindicador' } })),
      fxArs: rec('fxArs', () => ({ mep: { rate: 1743 }, oficial: { rate: 1600 } })),
      forget: () => {},
      ...over,
    },
  }
}
const down = () => Promise.resolve(null)
const empty = () => Promise.resolve({})

describe('datos reales del demo con respaldo de ejemplo', () => {
  it('con la API respondiendo, todo es real: un pedido por llamada y nada marcado de ejemplo', async () => {
    const { api: live, calls } = fakeLive()
    const api = createDemoMarketApi({ live })
    const q = await api.quotes(['VOO', 'AAPL'])
    expect(q.VOO.price).toBe(663.91)
    expect(isSample(q.VOO)).toBe(false)
    const bar = await api.marketbar()
    expect(bar.items.find(x => x.sym === '^VIX').price).toBe(26.62)
    expect(isSample(bar)).toBe(false)
    expect(isSample(await api.history('SPY', '2y'))).toBe(false)
    expect(isSample(await api.fxLatam())).toBe(false)
    // El envoltorio no multiplica pedidos: uno por llamada (la caché es la de investApi).
    expect(calls.map(c => c[0])).toEqual(['quotes', 'marketbar', 'history', 'fxLatam'])
  })

  it('si un pedido falla, ESA pieza sale del ejemplo y queda marcada', async () => {
    const { api: live } = fakeLive({ marketbar: down, history: down, fxLatam: down, news: down })
    const api = createDemoMarketApi({ live })
    const bar = await api.marketbar()
    expect(isSample(bar)).toBe(true)
    expect(bar.items.find(x => x.sym === '^VIX').price).toBe(demoMarketBar().items.find(x => x.sym === '^VIX').price)
    const rows = await api.history('SPY', '2y')
    expect(rows.length).toBeGreaterThan(400)
    expect(isSample(rows)).toBe(true)
    expect(isSample(await api.fxLatam())).toBe(true)
    expect(isSample(await api.news())).toBe(true)
    // Lo que sí respondió sigue siendo real.
    expect(isSample(await api.fxArs())).toBe(false)
  })

  it('cotizaciones: lote sin ningún precio → ejemplo solo para los símbolos del demo; con alguno → nada inventado', async () => {
    const api = createDemoMarketApi({ live: fakeLive({ quotes: empty }).api })
    const q = await api.quotes(['VOO', 'ZZZZ'])
    expect(q.VOO.price).toBe(demoInvestRows().find(r => r.t === 'VOO').price)
    expect(q.VOO.sample).toBe(true)
    expect(q.ZZZZ).toBeUndefined()
    expect(await api.quote('ZZZZ')).toBeNull()
    const partial = createDemoMarketApi({ live: fakeLive({ quotes: () => Promise.resolve({ VOO: { ticker: 'VOO', price: 600 } }) }).api })
    const p = await partial.quotes(['VOO', 'AAPL'])
    expect(p).toEqual({ VOO: { ticker: 'VOO', price: 600 } })
  })

  it('resultados: sin respaldo por ticker; si NINGUNO responde, todos de ejemplo y rotulados', async () => {
    const ok = createDemoMarketApi({ live: fakeLive({ earnings: (tk) => Promise.resolve(tk === 'AAPL' ? { nextDate: '2026-12-01', source: 'finnhub' } : null) }).api })
    const fallback = vi.fn(() => ({ nextDate: '2026-12-05', source: 'sample' }))
    const mixed = await loadEarningsWith(ok, demoMarketData, () => NOW, { fallback })
    expect(mixed.sample).toBe(false)
    expect(fallback).not.toHaveBeenCalled()
    expect(mixed.earn.result.failed).toBe(2)
    const none = createDemoMarketApi({ live: fakeLive({ earnings: down }).api })
    const all = await loadEarningsWith(none, demoMarketData, () => NOW, { fallback })
    expect(all.sample).toBe(true)
    expect(all.earn.result.sources).toEqual(['sample'])
  })

  it('la fuente de ejemplo no sale a la red y solo conoce los símbolos del demo', () => {
    const s = createSampleMarketApi()
    expect([...sampleTickers()].sort()).toEqual(['AAPL', 'BTC-USD', 'MSFT', 'NVDA', 'QQQ', 'SPY', 'VOO'])
    expect(s.history('TSLA')).toBeNull()
    expect(isSample(s.history('VOO', '1y'))).toBe(true)
  })
})

describe('pantallas del demo con datos reales', () => {
  const base = { ...demoState(t, NOW), offline: false, refreshing: false, refresh: () => {} }
  it('Mercado: el aviso de datos reales solo si todo es real; la pieza que cayó dice Datos de ejemplo', () => {
    const parts = { bar: false, spy: false, earn: false, news: true, fx: false }
    const m = { ...base, demo: true, sample: true, parts }
    expect(samplePart(m, 'bar')).toBe(false)
    expect(samplePart(m, 'news')).toBe(true)
    const html = renderToStaticMarkup(h(MarketView, { t, lang: 'es', m, now: NOW }))
    expect(html).not.toContain(t('invest.mkt.demoLive'))
    expect(html).toContain(t('invest.mkt.news.footSample'))
    expect(html).not.toContain('Datos de ejemplo ·') // la cinta es real
    const allLive = renderToStaticMarkup(h(MarketView, { t, lang: 'es', m: { ...base, demo: true, sample: false, parts: { ...parts, news: false } }, now: NOW }))
    expect(allLive).toContain(t('invest.mkt.demoLive'))
    expect(allLive).not.toContain(t('invest.mkt.sample'))
    expect(allLive).not.toContain(t('invest.mkt.sources.sample'))
  })
  it('Siguiendo: las alertas de ejemplo se acomodan al primer precio real (y no a uno de ejemplo)', () => {
    const al = demoAlerts(NOW)
    const real = anchorDemoAlerts(al, { QQQ: { price: 600 }, SPY: { price: 700 } })
    expect(real.find(a => a.id === 'demo-al-1').threshold).toBeCloseTo(630, -1)
    expect(real.find(a => a.id === 'demo-al-2').threshold).toBeCloseTo(665, -1)
    expect(anchorDemoAlerts(real, { QQQ: { price: 900 } })).toEqual(real)
    expect(anchorDemoAlerts(al, { QQQ: { price: 600, sample: true } })).toEqual(al)
  })
  it('Resumen → Planificar: Repartir abre Aportes con el monto, una sola vez', () => {
    queuePlanAporte(750)
    expect(takePlanQueue()).toEqual({ sub: 'aportes', usd: 750 })
    expect(takePlanQueue()).toBeNull()
  })
})

describe('nunca mezclar ejemplo y realidad', () => {
  const real = (p) => ({ price: p, changePct: 0, source: 'yahoo' })
  const fake = (p) => ({ price: p, changePct: 0, sample: true })
  it('acciones reales + cripto de ejemplo: la de ejemplo se descarta (queda sin precio)', () => {
    expect(mergePrices({ VOO: real(663) }, { 'BTC-USD': fake(84000) })).toEqual({ VOO: real(663) })
    expect(mergePrices({ VOO: fake(550) }, { 'BTC-USD': real(61412) })).toEqual({ 'BTC-USD': real(61412) })
  })
  it('si ninguna fuente respondió, todo de ejemplo (y se rotula)', () => {
    const m = mergePrices({ VOO: fake(550) }, { 'BTC-USD': fake(84000) })
    expect(Object.values(m).every(q => q.sample)).toBe(true)
  })
  it('un refresco que cae al ejemplo no reemplaza precios reales ya mostrados', () => {
    const shown = { VOO: real(663), AAPL: real(349) }
    expect(keepRealQuotes(shown, { VOO: fake(550), AAPL: fake(200) })).toEqual(shown)
    expect(keepRealQuotes(shown, { VOO: real(670) }).VOO.price).toBe(670)
    // Sin nada real a la vista, el ejemplo entra; y lo real luego lo reemplaza.
    const first = keepRealQuotes({}, { VOO: fake(550) })
    expect(first.VOO.sample).toBe(true)
    expect(keepRealQuotes(first, { VOO: real(663) }).VOO.sample).toBeUndefined()
  })
  it('Mercado: cinta, noticias, SPY o tasas reales ya mostradas no se cambian por ejemplo en un refresco', () => {
    const bar = demoMarketBar()
    expect(keepsReal({ bar: true }, 'bar', bar)).toBe(true)
    expect(keepsReal({}, 'bar', bar)).toBe(false)
    expect(keepsReal({ bar: true }, 'bar', BAR)).toBe(false)
    expect(keepsReal({ news: true }, 'news', { items: [], sample: true })).toBe(true)
  })
  it('los resultados y fundamentales de ejemplo no se atribuyen a un proveedor', () => {
    expect(sampleEarnings('AAPL').source).toBe('sample')
    expect(sampleFundamentals('AAPL').source).toBe('sample')
  })
})
