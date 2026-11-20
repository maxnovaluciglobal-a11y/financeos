// src/utils/investQuoteMeta.js — frescura del precio y estado de la bolsa de la
// cabecera de la ficha (Invest: quoteFreshness de app/lib/readings.js,
// marketStatus y EXCHANGE_BY_TZ de app/lib/market.js, isNYSEOpen y
// marketStatusBadge de app/index.html). Puro: sin textos (la ficha los pone en
// su idioma), sin DOM ni red.
//
// q: cotización normalizada (core/investApi.js normalizeQuote):
//   marketTime (ms, hora del último precio según la fuente),
//   tradingStart / tradingEnd (ms, sesión regular del día), timezone, fetchedAt.

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

// Frescura: { state, minutes, time }.
//   offline → la última actualización falló (time: último precio o consulta)
//   closed  → fuera de la sesión regular (time: último precio)
//   live    → hasta 2 min de diferencia
//   delayed → N min de retraso
//   unknown → la fuente no informa la hora (time: hora de la consulta o null)
export function quoteFreshness(q, now = Date.now(), { failed = false } = {}) {
  const mt = q && isNum(q.marketTime) ? q.marketTime : null
  if (failed) return { state: 'offline', minutes: null, time: mt || (q && isNum(q.fetchedAt) ? q.fetchedAt : null) }
  if (!mt) return { state: 'unknown', minutes: null, time: q && isNum(q.fetchedAt) ? q.fetchedAt : null }
  const end = q && isNum(q.tradingEnd) ? q.tradingEnd : null
  const start = q && isNum(q.tradingStart) ? q.tradingStart : null
  if ((end && now > end) || (start && now < start)) return { state: 'closed', minutes: null, time: mt }
  const min = Math.max(0, Math.round((now - mt) / 60000))
  return min <= 2 ? { state: 'live', minutes: min, time: mt } : { state: 'delayed', minutes: min, time: mt }
}

// Bolsa por zona horaria de la cotización (Yahoo exchangeTimezoneName). La
// clave sale en el idioma de la ficha (asset.ex.<clave>).
export const EXCHANGE_BY_TZ = {
  'America/New_York': 'nyse',
  'America/Santiago': 'santiago',
  'America/Sao_Paulo': 'b3',
  'America/Mexico_City': 'bmv',
  'America/Argentina/Buenos_Aires': 'byma',
  'America/Buenos_Aires': 'byma',
  'America/Lima': 'bvl',
  'America/Bogota': 'bvc',
  'America/Toronto': 'tsx',
  'Europe/London': 'lse',
  'Europe/Madrid': 'bme',
}
export const EXCHANGE_KEYS = [...new Set(Object.values(EXCHANGE_BY_TZ))]

export function exchangeKey(tz) {
  return (tz && EXCHANGE_BY_TZ[tz]) || null
}

// Nueva York abierta: lunes a viernes 09:30–16:00, hora del Este. Sin feriados
// (igual que Invest): es el respaldo cuando la cotización no trae el horario.
export function isNYSEOpen(now = Date.now()) {
  let parts
  try {
    parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date(now))
  } catch { return false }
  const get = (type) => parts.find(p => p.type === type)?.value
  const wd = get('weekday')
  if (wd === 'Sat' || wd === 'Sun') return false
  const mins = Number(get('hour')) * 60 + Number(get('minute'))
  return mins >= 9 * 60 + 30 && mins < 16 * 60
}

// Acción o ETF de EE. UU.: sin sufijo de bolsa (.SN, .SA…) y en dólares.
export function isUsEquity(ticker, ccy) {
  const t = String(ticker || '').toUpperCase()
  return !!t && !/\.[A-Z]{1,3}$/.test(t) && !/-USD$/.test(t) && (ccy || 'USD') === 'USD'
}

// Estado de la bolsa: { exchange: clave|null, open } o null si no se sabe.
// Cripto opera todo el día: null. opts.usEquity usa Nueva York como respaldo.
export function marketStatus(q, now = Date.now(), { usEquity = false, crypto = false, nyOpen = isNYSEOpen } = {}) {
  if (crypto) return null
  const key = exchangeKey(q?.timezone)
  const hasHours = q && isNum(q.tradingStart) && isNum(q.tradingEnd) && q.tradingStart > 0 && q.tradingEnd > q.tradingStart
  if (hasHours) {
    const open = now >= q.tradingStart && now < q.tradingEnd
    return { exchange: key || (usEquity ? 'nyse' : null), open }
  }
  if (usEquity) return { exchange: 'nyse', open: !!nyOpen(now) }
  return null
}

// Clave de texto de la etiqueta de frescura (asset.fresh.*) y si lleva hora.
export function freshnessKey(f) {
  if (!f) return null
  if (f.state === 'unknown') return f.time ? 'asset.fresh.unknownAt' : 'asset.fresh.unknown'
  if (f.state === 'offline') return null // la ficha no guarda precios viejos: sin cotización no hay etiqueta
  return `asset.fresh.${f.state}`
}
// Tono de la etiqueta: al día en positivo, el resto neutro (Invest: freshTag).
export const freshnessTone = (f) => (f?.state === 'live' ? 'pos' : f?.state === 'offline' ? 'neg' : 'neu')
