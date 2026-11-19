// src/utils/investValuation.js — valor del portafolio de Invest, lógica pura.
//
// Copia en ES modules de `invest-web/app/lib/fx.js` (portfolioTotals y lo que
// necesita): las dos apps tienen que dar la misma cifra para el mismo
// portafolio. Si cambia allá, cambia acá; investValuation.test.js repite sus
// casos. Reglas heredadas:
//  · /api/quote devuelve cada precio en la moneda de su bolsa (SQM-B.SN en CLP,
//    PETR4.SA en BRL). Todo agregado va en USD.
//  · Sin tipo de cambio REAL para su moneda, la posición queda fuera de los
//    totales y la UI dice cuántas. NUNCA se cuenta 1:1, y las tasas de respaldo
//    de /api/fx-latam (sources[ccy] === 'fallback') no convierten activos.
//  · Sin precio, la posición suma a su costo y no entra en "Hoy".

const SUFFIX_CCY = { SN: 'CLP', SA: 'BRL', MX: 'MXN', BA: 'ARS', LM: 'PEN', CL: 'COP' }

function normCcy(c) {
  if (c == null) return null
  const s = String(c).trim()
  if (!s) return null
  // Peniques y agorot no son la moneda mayor: no se convierten con la tasa de GBP/ILS.
  if (s === 'GBp' || s === 'ILA' || s === 'ZAc') return s
  return s.toUpperCase()
}

// La moneda de la cotización manda; sin cotización, el sufijo del ticker. Sin
// sufijo, USD. Sufijo desconocido, null (fuera de los agregados).
export function currencyOf(ticker, quoteCcy) {
  const q = normCcy(quoteCcy)
  if (q) return q
  const m = /\.([A-Z]{1,3})$/.exec(String(ticker || '').toUpperCase().trim())
  if (!m) return 'USD'
  return SUFFIX_CCY[m[1]] || null
}

export function rateOf(ccy, rates) {
  const c = normCcy(ccy)
  if (!c) return null
  if (c === 'USD') return 1
  const r = rates ? Number(rates[c]) : NaN
  return Number.isFinite(r) && r > 0 ? r : null
}

function fxCostOf(h) {
  const f = h ? Number(h.fxCost) : NaN
  return h && h.fxCost != null && Number.isFinite(f) && f > 0 ? f : null
}

export function portfolioTotals(port, liveOf, ccyOf, rates) {
  let value = 0, cost = 0, day = 0, priced = 0, excluded = 0, counted = 0
  for (const h of port || []) {
    const ccy = ccyOf ? ccyOf(h.t) : currencyOf(h.t)
    const r = rateOf(ccy, rates)
    if (r == null) { excluded++; continue }
    counted++
    const conv = (v) => (r === 1 ? v : v / r)
    const lq = liveOf ? liveOf(h.t) : null
    const px = lq && lq.price > 0 ? lq.price : null
    // El costo va al tipo de cambio de la compra si se conoce (FIN-12).
    const fc = r === 1 ? null : fxCostOf(h)
    cost += fc ? (h.sh * h.cost) / fc : conv(h.sh * h.cost)
    value += conv(h.sh * (px || h.cost))
    if (px) {
      priced++
      const cp = lq.changePct || 0
      const prev = px / (1 + cp)
      day += conv(h.sh * (px - prev))
    }
  }
  return {
    value, cost, day, priced, excluded,
    total: value - cost,
    totalPct: cost > 0 ? (value - cost) / cost : 0,
    dayPct: (value - day) > 0 ? day / (value - day) : 0,
    missing: counted - priced,
  }
}

// Solo tasas reales: lo mismo que fxAssetFrom() de Invest.
export function realRates(rates, sources) {
  const out = {}
  for (const c of Object.keys(rates || {})) if (!sources || sources[c] !== 'fallback') out[c] = rates[c]
  return out
}

// El peso argentino va al dólar MEP y, sin MEP, al oficial si es real (UXP-8).
// Invest deja elegir el oficial por dispositivo; esa preferencia no se puede
// leer desde acá y se usa su valor por defecto.
export function arsRate(mep, oficial) {
  const m = mep ? Number(mep.rate) : NaN
  if (Number.isFinite(m) && m > 0) return m
  const o = Number(oficial)
  return oficial != null && Number.isFinite(o) && o > 0 ? o : null
}

// Fila de `portfolio_holdings` → la forma que usa Invest (rowToHolding).
export function holdingFromRow(r) {
  const fx = Number(r?.fx_at_cost)
  return {
    t: String(r?.ticker || '').toUpperCase().trim(),
    type: r?.asset_type || '',
    sh: Number(r?.shares) || 0,
    cost: Number(r?.avg_cost) || 0,
    fxCost: r?.fx_at_cost != null && fx > 0 ? fx : null,
  }
}

const QUOTE_TICKER = /^[\^A-Z0-9.\-=]{1,15}$/
const CRYPTO_TICKER = /^[A-Z0-9-]{1,15}$/
export const QUOTE_BATCH = 10
export const CRYPTO_BATCH = 30

function chunks(list, size) {
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

// Qué pedir y a qué API: las posiciones "Crypto" van por CoinGecko y el resto
// por Yahoo, en trozos que cada API acepta. Un ticker que la API rechazaría
// haría fallar el lote entero: queda fuera y esa posición suma a su costo.
export function quoteBatches(holdings) {
  const stocks = new Set(), crypto = new Set()
  for (const h of holdings || []) {
    if (h.type === 'Crypto') { if (CRYPTO_TICKER.test(h.t)) crypto.add(h.t) }
    else if (QUOTE_TICKER.test(h.t)) stocks.add(h.t)
  }
  return { stocks: chunks([...stocks], QUOTE_BATCH), crypto: chunks([...crypto], CRYPTO_BATCH) }
}

// Una fila por posición para la pantalla de Inversiones (solo en memoria: nunca
// se guarda en el dispositivo, ver buildSnapshot). Mismas reglas que
// portfolioTotals, así la suma de las filas da el total de la tarjeta:
//  · status 'nofx': sin tipo de cambio real → sin cifras en USD, fuera del total.
//  · status 'cost': sin precio → vale su costo, sin ganancia ni "Hoy".
//  · status 'live': con precio.
// `weight` es la parte del valor contado (0–1). Orden: mayor valor primero.
export function holdingRows(holdings, quotes = {}, rates = {}) {
  const rows = (holdings || []).map((h) => {
    const q = quotes[h.t] || null
    const ccy = currencyOf(h.t, q?.currency)
    const r = rateOf(ccy, rates)
    const px = q && q.price > 0 ? q.price : null
    const base = { t: h.t, type: h.type || '', sh: h.sh, ccy, avgCost: h.cost, price: px, name: q?.name || q?.shortName || null }
    if (r == null) return { ...base, status: 'nofx', valueUsd: null, costUsd: null, plUsd: null, plPct: null, dayUsd: null, dayPct: null }
    const conv = (v) => (r === 1 ? v : v / r)
    const fc = r === 1 ? null : fxCostOf(h)
    const costUsd = fc ? (h.sh * h.cost) / fc : conv(h.sh * h.cost)
    const valueUsd = conv(h.sh * (px || h.cost))
    if (!px) return { ...base, status: 'cost', valueUsd, costUsd, plUsd: null, plPct: null, dayUsd: null, dayPct: null }
    const cp = q.changePct || 0
    const dayUsd = conv(h.sh * (px - px / (1 + cp)))
    return {
      ...base,
      status: 'live',
      valueUsd,
      costUsd,
      plUsd: valueUsd - costUsd,
      plPct: costUsd > 0 ? (valueUsd - costUsd) / costUsd : null,
      dayUsd,
      dayPct: cp,
    }
  })
  const counted = rows.reduce((a, r) => a + (r.valueUsd || 0), 0)
  for (const r of rows) r.weight = counted > 0 && r.valueUsd != null ? r.valueUsd / counted : null
  return rows.sort((a, b) => (b.valueUsd ?? -1) - (a.valueUsd ?? -1))
}

// Reparto del valor contado por tipo de activo (Acción, ETF, Crypto, …).
export function allocationByType(rows) {
  const by = new Map()
  let total = 0
  for (const r of rows || []) {
    if (r.valueUsd == null) continue
    const k = r.type || 'Otro'
    by.set(k, (by.get(k) || 0) + r.valueUsd)
    total += r.valueUsd
  }
  return [...by.entries()]
    .map(([type, valueUsd]) => ({ type, valueUsd, share: total > 0 ? valueUsd / total : 0 }))
    .sort((a, b) => b.valueUsd - a.valueUsd)
}

export const SNAPSHOT_VERSION = 1

// Lo único que se guarda en el dispositivo: totales, sin tickers ni posiciones.
// status: 'empty' sin posiciones · 'nofx' ninguna convertible · 'cost' sin
// ningún precio de mercado (valor al costo) · 'live' con precios.
export function buildSnapshot({ uid = null, holdings, quotes = {}, rates = {}, ratesAt = null, now = Date.now() }) {
  const liveOf = (t) => quotes[t] || null
  const ccyOf = (t) => currencyOf(t, quotes[t]?.currency)
  const T = portfolioTotals(holdings, liveOf, ccyOf, rates)
  const positions = (holdings || []).length
  const counted = positions - T.excluded
  const status = positions === 0 ? 'empty' : counted === 0 ? 'nofx' : T.priced === 0 ? 'cost' : 'live'
  const pricedList = (holdings || []).filter(h => quotes[h.t]?.price > 0 && rateOf(ccyOf(h.t), rates) != null)
  // "Al" honesto: la hora del precio más viejo que entró en la suma.
  const times = pricedList.map(h => Number(quotes[h.t].marketTime)).filter(n => Number.isFinite(n) && n > 0)
  const live = status === 'live'
  return {
    v: SNAPSHOT_VERSION,
    uid,
    at: now,
    status,
    positions,
    priced: T.priced,
    missing: T.missing,
    excluded: T.excluded,
    valueUsd: counted > 0 ? T.value : null,
    costUsd: counted > 0 ? T.cost : null,
    dayUsd: live ? T.day : null,
    dayPct: live ? T.dayPct : null,
    totalUsd: live && T.cost > 0 ? T.total : null,
    totalPct: live && T.cost > 0 ? T.totalPct : null,
    pricesAt: times.length ? Math.min(...times) : null,
    yahoo: pricedList.some(h => h.type !== 'Crypto'),
    coingecko: pricedList.some(h => h.type === 'Crypto'),
    fx: { rates, at: ratesAt },
  }
}
