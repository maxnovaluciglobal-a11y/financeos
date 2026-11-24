// src/core/investApi.js — cliente de la API de datos de mercado de Invest.
//
// Los endpoints viven en invest.moyiq.app/api/* (Vercel Edge) y ya aceptan el
// origen app.moyiq.app y el de Capacitor (invest-web/api/_lib/origin.js). Este
// cliente agrega lo que la app necesita para no castigar a los proveedores:
//  · lotes (quote de a 10, crypto de a 30, fundamentals de a 10);
//  · tope de tiempo por pedido;
//  · un solo pedido en vuelo por URL (dos pantallas que piden lo mismo comparten);
//  · caché SOLO EN MEMORIA con TTL por tipo de dato. Nada de esto se guarda en
//    el dispositivo: los tickers de una persona son datos de su portafolio
//    (ver buildSnapshot en utils/investValuation.js).
//  · changePct SIEMPRE en fracción (0,0123 = 1,23 %). /api/quote y /api/crypto
//    ya la mandan así; /api/marketbar la manda en puntos (×100) y aquí se
//    divide (inventario 01, punto 9).
//
// Privacidad de las URL: los endpoints son GET y llevan el ticker en la
// consulta (así funciona la caché del CDN). Es lo mismo que hace el puente de
// hoy y lo que dice invest.privacy ("solo se consultan los símbolos"). La
// excepción es /api/news: pedir noticias de los tickers propios mandaría la
// LISTA del portafolio en una sola URL (quedaría en los registros del servidor
// y del CDN), y el PLAN lo lista entre los errores de Invest que se corrigen.
// Por eso news() solo pide noticias del mercado general y rechaza `tickers`
// hasta que invest-web acepte la lista por POST (requisito de F6).
//
// El demo (demo.moyiq.app y app.moyiq.app/app/?demo=true) usa este mismo
// cliente a través de demo/demoMarketApi.js, con respaldo de ejemplo si algo
// falla. El desarrollo local (localhost) no está en la lista de orígenes de la
// API: ahí responde 403 y este cliente devuelve null.

export const INVEST_API_ORIGIN = (import.meta.env?.VITE_INVEST_URL || 'https://invest.moyiq.app').replace(/\/$/, '')

export const TICKER_RE = /^[\^A-Z0-9.\-=]{1,15}$/
const CRYPTO_RE = /^[A-Z0-9-]{1,15}$/
export const QUOTE_BATCH = 10
export const CRYPTO_BATCH = 30
export const FUND_BATCH = 10
export const HISTORY_RANGES = ['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y']
export const HISTORY_INTERVALS = ['1m', '5m', '15m', '1h', '1d', '1wk', '1mo']

const MIN = 60 * 1000
// TTL en memoria: nunca más largo que lo que el CDN ya cachea, salvo los tipos
// de cambio (Invest los guardaba 24 h en el navegador; aquí 1 h y en memoria).
export const TTL = {
  quote: 1 * MIN,
  crypto: 1 * MIN,
  history: 5 * MIN,
  marketbar: 3 * MIN,
  news: 15 * MIN,
  earnings: 4 * 60 * MIN,
  fundamentals: 60 * MIN,
  fxLatam: 60 * MIN,
  fxArs: 3 * 60 * MIN,
}
export const TIMEOUT = { default: 6000, history: 8000, news: 8000 }

export function normTicker(t) {
  const s = String(t ?? '').toUpperCase().trim()
  return TICKER_RE.test(s) ? s : null
}

const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))

// changePct a fracción. unit: 'fraction' (quote, crypto) o 'points' (marketbar).
export function normChangePct(v, unit = 'fraction') {
  const n = num(v)
  if (n == null) return null
  return unit === 'points' ? n / 100 : n
}

// Cotización de /api/quote o /api/crypto en una sola forma.
export function normalizeQuote(q, t) {
  if (!q || !(Number(q.price) > 0)) return null
  return {
    ticker: String(q.ticker || t || '').toUpperCase(),
    price: Number(q.price),
    prevClose: num(q.prevClose),
    change: num(q.change),
    changePct: normChangePct(q.changePct) ?? 0,
    volume: num(q.volume),
    high52: num(q.high52),
    low52: num(q.low52),
    currency: q.currency || null,
    marketTime: num(q.marketTime),
    tradingStart: num(q.tradingStart),
    tradingEnd: num(q.tradingEnd),
    delayedBy: num(q.delayedBy),
    timezone: q.timezone || null,
    // /api/quote no lo manda hoy (la ficha lo saca de la zona horaria); si
    // llega, se muestra tal cual.
    exchange: typeof q.exchange === 'string' && q.exchange.trim() ? q.exchange.trim().slice(0, 40) : null,
    fetchedAt: num(q.fetchedAt),
    source: q.source || null,
    name: q.name || q.shortName || null,
  }
}

function chunks(list, size) {
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

export function createInvestApi({ fetchImpl = (...a) => fetch(...a), now = () => Date.now(), origin = INVEST_API_ORIGIN } = {}) {
  const cache = new Map() // clave → { at, data }
  const inflight = new Map() // url → Promise
  let stats = { requests: 0, hits: 0, failures: 0 }

  function fresh(key, ttl) {
    const c = cache.get(key)
    if (c && now() - c.at < ttl) { stats.hits++; return c }
    return null
  }

  // GET con tope de tiempo y un solo pedido en vuelo por URL. null si falla.
  function getJson(path, timeoutMs = TIMEOUT.default) {
    const url = `${origin}${path}`
    if (inflight.has(url)) return inflight.get(url)
    const p = (async () => {
      stats.requests++
      const ctrl = typeof AbortController === 'function' ? new AbortController() : null
      const id = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null
      try {
        const res = await fetchImpl(url, ctrl ? { signal: ctrl.signal } : undefined)
        if (!res || !res.ok) { stats.failures++; return null }
        return await res.json()
      } catch { stats.failures++; return null } finally {
        if (id) clearTimeout(id)
        inflight.delete(url)
      }
    })()
    inflight.set(url, p)
    return p
  }

  // Valor único cacheado por clave (marketbar, fx, history, earnings, news).
  async function cached(key, ttl, path, timeoutMs, map = (d) => d) {
    const c = fresh(key, ttl)
    if (c) return c.data
    const raw = await getJson(path, timeoutMs)
    const data = raw == null ? null : map(raw)
    if (data != null) cache.set(key, { at: now(), data })
    return data
  }

  // Cotizaciones por ticker: lo que está fresco sale de la caché y el resto se
  // pide en lotes. Devuelve { TICKER: quote } solo con los que tienen precio.
  async function batched(kind, list, size, ttl, pathOf, re) {
    const tickers = [...new Set((list || []).map(t => String(t ?? '').toUpperCase().trim()).filter(t => re.test(t)))]
    const out = {}
    const missing = []
    for (const t of tickers) {
      const c = fresh(`${kind}:${t}`, ttl)
      if (c) { if (c.data) out[t] = c.data } else missing.push(t)
    }
    const replies = await Promise.all(chunks(missing, size).map(b => getJson(pathOf(b))))
    for (const data of replies) {
      for (const [t, q] of Object.entries(data || {})) {
        if (t === '_errors') continue
        const nq = normalizeQuote(q, t)
        if (!nq) continue
        const key = t.toUpperCase()
        cache.set(`${kind}:${key}`, { at: now(), data: nq })
        out[key] = nq
      }
    }
    return out
  }

  const enc = (b) => b.map(encodeURIComponent).join(',')

  return {
    quotes: (tickers) => batched('quote', tickers, QUOTE_BATCH, TTL.quote, (b) => `/api/quote?ticker=${enc(b)}`, TICKER_RE),
    crypto: (symbols) => batched('crypto', symbols, CRYPTO_BATCH, TTL.crypto, (b) => `/api/crypto?symbols=${enc(b)}`, CRYPTO_RE),
    // Una sola cotización (vista previa del buscador). null si no existe.
    async quote(ticker, { crypto = false } = {}) {
      const t = normTicker(ticker)
      if (!t) return null
      const r = crypto ? await this.crypto([t]) : await this.quotes([t])
      return r[t] || null
    },
    // Velas diarias: [{ date, ts (segundos UTC), open, high, low, close, volume }].
    history(ticker, range = '1y', interval = '1d') {
      const t = normTicker(ticker)
      if (!t || !HISTORY_RANGES.includes(range) || !HISTORY_INTERVALS.includes(interval)) return Promise.resolve(null)
      return cached(`history:${t}:${range}:${interval}`, TTL.history,
        `/api/history?ticker=${encodeURIComponent(t)}&range=${range}&interval=${interval}`, TIMEOUT.history,
        (d) => {
          const rows = (d?.data || []).filter(c => Number(c?.close) > 0).map(c => ({
            date: c.date, ts: Math.floor(Date.parse(`${c.date}T00:00:00Z`) / 1000),
            open: num(c.open), high: num(c.high), low: num(c.low), close: Number(c.close), volume: num(c.volume),
          })).filter(c => Number.isFinite(c.ts))
          return rows.length ? rows : null
        })
    },
    marketbar() {
      return cached('marketbar', TTL.marketbar, '/api/marketbar', TIMEOUT.default, (d) => ({
        items: (d?.items || []).map(it => ({
          sym: it.sym, label: it.label, price: num(it.price), change: num(it.change),
          changePct: normChangePct(it.changePct, 'points'), spark: Array.isArray(it.spark) ? it.spark.map(Number).filter(Number.isFinite) : [],
        })),
        missing: d?.missing || [],
        fetchedAt: d?.fetchedAt || null,
      }))
    },
    // Solo noticias del mercado general. Con `tickers` lanza: la lista del
    // portafolio no viaja en la URL (ver el encabezado).
    news(opts = {}) {
      if (opts && opts.tickers != null) throw new Error('news_tickers_need_post')
      return cached('news:', TTL.news, '/api/news', TIMEOUT.news, (d) => ({
        items: (d?.items || []).filter(it => it && it.title && /^https?:\/\//.test(String(it.link || ''))),
        fetchedAt: d?.fetchedAt || null,
        fallback: !!d?.fallback,
      }))
    },
    earnings(ticker) {
      const t = normTicker(ticker)
      if (!t) return Promise.resolve(null)
      return cached(`earnings:${t}`, TTL.earnings, `/api/earnings?ticker=${encodeURIComponent(t)}`)
    },
    // Fundamentales de hasta 10 tickers por pedido; { TICKER: {...} }.
    async fundamentals(tickers) {
      const list = [...new Set((tickers || []).map(normTicker).filter(Boolean))]
      const out = {}
      const missing = []
      for (const t of list) {
        const c = fresh(`fund:${t}`, TTL.fundamentals)
        if (c) out[t] = c.data; else missing.push(t)
      }
      const replies = await Promise.all(chunks(missing, FUND_BATCH).map(b => getJson(`/api/fundamentals?ticker=${enc(b)}`)))
      for (const d of replies) for (const [t, f] of Object.entries(d || {})) {
        if (!f || typeof f !== 'object' || t === '_errors') continue
        cache.set(`fund:${t}`, { at: now(), data: f })
        out[t] = f
      }
      return out
    },
    fxLatam: () => cached('fxLatam', TTL.fxLatam, '/api/fx-latam'),
    fxArs: () => cached('fxArs', TTL.fxArs, '/api/fx-ars'),
    // "Actualizar" a mano: olvida lo cacheado cuyas claves empiezan con alguno
    // de los prefijos ('marketbar', 'news:', 'history:SPY:'…), sin tocar el resto.
    forget(...prefixes) {
      for (const k of [...cache.keys()]) if (prefixes.some(p => k.startsWith(p))) cache.delete(k)
    },
    // Al cambiar de cuenta o para pruebas.
    clear() { cache.clear(); inflight.clear(); stats = { requests: 0, hits: 0, failures: 0 } },
    stats: () => ({ ...stats, cached: cache.size, inflight: inflight.size }),
  }
}

export const investApi = createInvestApi()
