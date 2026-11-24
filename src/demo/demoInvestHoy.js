// src/demo/demoInvestHoy.js — datos de ejemplo de la pestaña Hoy (F2).
//
// Salen de demoInvestRows (VOO, AAPL, BTC-USD, MSFT: valor 12.500, costo
// 11.000, hoy +50) para que Hoy, Portafolio y la tarjeta de Panorama digan lo
// mismo. Todo es ficticio y la pantalla lo rotula "Datos de ejemplo": no hay
// fuente ni hora de precios. Las series son deterministas (misma semilla por
// símbolo) y terminan EXACTAMENTE en el precio de ejemplo, así el gráfico
// acaba en la cifra de arriba. Nada se pide a la red ni se guarda.
import { demoInvestRows } from './demoInvest.js'
import { demoInvestOps } from './demoInvestBook.js'
import { RULE_DEFAULTS } from '../core/investData.js'

// Stops de ejemplo: dos posiciones con stop y dos sin (la columna existe).
const DEMO_STOPS = { VOO: 510, MSFT: 330 }
export const DEMO_CAPITAL = 20000
export const DEMO_WATCH = ['NVDA', 'QQQ']
export const DEMO_VIX = 16.4

export function demoHoldings() {
  return demoInvestRows().map((r, i) => ({ id: `demo-${i + 1}`, t: r.t, type: r.type, sh: r.sh, cost: r.avgCost, fxCost: null, stop: DEMO_STOPS[r.t] ?? null, note: '' }))
}

// Las posiciones de ejemplo con la forma de core/investData.js (solo lectura):
// el demo de Hoy usa el mismo camino que la app y precios reales.
export function demoHoyStore() {
  const ok = (data) => Promise.resolve({ ok: true, data })
  return {
    listHoldings: () => ok(demoHoldings()),
    listWatchlist: () => ok([...DEMO_WATCH]),
    getProfile: () => ok({ capital: DEMO_CAPITAL, rule: RULE_DEFAULTS }),
    listOperations: () => ok(demoOperations()),
    columns: () => ({ stop: true, fx: true }),
  }
}

export function demoQuotes() {
  const out = {}
  for (const r of demoInvestRows()) out[r.t] = { ticker: r.t, price: r.price, changePct: r.dayPct, currency: 'USD', name: r.name, sample: true }
  return out
}

// Operaciones: el MISMO libro que Portafolio (demoInvestOps: depósito de
// 12.000, compras, venta parcial de MSFT y dividendos). Antes Hoy tenía su
// propio libro (depósito de 11.500) y "Pusiste" decía 11.500 en Resumen y
// 12.000 en Portafolio (QA pre-tiendas 23-nov-2026, I2).
export function demoOperations(now = Date.now()) {
  return demoInvestOps(now)
}

// Perfil de cada símbolo: deriva diaria (+ sube con el tiempo) y volatilidad.
// MSFT baja (queda bajo sus dos medias), NVDA sube fuerte el último mes (RSI
// alto), SPY sube (tendencia alcista del mercado).
const PROFILE = {
  VOO: { drift: 0.0006, vol: 0.008 },
  AAPL: { drift: 0.0001, vol: 0.012 },
  'BTC-USD': { drift: 0.0012, vol: 0.03, weekends: true },
  MSFT: { drift: -0.0009, vol: 0.011 },
  NVDA: { drift: 0.0005, vol: 0.015, burst: 0.012 },
  QQQ: { drift: 0.0005, vol: 0.01 },
  SPY: { drift: 0.0006, vol: 0.008 },
  ECH: { drift: 0.0002, vol: 0.011 },
}
const LAST = { NVDA: 182, QQQ: 520, SPY: 600, ECH: 28.5 }

function seedOf(s) {
  return [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) || 1
}

// Cierres diarios de ejemplo de `days` días corridos que terminan en `end`
// (ms UTC, medianoche) con el último cierre = `last`. { ts (s), date, close }.
export function demoCloses(sym, { days = 366, end = todayUtc(), last = null } = {}) {
  const p = PROFILE[sym] || { drift: 0.0003, vol: 0.01 }
  let seed = seedOf(sym)
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }
  const out = []
  let px = last ?? priceOf(sym) ?? 100
  for (let i = 0; i < days; i++) {
    const d = new Date(end - i * 86400000)
    const wd = d.getUTCDay()
    if (!p.weekends && (wd === 0 || wd === 6)) continue
    out.push({ ts: Math.floor(d.getTime() / 1000), date: d.toISOString().slice(0, 10), close: Math.round(px * 100) / 100 })
    const burst = p.burst && i < 22 ? p.burst : 0
    px = px / (1 + p.drift + burst + (rnd() - 0.5) * 2 * p.vol)
  }
  return out.reverse()
}

function priceOf(sym) {
  const r = demoInvestRows().find(x => x.t === sym)
  return r ? r.price : LAST[sym] ?? null
}
export function todayUtc(now = Date.now()) {
  const d = new Date(now)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

// Historia de ejemplo por pedido (mismos rangos que la API).
export function demoHistory(sym, range = '1y', end = todayUtc()) {
  const days = range === '5y' ? 5 * 366 : range === '1mo' ? 31 : 366
  return demoCloses(sym, { days, end })
}

// Cinta de ejemplo: valores redondos y sus 22 cierres del último mes.
const STRIP = [
  ['^GSPC', 6000, 0.004], ['^DJI', 44000, 0.002], ['^IXIC', 19500, 0.006], ['^RUT', 2300, -0.003],
  ['CL=F', 70, -0.011], ['GC=F', 2650, 0.003], ['SI=F', 31, 0.005], ['EURUSD=X', 1.08, -0.001],
  ['^TNX', 4.3, 0.002], ['BTC-USD', 84000, 0.012],
]
export function demoMarket(end = todayUtc()) {
  return {
    items: [
      ...STRIP.map(([sym, price, changePct]) => ({ sym, price, changePct, spark: demoCloses(sym, { days: 31, end, last: price }).map(r => r.close) })),
      { sym: '^VIX', price: DEMO_VIX, changePct: -0.02, spark: [] },
    ],
    sample: true,
  }
}
