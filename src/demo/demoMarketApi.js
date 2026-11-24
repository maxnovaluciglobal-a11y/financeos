// src/demo/demoMarketApi.js — datos de mercado del demo: REALES, con respaldo.
//
// El demo usa el mismo cliente que la app con sesión (core/investApi.js: caché
// en memoria por tipo de dato, un pedido en vuelo por URL, lotes y topes de
// tiempo). Lo único inventado es el PORTAFOLIO (posiciones, cantidades, costo,
// operaciones, lista y alertas): se valora a precios reales.
//
// Respaldo por pedido, nunca mezclado en silencio: cada llamada devuelve lo que
// respondió la API o, si falló o se pasó del tope de tiempo, la cifra de
// ejemplo de la misma pieza, marcada `sample` (objetos) o registrada en
// isSample() (series). La pantalla rotula "Datos de ejemplo" solo esa pieza.
//  · cotizaciones: si el lote no trae NINGÚN precio, todo el lote sale de
//    ejemplo; si trae alguno, los que falten quedan sin precio (como en la app);
//  · el ejemplo solo existe para los símbolos del demo (sampleTickers): un
//    ticker que la persona busca y no existe no recibe un precio inventado;
//  · lo que falla no se guarda en caché: el próximo refresco vuelve a la red.
//
// Privacidad: los símbolos que viajan son los del ejemplo (VOO, AAPL, MSFT,
// BTC-USD, SPY, QQQ, NVDA…) o los que la persona escribe en el demo, igual que
// en la app ("solo se consultan los símbolos"). Noticias: solo las del mercado
// general, como en la app.
import { investApi } from '../core/investApi.js'
import { demoInvestRows } from './demoInvest.js'
import { DEMO_WATCH as ASSET_WATCH, sampleCandles, sampleEarnings, sampleFundamentals, sampleQuote } from './demoInvestAsset.js'
import { DEMO_WATCH as HOY_WATCH, demoHistory, demoMarket, demoQuotes } from './demoInvestHoy.js'
import { demoEarnings, demoFx, demoMarketBar, demoNews, demoSpyHistory } from './demoMarket.js'

const marked = new WeakSet()
const mark = (rows) => { if (rows && typeof rows === 'object') marked.add(rows); return rows }
/** ¿Esta serie (o este objeto) es de ejemplo? */
export const isSample = (x) => !!x && typeof x === 'object' && (marked.has(x) || x.sample === true)

const up = (t) => String(t ?? '').toUpperCase().trim()

// Símbolos con cifra de ejemplo: los del portafolio, las dos listas y SPY/QQQ.
export const sampleTickers = () => new Set([...demoInvestRows().map(r => r.t), ...ASSET_WATCH, ...HOY_WATCH, 'SPY', 'QQQ'])

// Velas de ejemplo por rango (mismas que la ficha del activo).
const RANGE_SESSIONS = { '1d': 2, '5d': 5, '1mo': 23, '3mo': 66, '6mo': 130, '1y': 252, '2y': 504, '5y': Infinity }
function sampleRows(t, range) {
  const c = sampleCandles(t)
  const n = RANGE_SESSIONS[range] ?? 252
  const rows = (n === Infinity ? c : c.slice(-n)).map(r => ({ ...r, ts: Math.floor(Date.parse(`${r.date}T00:00:00Z`) / 1000) }))
  return rows
}

// Fuente de ejemplo con la forma de investApi: determinista y sin red. La
// usan el respaldo y las pruebas.
export function createSampleMarketApi(over = {}) {
  const known = sampleTickers()
  const quoteOf = (t) => {
    const row = demoInvestRows().find(r => r.t === t)
    return row ? { ticker: t, price: row.price, changePct: row.dayPct, currency: 'USD', name: row.name, sample: true } : sampleQuote(t)
  }
  const quotes = (list) => {
    const out = {}
    for (const raw of list || []) { const t = up(raw); if (known.has(t)) out[t] = quoteOf(t) }
    return out
  }
  const base = {
    quotes,
    crypto: quotes,
    quote: (t) => quotes([t])[up(t)] || null,
    // SPY de 2 años: la serie del ejemplo de Mercado (tendencia alcista).
    history: (t, range = '1y') => (up(t) === 'SPY' && range === '2y' ? mark(demoSpyHistory()) : known.has(up(t)) ? mark(sampleRows(up(t), range)) : null),
    marketbar: () => demoMarketBar(),
    news: () => ({ items: demoNews((k) => k), fetchedAt: null, sample: true }),
    earnings: (t) => {
      const tk = up(t)
      const next = demoEarnings()[tk]
      const full = sampleEarnings(tk)
      if (!next && !full) return null
      return { ...(full || {}), ticker: tk, nextDate: next?.nextDate ?? full?.nextDate ?? null, source: 'sample', sample: true }
    },
    fundamentals: (list) => {
      const out = {}
      for (const raw of list || []) { const f = sampleFundamentals(up(raw)); if (f) out[up(raw)] = f }
      return out
    },
    fxLatam: () => ({ ...demoFx().latam, sample: true }),
    fxArs: () => ({ ...demoFx().ars, sample: true }),
  }
  return { ...base, ...over }
}

const priced = (map) => Object.values(map || {}).some(q => q && q.price > 0)

// Envoltorio de investApi para el demo: real primero, ejemplo si falla.
export function createDemoMarketApi({ live = investApi, sample = createSampleMarketApi() } = {}) {
  const known = sampleTickers()
  const batch = (kind) => async (list) => {
    const r = await live[kind](list)
    if (priced(r)) return r
    const s = await sample[kind]((list || []).filter(t => known.has(up(t))))
    return s && Object.keys(s).length ? s : (r || {})
  }
  const one = (kind, ok = (d) => d != null) => async (...args) => {
    const d = await live[kind](...args)
    if (ok(d)) return d
    return (await sample[kind](...args)) ?? d ?? null
  }
  return {
    demo: true,
    isSample,
    quotes: batch('quotes'),
    crypto: batch('crypto'),
    async quote(ticker, opts = {}) {
      const t = up(ticker)
      const r = opts.crypto ? await this.crypto([t]) : await this.quotes([t])
      return r[t] || null
    },
    history: one('history', (d) => Array.isArray(d) && d.length > 0),
    marketbar: one('marketbar', (d) => !!d && (d.items || []).some(x => x && x.price > 0)),
    news: one('news', (d) => !!d && (d.items || []).length > 0),
    // Resultados: sin respaldo por ticker (mezclaría fechas reales y de
    // ejemplo en la misma lista); cada pantalla decide si todo cae al ejemplo.
    earnings: (t) => live.earnings(t),
    sampleEarnings: (t) => sample.earnings(t),
    async fundamentals(list) {
      const r = await live.fundamentals(list)
      if (r && Object.keys(r).length) return r
      return sample.fundamentals(list)
    },
    fxLatam: one('fxLatam', (d) => !!d && !!d.rates && Object.keys(d.rates).length > 0),
    fxArs: one('fxArs', (d) => !!d && !!(d.mep || d.oficial)),
    forget: (...p) => live.forget?.(...p),
    stats: () => live.stats?.(),
  }
}

// La instancia del demo (comparte la caché en memoria de investApi).
export const demoMarketApi = createDemoMarketApi()

// Hoy: el respaldo es el ejemplo propio de Hoy (series que terminan en el
// precio de ejemplo y la cinta redonda de demoInvestHoy).
export function createHoySampleApi() {
  const qs = demoQuotes()
  const pick = (list) => Object.fromEntries((list || []).map(up).filter(t => qs[t]).map(t => [t, qs[t]]))
  return createSampleMarketApi({
    quotes: pick,
    crypto: pick,
    history: (t, range = '1y') => mark(demoHistory(up(t), range)),
    marketbar: () => demoMarket(),
  })
}
export const demoHoyApi = createDemoMarketApi({ sample: createHoySampleApi() })
