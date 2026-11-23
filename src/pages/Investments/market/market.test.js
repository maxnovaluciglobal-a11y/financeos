import { describe, it, expect, vi } from 'vitest'
// Textos de Inversiones registrados como al entrar a la sección.
import '../i18n/investStrings.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { translate } from '../../../i18n/translate.js'
import { MarketView, freshText, sessionText } from './Market.jsx'
import { INITIAL, barState, demoState, fxState, loadEarningsWith, newsState, spyState, vixOf } from './useMarket.js'
import { DEMO_BAR, demoMonth, demoSpyHistory } from '../../../demo/demoMarket.js'
import { demoInvestRows } from '../../../demo/demoInvest.js'
import { regimeFrom, vixZone, nyseSession } from '../../../utils/investMarket.js'

const DIR = dirname(fileURLToPath(import.meta.url))
const t = (k, v) => translate('es', k, v)
const NOW = Date.parse('2026-11-20T15:00:00Z')
const render = (m, props = {}) => renderToStaticMarkup(h(MarketView, { t, lang: 'es', m, now: NOW, ...props }))
const live = (patch = {}) => ({ ...demoState(t, NOW), offline: false, refreshing: false, refresh: () => {}, sample: false, ...patch })

describe('demo de Mercado: coherente y rotulado', () => {
  it('coincide con el portafolio de ejemplo', () => {
    const btc = demoInvestRows().find(r => r.t === 'BTC-USD')
    expect(DEMO_BAR.find(x => x.sym === 'BTC-USD').price).toBe(btc.price)
    expect(regimeFrom(demoSpyHistory().map(r => r.close)).regime).toBe('up')
    expect(vixZone(DEMO_BAR.find(x => x.sym === '^VIX').price)).toBe('normal')
    for (const it of DEMO_BAR.filter(x => x.sym !== '^VIX')) {
      const c = demoMonth(it.sym)
      expect(c).toHaveLength(22)
      expect(c[c.length - 1]).toBeCloseTo(it.price, 6)
      expect(Math.sign(c[c.length - 1] - c[0])).toBe(it.changePct >= 0 ? 1 : -1)
    }
  })
  it('resultados de AAPL y MSFT, sin cripto', () => {
    const m = demoState(t, NOW)
    expect(m.earn.universe.tickers).toEqual(['VOO', 'AAPL', 'MSFT'])
    expect(m.earn.result.items.map(x => x.ticker)).toEqual(['AAPL', 'MSFT'])
  })
  it('se pinta completo y dice que son datos de ejemplo, sin enlaces externos a noticias', () => {
    const html = render({ ...demoState(t, NOW), offline: false, refreshing: false, refresh: () => {}, sample: true })
    expect(html).toContain(t('invest.mkt.sample'))
    expect(html).toContain(t('invest.mkt.regime.up'))
    expect(html).toContain(t('invest.mkt.meaning.q'))
    expect(html).toContain(t('invest.mkt.spy.ma'))
    expect(html).toContain(t('invest.mkt.vix.normal'))
    expect(html).toContain(t('invest.mkt.sym.oil'))
    expect(html).toContain(t('invest.mkt.earn.inPortfolio'))
    expect(html).toContain(t('invest.mkt.demo.news.1'))
    expect(html).toContain(t('invest.mkt.news.footSample'))
    expect(html).toContain(t('invest.mkt.sources.sample'))
    expect((html.match(/<tr id="mkt-row-/g) || []).length).toBe(10)
    expect((html.match(/aria-pressed=/g) || []).length).toBe(6)
    expect(html).not.toMatch(/href="https?:\/\/(?!dolarapi)/)
    expect(html).not.toContain('Yahoo Finance)')
  })
})

describe('Mercado con datos reales', () => {
  const news = { phase: 'ready', items: [
    { id: '1', title: 'Fed holds rates', link: 'https://news.example/a', source: 'Reuters', hoursAgo: 2, cat: 'Fed' },
    { id: '2', title: 'Chips rally', link: 'https://news.example/b', source: 'Bloomberg', hoursAgo: 30, cat: 'IA & Tech' },
  ] }
  it('noticias: enlace externo seguro, en inglés, sin miniaturas y sin tickers propios', () => {
    const html = render(live({ news }), { filter: 'all' })
    expect(html).toContain('href="https://news.example/a" target="_blank" rel="noopener noreferrer" lang="en"')
    expect(html).toContain(t('invest.mkt.news.newTab'))
    expect(html).not.toContain('<img')
    expect(html).toContain(t('invest.mkt.news.foot'))
    expect(html).toContain('Reuters · hace 2 horas · Reserva Federal')
  })
  it('filtro sin titulares: lo dice y ofrece ver todos; chip con 0 deshabilitado', () => {
    const html = render(live({ news }), { filter: 'Earnings' })
    expect(html).toContain(t('invest.mkt.news.emptyCat', { cat: t('invest.mkt.news.cat.earnings') }))
    expect(html).toContain(t('invest.mkt.news.seeAll'))
    expect(html).toMatch(/aria-pressed="false" disabled="">Geopolítica/)
  })
  it('fuentes y atribución visibles', () => {
    const html = render(live({ fx: { phase: 'ready', latam: { rates: { CLP: 940, ARS: 1450 }, sources: { CLP: 'mindicador', ARS: 'yahoo' } }, ars: { mep: { rate: 1500, date: '2026-11-19' } } } }))
    expect(html).toContain(t('invest.mkt.sources'))
    expect(html).toContain(t('invest.mkt.disclaimer'))
    expect(html).toContain(t('invest.mkt.meaning.note'))
    expect(html).toContain(t('invest.mkt.fx.src.mindicador'))
    expect(html).toContain('href="https://dolarapi.com"')
    expect(html).toContain(t('invest.mkt.fx.src.none')) // MXN, COP, PEN sin tasa real
  })
  it('degradación honesta cuando las fuentes fallan', () => {
    const html = render(live({
      bar: { phase: 'error', data: null, at: null }, vix: null,
      spy: { phase: 'error', rows: null },
      earn: { phase: 'ready', universe: { tickers: ['AAPL'], defaults: false, portfolio: new Set(['AAPL']), watch: new Set() }, result: { items: [], failed: 1, total: 1, sources: [] } },
      news: { phase: 'error', items: [] },
      fx: { phase: 'error', latam: null, ars: null },
    }))
    expect(html).toContain(t('invest.mkt.fresh.failed'))
    expect(html).toContain(t('invest.mkt.regime.none'))
    expect(html).toContain(t('invest.mkt.regime.none.desc'))
    expect(html).toContain(t('invest.mkt.vix.none'))
    expect(html).toContain(t('invest.mkt.idx.none'))
    expect(html).toContain(t('invest.mkt.earn.failed'))
    expect(html).toContain(t('invest.mkt.news.none'))
    expect(html).toContain(t('invest.mkt.fx.failed'))
  })
  it('ARS: si se pide el MEP y no hay, se usa el oficial y se dice', () => {
    const html = render(live({ fx: { phase: 'ready', latam: { rates: { ARS: 1450 }, sources: { ARS: 'yahoo' } }, ars: { mep: null } } }), { kind: 'MEP' })
    expect(html).toContain(t('invest.mkt.fx.fallbackMep'))
    expect(html).toContain('role="radiogroup"')
  })
})

describe('textos de horario y frescura', () => {
  it('abierta y cerrada', () => {
    expect(sessionText(t, nyseSession(NOW), NOW)).toMatch(/^Bolsa de Nueva York abierta · cierra a las /)
    const thx = Date.parse('2026-11-26T15:00:00Z')
    expect(sessionText(t, nyseSession(thx), thx)).toMatch(/^Bolsa de Nueva York cerrada por feriado · abre /)
  })
  it('frescura', () => {
    expect(freshText(t, { state: 'loading' })).toBe(t('invest.mkt.fresh.loading'))
    expect(freshText(t, { state: 'offline', at: null })).toBe(t('invest.mkt.fresh.offlineNone'))
    expect(freshText(t, { state: 'ok', at: NOW })).toMatch(/^Con el retraso de la fuente · consultado a las /)
  })
})

describe('privacidad de Mercado', () => {
  const hook = readFileSync(join(DIR, 'useMarket.js'), 'utf8')
  const view = readFileSync(join(DIR, 'Market.jsx'), 'utf8')
  it('las noticias se piden sin tickers (nada de la persona en la URL)', () => {
    expect(hook).toMatch(/api\.news\(\)/)
    expect(hook).not.toMatch(/api\.news\(\s*\{/)
  })
  it('nada de posiciones ni tickers en el dispositivo: solo la preferencia Oficial/MEP', () => {
    expect(hook).not.toMatch(/localStorage|sessionStorage|indexedDB/)
    const writes = [...view.matchAll(/localStorage\.setItem\(([^,]+),/g)].map(m => m[1].trim())
    expect(writes).toEqual(['k'])
    expect(view).toMatch(/safeStore\.set\(ARS_KIND_KEY, k\)/)
    expect((view.match(/safeStore\.set\(/g) || []).length).toBe(1)
  })
})

describe('transiciones de estado de useMarket', () => {
  const prev = { ...INITIAL, bar: { phase: 'ready', data: { items: [{ sym: '^GSPC', price: 6000 }] }, at: 1 }, vix: 18, news: { phase: 'ready', items: [{ id: 'a', title: 'x' }] } }
  it('cinta: con precio queda lista; sin precio conserva lo último (stale) o error', () => {
    const b = { items: [{ sym: '^GSPC', price: 6100 }], fetchedAt: 5 }
    expect(barState(INITIAL, b, 20, 9)).toEqual({ bar: { phase: 'ready', data: b, at: 5 }, vix: 20 })
    expect(barState(prev, null, null, 9)).toEqual({ bar: { phase: 'stale', data: prev.bar.data, at: 1 }, vix: 18 })
    expect(barState(INITIAL, { items: [{ sym: '^GSPC', price: 0 }] }, null, 9).bar.phase).toBe('error')
  })
  it('noticias: si la fuente no trae nada se conservan las que había', () => {
    expect(newsState(prev, { items: [] }).news).toEqual(prev.news)
    expect(newsState(INITIAL, null).news.phase).toBe('error')
    expect(newsState(INITIAL, { items: [{ id: 1, title: 'T', link: 'https://a.b', cat: 'Fed' }] }).news.items).toHaveLength(1)
  })
  it('SPY y tipos de cambio', () => {
    expect(spyState(null).spy.phase).toBe('error')
    expect(spyState([{ close: 1 }]).spy.phase).toBe('ready')
    expect(fxState(null, null).fx.phase).toBe('error')
    expect(fxState({ rates: {} }, null).fx.phase).toBe('ready')
  })
  it('VIX: de la cinta; si falta, del último cierre de 3 meses (salvo en el refresco rápido)', async () => {
    const api = { history: vi.fn(async () => [{ close: 21 }, { close: 22.5 }]) }
    expect(await vixOf(api, { items: [{ sym: '^GSPC', price: 1 }, { sym: '^VIX', price: 16 }] })).toBe(16)
    expect(api.history).not.toHaveBeenCalled()
    expect(await vixOf(api, { items: [{ sym: '^GSPC', price: 1 }] })).toBe(22.5)
    expect(api.history).toHaveBeenCalledWith('^VIX', '3mo', '1d')
    expect(await vixOf(api, null, { quick: true })).toBeNull()
  })
  it('resultados: universo en memoria, sin cripto, de a 4 y tolera fallos', async () => {
    const at = () => NOW
    const data = {
      listHoldings: async () => ({ ok: true, data: [{ t: 'AAPL', type: 'Stock' }, { t: 'BTC-USD', type: 'Crypto' }] }),
      listWatchlist: async () => ({ ok: true, data: [{ ticker: 'MSFT' }] }),
    }
    const asked = []
    const api = { earnings: async (tk) => { asked.push(tk); return tk === 'MSFT' ? null : { nextDate: '2026-11-25', source: 'finnhub' } } }
    const r = await loadEarningsWith(api, data, at)
    expect(asked).toEqual(['AAPL', 'MSFT'])
    expect(r.earn.result.items.map(x => x.ticker)).toEqual(['AAPL'])
    expect(r.earn.result.failed).toBe(1)
    expect(r.earn.universe.portfolio.has('AAPL')).toBe(true)
    const off = await loadEarningsWith(api, { listHoldings: async () => { throw new Error('x') }, listWatchlist: async () => ({ ok: false }) }, at)
    expect(off.earn.universe.defaults).toBe(true)
  })
})

describe('Mercado en la vista esencial', () => {
  it('sin cinta ni media de 200 días; la tendencia y su explicación quedan', () => {
    const m = { ...demoState(t, NOW), offline: false, refreshing: false, refresh: () => {}, sample: true }
    const full = render(m)
    const ess = render(m, { view: 'esencial' })
    expect(full).toContain(t('invest.mkt.spy.ma'))
    expect(full).toContain(t('invest.mkt.p200.k'))
    expect(ess).not.toContain(t('invest.mkt.spy.ma'))
    expect(ess).not.toContain(t('invest.mkt.p200.k'))
    expect((ess.match(/class="[^"]*stripItem/g) || []).length).toBe(0)
    expect(ess).toContain(t('invest.mkt.regime.up'))
    expect(ess).toContain(t('invest.mkt.meaning.q'))
    // "¿Qué significa para mí?" sin medias ni stops (los stops son de la vista completa).
    expect(ess).toContain(t('invest.mkt.meaning.up.simple'))
    expect(ess).not.toContain(t('invest.mkt.meaning.up'))
    expect(full).toContain(t('invest.mkt.meaning.up'))
    expect(ess).toContain(t('invest.mkt.ruleSimple'))
    const essText = ess.replace(/<[^>]+>/g, ' ')
    expect(essText).not.toMatch(/\bstops?\b|medias? (largas|de 200)|media de 200/i)
  })
  it('los textos simples no hablan de medias ni de stops', () => {
    for (const k of ['meaning.up.simple', 'meaning.down.simple', 'meaning.mixed.simple', 'regime.shortSimple', 'spy.shortSimple']) {
      expect(t(`invest.mkt.${k}`), k).not.toMatch(/\bstops?\b|\bmedias?\b|200/i)
    }
  })
})
