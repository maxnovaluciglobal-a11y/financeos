import { describe, it, expect } from 'vitest'
import {
  MKT_SYMS, NEWS_IMG_HOSTS, chartPaths, cleanNews, newsImageSrc, safeNewsImage, daysAway, earningsUniverse, earningsWindow, feedFreshness, filterNews, fmtChange,
  fmtMarketValue, fxDecimals, fxRows, marketRows, monthCloses, newsAgo, newsCounts, nyseEarlyCloses, nyseHolidays,
  nyseSession, nyWallToMs, periodChange, quoteFreshness, regimeFrom, runLimited, safeLink, spyChartSeries,
  summarizeFreshness, vixFromBar, vixGaugePct, vixZone, whenKey, EARN_MAX_TICKERS, NEWS_MAX,
} from './investMarket.js'

const L = 'es-CL'
const ramp = (n, from, to) => Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1))

describe('instrumentos y formato', () => {
  it('son los 10 de Invest, sin el VIX', () => {
    expect(MKT_SYMS.map(s => s.sym)).toEqual(['^GSPC', '^DJI', '^IXIC', '^RUT', 'CL=F', 'GC=F', 'SI=F', 'EURUSD=X', '^TNX', 'BTC-USD'])
  })
  it('formatea cada tipo como Invest (mktFmtValue)', () => {
    expect(fmtMarketValue('EURUSD=X', 1.158, L)).toBe('1,1580')
    expect(fmtMarketValue('^TNX', 4.123, L)).toBe('4,12 %')
    expect(fmtMarketValue('BTC-USD', 84000.4, L)).toBe('US$ 84.000')
    expect(fmtMarketValue('GC=F', 4052.3, L)).toBe('US$ 4052,30'.replace('4052', '4.052'))
    expect(fmtMarketValue('^GSPC', 6030.4, L)).toBe('6.030')
    expect(fmtMarketValue('^RUT', 999.5, L)).toBe('999,50')
    expect(fmtMarketValue('^GSPC', null, L)).toBe('')
  })
  it('el cambio va en fracción, con signo tipográfico y dirección', () => {
    expect(fmtChange(0.0123, L)).toEqual({ text: '+1,23 %', dir: 'up' })
    expect(fmtChange(-0.004, L)).toEqual({ text: '−0,40 %', dir: 'down' })
    expect(fmtChange(0.00001, L)).toEqual({ text: '0,00 %', dir: 'flat' })
    expect(fmtChange(null)).toBeNull()
  })
  it('filas de la tabla: precio > 0 o sin dato; el VIX aparte', () => {
    const bar = { items: [{ sym: '^GSPC', price: 6000, changePct: 0.01 }, { sym: 'CL=F', price: 0, changePct: 0.02 }, { sym: '^VIX', price: 18.2 }] }
    const rows = marketRows(bar)
    expect(rows).toHaveLength(10)
    expect(rows[0]).toMatchObject({ sym: '^GSPC', price: 6000, changePct: 0.01 })
    expect(rows.find(r => r.sym === 'CL=F')).toMatchObject({ price: null, changePct: null })
    expect(vixFromBar(bar)).toBe(18.2)
    expect(vixFromBar({ items: [] })).toBeNull()
  })
  it('sparkline mensual: últimos 22 cierres > 0', () => {
    const rows = ramp(30, 10, 20).map(close => ({ close })).concat([{ close: 0 }, { close: null }])
    const c = monthCloses(rows)
    expect(c).toHaveLength(22)
    expect(c[c.length - 1]).toBe(20)
    expect(monthCloses([{ close: 5 }])).toBeNull()
    expect(periodChange([10, 12])).toBeCloseTo(0.2)
    expect(periodChange(null)).toBeNull()
  })
})

describe('tendencia de SPY (régimen)', () => {
  it('alcista: SPY > 1 % sobre la SMA200 y la SMA50 sobre la SMA200', () => {
    const r = regimeFrom(ramp(250, 400, 600))
    expect(r.regime).toBe('up')
    expect(r.pct200).toBeGreaterThan(0.01)
    expect(r.sma50).toBeGreaterThan(r.sma200)
  })
  it('bajista: SPY y la SMA50 bajo la SMA200', () => {
    expect(regimeFrom(ramp(250, 600, 400)).regime).toBe('down')
  })
  it('en transición: sobre la SMA200 pero a menos de 1 %', () => {
    const p = new Array(250).fill(100)
    p[249] = 100.5
    const r = regimeFrom(p)
    expect(r.regime).toBe('mixed')
    expect(r.pct200).toBeCloseTo(0.0025 / 1.0, 2)
  })
  it('sin 200 cierres no inventa la media de 200 días (Invest usaba min(200, n))', () => {
    const r = regimeFrom(ramp(150, 400, 600))
    expect(r.regime).toBeNull()
    expect(r.reason).toBe('short')
    expect(r.sma200).toBeNull()
    expect(regimeFrom([]).reason).toBe('none')
  })
  it('serie del gráfico: SMA200 real en cada punto, ordenada por fecha, el último año', () => {
    const rows = ramp(504, 400, 600).map((close, i) => ({ ts: 1_700_000_000 + i * 86400, close }))
    const shuffled = [...rows].reverse()
    const s = spyChartSeries(shuffled)
    expect(s).toHaveLength(252)
    expect(s[s.length - 1].close).toBe(600)
    const last200 = rows.slice(-200).reduce((a, r) => a + r.close, 0) / 200
    expect(s[s.length - 1].ma).toBeCloseTo(last200, 6)
    expect(spyChartSeries(rows.slice(0, 200))).toBeNull()
  })
  it('trazos SVG dentro del lienzo', () => {
    const s = [{ close: 1, ma: 1.5 }, { close: 2, ma: 1.6 }, { close: 3, ma: 1.7 }]
    const p = chartPaths(s, 100, 50)
    expect(p.price.startsWith('M4.00,')).toBe(true)
    expect(p.ma.split(' ')).toHaveLength(3)
    expect(p.dot.x).toBe(96)
    expect(p.dot.y).toBe(4)
    expect(chartPaths([{ close: 1, ma: 1 }], 100, 50)).toBeNull()
  })
})

describe('VIX: una sola escala 15/25/35', () => {
  it('zonas', () => {
    expect(vixZone(12)).toBe('low')
    expect(vixZone(15)).toBe('normal')
    expect(vixZone(24.9)).toBe('normal')
    expect(vixZone(25)).toBe('elevated')
    expect(vixZone(35)).toBe('extreme')
    expect(vixZone(null)).toBeNull()
    expect(vixZone(0)).toBeNull()
  })
  it('marcador acotado de 0 a 100 %', () => {
    expect(vixGaugePct(25)).toBe(50)
    expect(vixGaugePct(80)).toBe(100)
    expect(vixGaugePct(null)).toBeNull()
  })
})

describe('próximos resultados', () => {
  it('universo: portafolio + lista, sin cripto ni índices, sin repetir', () => {
    const u = earningsUniverse({
      holdings: [{ t: 'AAPL', type: 'Stock' }, { t: 'BTC-USD', type: 'Crypto' }, { t: 'SOL', type: 'Crypto' }, { t: 'VOO', type: 'ETF' }],
      watch: ['aapl', 'MSFT', '^GSPC', 'ETH-USD', { ticker: 'NVDA' }],
    })
    expect(u.tickers).toEqual(['AAPL', 'VOO', 'MSFT', 'NVDA'])
    expect(u.defaults).toBe(false)
    expect(u.portfolio.has('AAPL')).toBe(true)
    expect(u.watch.has('MSFT')).toBe(true)
  })
  it('sin nada propio: empresas de referencia', () => {
    const u = earningsUniverse({ holdings: [{ t: 'BTC-USD', type: 'Crypto' }] })
    expect(u.defaults).toBe(true)
    expect(u.tickers).toEqual(['AAPL', 'NVDA', 'MSFT', 'AMZN', 'GOOGL', 'META'])
  })
  it(`tope de ${EARN_MAX_TICKERS} empresas`, () => {
    const watch = Array.from({ length: 20 }, (_, i) => `T${i}`)
    const u = earningsUniverse({ watch })
    expect(u.tickers).toHaveLength(EARN_MAX_TICKERS)
    expect(u.capped).toBe(true)
  })
  it('ventana de −2 a +45 días, ordenada, sin fuente = falló', () => {
    const now = Date.UTC(2026, 10, 20, 12)
    expect(daysAway('2026-11-25', now)).toBe(5)
    expect(daysAway('nope', now)).toBeNull()
    const w = earningsWindow([
      { ticker: 'A', data: { nextDate: '2026-11-18', source: 'finnhub' } },
      { ticker: 'B', data: { nextDate: '2026-11-17', source: 'finnhub' } },
      { ticker: 'C', data: { nextDate: '2027-01-04', source: 'fmp' } },
      { ticker: 'D', data: { nextDate: '2027-01-05', source: 'fmp' } },
      { ticker: 'E', data: null },
      { ticker: 'F', data: { nextDate: null, source: 'finnhub' } },
      { ticker: 'G', data: { nextDate: '2026-11-20', source: 'finnhub' } },
    ], now)
    expect(w.items.map(x => [x.ticker, x.days])).toEqual([['A', -2], ['G', 0], ['C', 45]])
    expect(w.failed).toBe(1)
    expect(w.total).toBe(7)
    expect(w.sources.sort()).toEqual(['finnhub', 'fmp'])
  })
  it('cuándo', () => {
    expect(whenKey(-2)).toEqual({ key: 'invest.mkt.earn.when.agoMany', n: 2 })
    expect(whenKey(-1).key).toBe('invest.mkt.earn.when.agoOne')
    expect(whenKey(0).key).toBe('invest.mkt.earn.when.today')
    expect(whenKey(1).key).toBe('invest.mkt.earn.when.tomorrow')
    expect(whenKey(9)).toEqual({ key: 'invest.mkt.earn.when.inMany', n: 9 })
  })
})

describe('noticias', () => {
  const raw = [
    { id: 1, title: 'Fed holds', link: 'https://x.com/a', source: 'Reuters', hoursAgo: 2, cat: 'Fed', image: 'https://img/x.jpg' },
    { id: 2, title: 'Fed holds', link: 'https://x.com/a', cat: 'Fed' },
    { id: 3, title: 'Bad link', link: 'javascript:alert(1)', cat: 'Rare' },
    { id: 4, title: '', link: 'https://x.com/b' },
    { id: 5, title: 'Chips up', link: 'https://x.com/c', cat: 'IA & Tech', hoursAgo: null },
  ]
  it('limpia: sin título fuera, sin duplicados, enlaces solo http(s), miniatura de host no permitido fuera, categoría desconocida → Macro', () => {
    const n = cleanNews(raw)
    expect(n.map(x => x.title)).toEqual(['Fed holds', 'Bad link', 'Chips up'])
    expect(n[1].link).toBeNull()
    expect(n[1].cat).toBe('Macro')
    expect(n[2].hoursAgo).toBeNull()
    expect(n.every(x => x.image === null)).toBe(true)
    expect(safeLink('ftp://x')).toBeNull()
  })
  it('miniatura: solo https de los CDN permitidos (los mismos de img-src)', () => {
    const ok = 'https://media.zenfs.com/en/reuters.com/abc.jpg'
    expect(cleanNews([{ title: 'A', link: 'https://x.com/1', image: ok }])[0].image).toBe(ok)
    for (const h of NEWS_IMG_HOSTS) expect(safeNewsImage(`https://${h}/a.jpg`)).toBe(`https://${h}/a.jpg`)
    for (const bad of [
      'http://media.zenfs.com/a.jpg', 'https://evil.example/a.jpg', 'https://media.zenfs.com.evil.example/a.jpg',
      'https://evil.cloudfront.net/a.jpg', 'javascript:alert(1)', 'data:image/png;base64,AAAA', '//media.zenfs.com/a.jpg',
      'https://user:pw@media.zenfs.com/a.jpg', 'https://media.zenfs.com:8443/a.jpg', '', null, 42, { url: ok },
    ]) {
      expect(safeNewsImage(bad), String(bad)).toBeNull()
      expect(cleanNews([{ title: 'A', link: 'https://x.com/1', image: bad }])[0].image).toBeNull()
      expect(newsImageSrc(bad)).toBeNull()
    }
  })
  it('miniatura: el src va por el proxy de Invest, con la URL codificada', () => {
    const ok = 'https://media.zenfs.com/en/reuters.com/a b.jpg?x=1&y=2'
    const src = newsImageSrc(ok)
    expect(src.startsWith('https://invest.moyiq.app/api/img?u=')).toBe(true)
    const u = new URL(src)
    expect([...u.searchParams.keys()]).toEqual(['u'])
    expect(u.searchParams.get('u')).toBe(new URL(ok).href)
  })
  it('cuenta y filtra por categoría, máximo 30', () => {
    const n = cleanNews(raw)
    expect(newsCounts(n)).toEqual({ all: 3, Fed: 1, Macro: 1, 'IA & Tech': 1 })
    expect(filterNews(n, 'Fed').map(x => x.title)).toEqual(['Fed holds'])
    expect(filterNews(n, 'all')).toHaveLength(3)
    const many = cleanNews(Array.from({ length: 40 }, (_, i) => ({ title: `t${i}`, link: `https://x/${i}` })))
    expect(filterNews(many, 'all')).toHaveLength(NEWS_MAX)
  })
  it('antigüedad', () => {
    expect(newsAgo(0.5).key).toBe('invest.mkt.news.ago.lt1')
    expect(newsAgo(1)).toEqual({ key: 'invest.mkt.news.ago.hourOne', n: 1 })
    expect(newsAgo(5)).toEqual({ key: 'invest.mkt.news.ago.hourMany', n: 5 })
    expect(newsAgo(30)).toEqual({ key: 'invest.mkt.news.ago.dayOne', n: 1 })
    expect(newsAgo(72)).toEqual({ key: 'invest.mkt.news.ago.dayMany', n: 3 })
    expect(newsAgo(null)).toBeNull()
  })
})

describe('tipos de cambio LatAm', () => {
  const latam = { rates: { CLP: 940, MXN: 18.1, COP: 4000, ARS: 1450, PEN: 3.75 }, sources: { CLP: 'mindicador', MXN: 'yahoo', COP: 'fallback', ARS: 'yahoo', PEN: 'yahoo' } }
  const ars = { mep: { rate: 1500, date: '2026-11-19' }, oficial: { rate: 1440, date: '2026-11-19' } }
  it('CLP, MXN, COP, ARS oficial y MEP, PEN; un respaldo no se muestra como dato', () => {
    const rows = fxRows(latam, ars)
    expect(rows.map(r => r.id)).toEqual(['CLP', 'MXN', 'COP', 'ARS-Oficial', 'ARS-MEP', 'PEN'])
    expect(rows[0]).toMatchObject({ rate: 940, source: 'mindicador' })
    expect(rows[2]).toMatchObject({ rate: null, source: null })
    expect(rows[3]).toMatchObject({ rate: 1450, source: 'yahoo', kind: 'Oficial' })
    expect(rows[4]).toMatchObject({ rate: 1500, source: 'dolarapi', date: '2026-11-19', kind: 'MEP' })
  })
  it('sin oficial de Yahoo, el oficial de DolarApi; sin nada, sin dato', () => {
    const rows = fxRows({ rates: {}, sources: {} }, ars)
    expect(rows.find(r => r.id === 'ARS-Oficial')).toMatchObject({ rate: 1440, source: 'dolarapi' })
    const none = fxRows(null, null)
    expect(none.every(r => r.rate == null)).toBe(true)
  })
  it('demo: todo rotulado como ejemplo', () => {
    expect(fxRows(latam, ars, { sample: true }).filter(r => r.rate != null).every(r => r.source === 'sample')).toBe(true)
  })
  it('decimales', () => {
    expect(fxDecimals('CLP', 940)).toBe(0)
    expect(fxDecimals('MXN', 18.1)).toBe(2)
    expect(fxDecimals('ARS', 1450)).toBe(0)
  })
})

describe('Bolsa de Nueva York: horario con feriados', () => {
  it('feriados 2026 (con días observados)', () => {
    const h = [...nyseHolidays(2026)].sort()
    expect(h).toEqual(['2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25'])
  })
  it('año nuevo en sábado no se corre; domingo pasa al lunes', () => {
    expect(nyseHolidays(2022).has('2021-12-31')).toBe(false) // 1-ene-2022 fue sábado
    expect(nyseHolidays(2023).has('2023-01-02')).toBe(true) // 1-ene-2023 fue domingo
  })
  it('jornadas cortas solo si ese día se opera', () => {
    expect([...nyseEarlyCloses(2026)].sort()).toEqual(['2026-11-27', '2026-12-24']) // el 3-jul-2026 es feriado
    expect(nyseEarlyCloses(2025).has('2025-07-03')).toBe(true)
  })
  it('hora de pared de Nueva York ↔ UTC, con horario de verano', () => {
    expect(new Date(nyWallToMs(2026, 11, 20, 9, 30)).toISOString()).toBe('2026-11-20T14:30:00.000Z')
    expect(new Date(nyWallToMs(2026, 7, 1, 9, 30)).toISOString()).toBe('2026-07-01T13:30:00.000Z')
  })
  it('abierta, antes, después, fin de semana y feriado', () => {
    const at = (iso) => nyseSession(Date.parse(iso))
    const open = at('2026-11-20T15:00:00Z') // viernes 10:00 NY
    expect(open).toMatchObject({ open: true, reason: 'open', early: false })
    expect(new Date(open.closesAt).toISOString()).toBe('2026-11-20T21:00:00.000Z')
    expect(at('2026-11-20T13:00:00Z')).toMatchObject({ open: false, reason: 'before' })
    const after = at('2026-11-20T22:00:00Z')
    expect(after).toMatchObject({ open: false, reason: 'after' })
    expect(new Date(after.opensAt).toISOString()).toBe('2026-11-23T14:30:00.000Z') // lunes
    expect(at('2026-11-22T15:00:00Z')).toMatchObject({ open: false, reason: 'weekend' })
    const thx = at('2026-11-26T15:00:00Z')
    expect(thx).toMatchObject({ open: false, reason: 'holiday' })
    expect(new Date(thx.opensAt).toISOString()).toBe('2026-11-27T14:30:00.000Z')
    const early = at('2026-11-27T17:00:00Z') // 12:00 NY, cierra 13:00
    expect(early).toMatchObject({ open: true, early: true })
    expect(new Date(early.closesAt).toISOString()).toBe('2026-11-27T18:00:00.000Z')
    expect(at('2026-11-27T18:30:00Z')).toMatchObject({ open: false, reason: 'after' })
  })
})

describe('frescura', () => {
  it('del bloque de datos', () => {
    expect(feedFreshness({ loading: true }).state).toBe('loading')
    expect(feedFreshness({ at: 5 })).toEqual({ state: 'ok', at: 5 })
    expect(feedFreshness({ failed: true }).state).toBe('failed')
    expect(feedFreshness({ at: 5, failed: true }).state).toBe('offline')
    expect(feedFreshness({ at: 5, offline: true }).state).toBe('offline')
    expect(feedFreshness({ at: 5, sample: true }).state).toBe('sample')
  })
  it('de una cotización (readings.js)', () => {
    const now = 1_000_000_000
    expect(quoteFreshness({ marketTime: now - 60000 }, now)).toMatchObject({ state: 'live', minutes: 1 })
    expect(quoteFreshness({ marketTime: now - 15 * 60000 }, now)).toMatchObject({ state: 'delayed', minutes: 15 })
    expect(quoteFreshness({ marketTime: now - 60000, tradingEnd: now - 1 }, now).state).toBe('closed')
    expect(quoteFreshness({ fetchedAt: now }, now).state).toBe('unknown')
    expect(quoteFreshness({ marketTime: 5 }, now, true).state).toBe('offline')
  })
  it('resumen: el peor caso entre los abiertos', () => {
    const now = 1_000_000_000
    const s = summarizeFreshness([{ marketTime: now - 60000 }, { marketTime: now - 20 * 60000 }, { marketTime: now - 5, tradingEnd: now - 1 }], now)
    expect(s).toMatchObject({ state: 'delayed', minutes: 20 })
    expect(summarizeFreshness([], now).state).toBe('loading')
    expect(summarizeFreshness([{ marketTime: 9 }], now, true)).toMatchObject({ state: 'offline', time: 9 })
  })
})

describe('concurrencia limitada', () => {
  it('nunca más de N a la vez y conserva el orden', async () => {
    let active = 0, peak = 0
    const out = await runLimited([1, 2, 3, 4, 5, 6, 7], 3, async (x) => {
      active++; peak = Math.max(peak, active)
      await new Promise(r => setTimeout(r, 2))
      active--
      if (x === 4) throw new Error('falla')
      return x * 2
    })
    expect(peak).toBeLessThanOrEqual(3)
    expect(out).toEqual([2, 4, 6, null, 10, 12, 14])
  })
})
