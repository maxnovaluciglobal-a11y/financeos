// src/utils/investDividends.js — dividendos de los próximos 12 meses (F1), puro.
//
// Error de Invest corregido al pasarlo: Invest calculaba dividendRate =
// anual / 4 y la frecuencia como anual / dividendRate, que SIEMPRE daba 4
// ("Trimestral"), y repartía el ingreso en el mes actual, +3, +6 y +9: meses
// inventados. Aquí la frecuencia y los meses salen de datos reales:
//  1. de la fuente, si /api/fundamentals los informa (payMonths o
//     dividendFrequency; hoy Finnhub/FMP no los mandan, pero el cliente ya los
//     lee si llegan);
//  2. si no, de los dividendos que la persona registró en Movimientos en los
//     últimos 12 meses (meses de pago y cantidad de pagos);
//  3. si no hay ninguno, la frecuencia queda "sin dato" y ese ingreso NO se
//     reparte en meses: se informa aparte, como monto anual sin calendario.
// El monto anual sigue siendo el rendimiento por dividendo que informa la
// fuente × el precio × las unidades (en la moneda del activo, pasado a USD).
const DAY = 86400000

// Frecuencia por cantidad de pagos en 12 meses.
export function freqFromCount(n) {
  if (n >= 11) return 'monthly'
  if (n >= 3 && n <= 5) return 'quarterly'
  if (n === 2) return 'semiannual'
  if (n === 1) return 'annual'
  return n > 0 ? 'irregular' : 'unknown'
}
const API_FREQ = { monthly: 'monthly', quarterly: 'quarterly', 'semi-annual': 'semiannual', semiannual: 'semiannual', annual: 'annual', annually: 'annual', 12: 'monthly', 4: 'quarterly', 2: 'semiannual', 1: 'annual' }

const ym = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`

// Calendario de pagos de un ticker: { freq, months: [1..12] | null, source }.
export function scheduleFor(t, fund, ops, now = Date.now()) {
  const apiMonths = Array.isArray(fund?.payMonths) ? [...new Set(fund.payMonths.map(Number).filter(m => m >= 1 && m <= 12))].sort((a, b) => a - b) : []
  const apiFreq = API_FREQ[String(fund?.dividendFrequency ?? '').toLowerCase()] || null
  if (apiMonths.length) return { freq: apiFreq || freqFromCount(apiMonths.length), months: apiMonths, source: 'api' }
  const since = now - 366 * DAY
  const paid = (ops || []).filter(o => o.type === 'dividend' && o.ticker === t && o.date && Date.parse(`${o.date}T00:00:00Z`) >= since && Date.parse(`${o.date}T00:00:00Z`) <= now)
  if (paid.length) {
    const months = [...new Set(paid.map(o => Number(o.date.slice(5, 7))))].sort((a, b) => a - b)
    // Pagos distintos: un mismo mes cuenta una vez (DRIP + efectivo del mismo pago).
    const n = new Set(paid.map(o => o.date.slice(0, 7))).size
    return { freq: freqFromCount(n), months, source: 'history' }
  }
  if (apiFreq) return { freq: apiFreq, months: null, source: 'api' }
  return { freq: 'unknown', months: null, source: null }
}

// rows: positionRows(...).rows · fundamentals: { T: { dividendYield, ... } }
// (los tickers sin respuesta no están) · ops: libro · toUsd(monto, moneda).
export function projectDividends({ rows, fundamentals = {}, ops = [], toUsd, now = Date.now() }) {
  // Una fila por ticker: los lotes se suman.
  const byT = new Map()
  for (const r of rows || []) {
    const b = byT.get(r.t) || { t: r.t, sh: 0, ccy: r.ccy, price: r.price ?? r.avgCost, valueUsd: 0, counted: r.valueUsd != null }
    b.sh += Number(r.sh) || 0
    b.valueUsd += r.valueUsd || 0
    byT.set(r.t, b)
  }
  const out = []
  let total = 0, noReply = 0, excluded = 0, valueUsd = 0
  for (const b of byT.values()) {
    if (b.counted) valueUsd += b.valueUsd
    const f = fundamentals[b.t]
    if (!f) { noReply++; continue }
    const dy = Number(f.dividendYield)
    if (!(dy > 0) || !(b.price > 0)) continue
    const perShareYear = dy * b.price
    const annualUsd = toUsd(perShareYear * b.sh, b.ccy)
    if (annualUsd == null) { excluded++; continue }
    total += annualUsd
    const sch = scheduleFor(b.t, f, ops, now)
    out.push({ t: b.t, sh: b.sh, ccy: b.ccy, perShareYear, annualUsd, yieldPct: dy, ...sch })
  }
  out.sort((a, b) => b.annualUsd - a.annualUsd)

  // Próximos 12 meses desde el actual: solo lo que tiene meses de pago reales.
  const start = new Date(now)
  const months = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1))
    months.push({ ym: ym(d), month: d.getUTCMonth() + 1, usd: 0, tickers: [] })
  }
  let unscheduled = 0
  for (const r of out) {
    if (!r.months?.length) { unscheduled += r.annualUsd; continue }
    const per = r.annualUsd / r.months.length
    for (const m of months) if (r.months.includes(m.month)) { m.usd += per; m.tickers.push(r.t) }
  }
  return {
    rows: out,
    totalUsd: total,
    monthlyAvgUsd: total / 12,
    yieldPct: valueUsd > 0 ? total / valueUsd : null,
    months,
    scheduledUsd: total - unscheduled,
    unscheduledUsd: unscheduled,
    paying: out.length,
    positions: byT.size,
    noReply,
    excluded,
  }
}
