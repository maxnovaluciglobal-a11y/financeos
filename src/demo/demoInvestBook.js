// src/demo/demoInvestBook.js — Portafolio de ejemplo para el demo (F1).
//
// El demo no tiene sesión ni servidor, y la API de mercado no acepta su
// origen. Esta "tienda" tiene la misma forma que core/investData.js pero vive
// solo en memoria: se puede agregar, editar y borrar para probar, y nada se
// guarda (se pierde al recargar). La pantalla lo dice con "Datos de ejemplo".
// Las posiciones son las de demoInvestRows (misma cifra que la tarjeta de
// Panorama: valor 12.500, costo 11.000, hoy +50) y el libro es coherente con
// ellas: un depósito, las cuatro compras, una venta parcial de MSFT y
// dividendos trimestrales de VOO y AAPL.
import { demoInvestRows } from './demoInvest.js'
import { DEFAULT_USD_RATES } from '../pages/shared/constants.js'

const ISO = (d) => d.toISOString().slice(0, 10)
// Nunca una fecha futura (el día 12 del mes actual, visto el día 5).
function monthsAgo(now, m, day = 15) {
  const d = new Date(now)
  const iso = ISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - m, day)))
  const today = ISO(d)
  return iso > today ? today : iso
}

export function demoInvestHoldings() {
  return demoInvestRows().map((r, i) => ({ id: `demo-${i + 1}`, t: r.t, type: r.type, sh: r.sh, cost: r.avgCost, stop: r.t === 'VOO' ? 500 : null, fxCost: null, note: '' }))
}

export function demoInvestQuotes() {
  const out = {}
  for (const r of demoInvestRows()) out[r.t] = { ticker: r.t, price: r.price, changePct: r.dayPct, currency: 'USD', name: r.name, sample: true }
  return out
}

// Rendimientos por dividendo de ejemplo (fracción), como /api/fundamentals.
export function demoInvestFundamentals() {
  return { VOO: { dividendYield: 0.013 }, AAPL: { dividendYield: 0.005 }, MSFT: { dividendYield: 0.008 }, 'BTC-USD': { dividendYield: null } }
}

export function demoInvestOps(now = Date.now()) {
  let id = 0
  const op = (type, ticker, date, f = {}) => ({
    id: ++id, uid: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`, type, ticker, date, currency: 'USD',
    price: null, qty: null, amount: 0, fx: null, pnl: null, rsi: null, note: '', cash: null, reinvested: false, edited: false, source: null, synced: true, ...f,
  })
  const buy = (t, date, qty, price, rsi = null) => op('buy', t, date, { qty, price, amount: qty * price, cash: true, rsi })
  const divs = []
  for (const m of [1, 4, 7, 10]) divs.push(op('dividend', 'VOO', monthsAgo(now, m, 28), { amount: 17.5 }))
  for (const m of [0, 3, 6, 9]) divs.push(op('dividend', 'AAPL', monthsAgo(now, m, 12), { amount: 3 }))
  return [
    op('deposit', null, monthsAgo(now, 12, 2), { amount: 12000 }),
    buy('VOO', monthsAgo(now, 12, 3), 12, 450, 48),
    buy('AAPL', monthsAgo(now, 11, 5), 12, 200, 41),
    buy('BTC-USD', monthsAgo(now, 10, 8), 0.025, 64000),
    buy('MSFT', monthsAgo(now, 9, 9), 5, 400, 55),
    op('sell', 'MSFT', monthsAgo(now, 2, 18), { qty: 1, price: 380, amount: 380, cash: true, pnl: -20 }),
    ...divs,
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id))
}

// Tipos de cambio de ejemplo (los fijos de moyiq), marcados como respaldo:
// mostrar en otra moneda sí, convertir activos no (todos los del demo son USD).
export function demoInvestFx() {
  const rates = { ...DEFAULT_USD_RATES }
  delete rates.USD
  return { rates, sources: Object.fromEntries(Object.keys(rates).map(k => [k, 'fallback'])), updatedAt: null }
}

export function createDemoInvestStore({ now = Date.now } = {}) {
  let holdings = demoInvestHoldings()
  let ops = demoInvestOps(now())
  let capital = null
  let next = 100
  const ok = (data) => Promise.resolve({ ok: true, data })
  return {
    demo: true,
    columns: () => ({ stop: true, fx: true }),
    listHoldings: () => ok(holdings.map(h => ({ ...h }))),
    async addHolding(input) {
      const h = { stop: null, fxCost: null, note: '', ...input, id: `demo-${++next}`, t: String(input.t).toUpperCase().trim() }
      holdings = [...holdings, h]
      return { ok: true, data: h }
    },
    async updateHolding(prev, input) {
      const h = { ...prev, ...input, id: prev.id, t: prev.t }
      holdings = holdings.map(x => (x.id === prev.id ? h : x))
      return { ok: true, data: h }
    },
    async setStop(prev, stop) { return this.updateHolding(prev, { stop }) },
    async deleteHolding(id) { holdings = holdings.filter(h => h.id !== id); return { ok: true, data: { id } } },
    listOperations: () => ok(ops.map(o => ({ ...o }))),
    async saveOperations(list) {
      const arr = Array.isArray(list) ? list : [list]
      const uids = new Set(arr.map(o => o.uid))
      ops = [...ops.filter(o => !uids.has(o.uid)), ...arr.map(o => ({ ...o, synced: true }))]
      return { ok: true, data: { saved: [...uids], failed: [] } }
    },
    async deleteOperations(uids) { const s = new Set(uids); ops = ops.filter(o => !s.has(o.uid)); return { ok: true, data: { deleted: [...s] } } },
    listWatchlist: () => ok([]),
    getProfile: () => ok({ capital, rule: { risk: 2, limit: 25 } }),
    async setCapital(v) { capital = Number(v) > 0 ? Number(v) : null; return { ok: true, data: { capital } } },
    clear() { holdings = demoInvestHoldings(); ops = demoInvestOps(now()); capital = null },
  }
}
