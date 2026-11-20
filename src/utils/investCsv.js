// src/utils/investCsv.js — importar y exportar el portafolio (F1), puro.
//
// Importar: copia de invest-web/app/lib/csv-import.js (mismos encabezados en
// español e inglés, separador , o ;, números "1.234,56" y "1,234.56"). Los
// errores salen como códigos para traducirlos en la pantalla.
//
// Exportar (errores de Invest corregidos al pasarlos):
//  · Toda celda pasa por csvSafe (DAT-15): un ticker o una nota que empieza
//    con = + - @ no se ejecuta como fórmula en Excel o Sheets.
//  · Nunca se mezclan monedas: Invest sumaba en la fila TOTAL el costo nativo
//    de una acción chilena (CLP) con el de una de EE. UU. (USD). Aquí cada fila
//    lleva su moneda; Entrada y Precio van en la moneda del activo y las
//    columnas de valor, resultado y peso van en USD (tipo de cambio de compra
//    para el costo, el mismo de la pantalla), y el TOTAL solo suma USD.
//  · Las filas sin tipo de cambio quedan con las columnas USD vacías y
//    "sin tipo de cambio": no entran al total.
import { csvCell, toCsv } from './csvSafe.js'

const COLS = {
  t: ['ticker', 'simbolo', 'símbolo', 'symbol', 'activo', 'asset'],
  sh: ['unidades', 'cantidad', 'acciones', 'shares', 'quantity', 'qty', 'units', 'anteile', 'stück', 'quantidade'],
  cost: ['entrada', 'precio de entrada', 'costo', 'costo promedio', 'precio', 'avg_cost', 'avg cost', 'cost', 'price', 'entry', 'einstand', 'preço médio'],
  type: ['tipo', 'type', 'asset_type', 'clase', 'typ'],
  stop: ['stop', 'stop loss'],
  fxCost: ['tipo de cambio de compra', 'fx at cost', 'fx_at_cost', 'câmbio da compra', 'wechselkurs beim kauf'],
}
const TYPES = { stock: 'Stock', accion: 'Stock', 'acción': 'Stock', aktie: 'Stock', 'ação': 'Stock', etf: 'ETF', crypto: 'Crypto', cripto: 'Crypto', krypto: 'Crypto', bond: 'Bond', bono: 'Bond' }
// Como Invest, pero sin empezar por = - (un "ticker" =CMD es una fórmula, no un activo).
const TICKER_RE = /^[A-Z0-9^][A-Z0-9.\-^=]{0,14}$/
export const IMPORT_MAX_ROWS = 200

export function splitLine(line, sep) {
  const out = []
  let cur = '', q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === sep) { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  // Una celda que exportamos con apóstrofo de protección ('=X) vuelve sin él.
  return out.map(s => s.trim().replace(/^'(?=[=+\-@])/, ''))
}

// "1.234,56" → 1234.56 · "1,234.56" → 1234.56 · "$172.50" → 172.5
export function parseNum(s) {
  if (s == null) return NaN
  let v = String(s).replace(/[^0-9,.-]/g, '')
  if (!v) return NaN
  const lc = v.lastIndexOf(','), ld = v.lastIndexOf('.')
  if (lc > ld) v = v.replace(/\./g, '').replace(',', '.')
  else v = v.replace(/,/g, '')
  return parseFloat(v)
}

// → { rows: [{ t, type, sh, cost, stop?, fxCost? }], errors: [{ code, line?, value? }] }
// codes: empty · missing_columns · no_rows · ticker · shares · cost · too_many
export function parseHoldingsCsv(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim())
  if (!lines.length) return { rows: [], errors: [{ code: 'empty' }] }
  const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ','
  const head = splitLine(lines[0], sep).map(h => h.toLowerCase().replace(/\s*\([^)]*\)\s*$/, '').trim())
  const idx = {}
  for (const k of Object.keys(COLS)) idx[k] = head.findIndex(h => COLS[k].includes(h))
  if (idx.t < 0 || idx.sh < 0 || idx.cost < 0) return { rows: [], errors: [{ code: 'missing_columns' }] }
  const rows = [], errors = []
  for (let i = 1; i < lines.length; i++) {
    const c = splitLine(lines[i], sep)
    const t = String(c[idx.t] || '').toUpperCase().replace(/\s+/g, '')
    if (!t || t === 'TOTAL') continue
    if (!TICKER_RE.test(t)) { errors.push({ code: 'ticker', line: i + 1, value: t.slice(0, 20) }); continue }
    const sh = parseNum(c[idx.sh])
    const cost = parseNum(c[idx.cost])
    if (!(sh > 0)) { errors.push({ code: 'shares', line: i + 1 }); continue }
    if (!(cost > 0)) { errors.push({ code: 'cost', line: i + 1 }); continue }
    const type = idx.type >= 0 ? TYPES[String(c[idx.type] || '').toLowerCase()] || 'Stock' : 'Stock'
    const row = { t, type, sh, cost }
    if (idx.stop >= 0) { const st = parseNum(c[idx.stop]); if (st > 0) row.stop = st }
    if (idx.fxCost >= 0) { const fx = parseNum(c[idx.fxCost]); if (fx > 0) row.fxCost = fx }
    rows.push(row)
    if (rows.length > IMPORT_MAX_ROWS) return { rows: rows.slice(0, IMPORT_MAX_ROWS), errors: [...errors, { code: 'too_many' }] }
  }
  if (!rows.length && !errors.length) errors.push({ code: 'no_rows' })
  return { rows, errors }
}

const r2 = (n) => (n == null || !Number.isFinite(n) ? '' : Math.round(n * 100) / 100)
const r6 = (n) => (n == null || !Number.isFinite(n) ? '' : Math.round(n * 1e6) / 1e6)
const BOM = '\uFEFF'

// rows: positionRows(...).rows (utils/investPositions.js). labels: encabezados
// traducidos { ticker, type, ccy, shares, entry, price, value, pnl, ret, weight,
// stop, fxCost, total, noFx }.
export function holdingsCsv(rows, labels) {
  const L = labels
  const head = [L.ticker, L.type, L.ccy, L.shares, L.entry, L.price, L.stop, L.fxCost, `${L.value} (USD)`, `${L.pnl} (USD)`, `${L.ret} %`, `${L.weight} %`]
  const body = (rows || []).map(r => [
    r.t, r.type || '', r.ccy || '', r6(r.sh), r6(r.avgCost), r.price != null ? r6(r.price) : '', r.stop != null ? r6(r.stop) : '', r.fxCost != null ? r6(r.fxCost) : '',
    r.valueUsd != null ? r2(r.valueUsd) : L.noFx, r.plUsd != null ? r2(r.plUsd) : '', r.plPct != null ? r2(r.plPct * 100) : '', r.weight != null ? r2(r.weight * 100) : '',
  ])
  const counted = (rows || []).filter(r => r.valueUsd != null)
  const tv = counted.reduce((a, r) => a + r.valueUsd, 0)
  const tc = counted.reduce((a, r) => a + (r.costUsd || 0), 0)
  const total = ['TOTAL', '', 'USD', '', '', '', '', '', r2(tv), r2(tv - tc), tc > 0 ? r2(((tv - tc) / tc) * 100) : '', counted.length ? 100 : '']
  return BOM + toCsv([head, ...body, total])
}

// ops: operaciones del libro. labels: { id, date, ticker, type, ccy, price,
// qty, amount, fx, pnl, rsi, note, cash, reinvested, edited, source, yes, no,
// types: { buy, sell, ... } }.
export function operationsCsv(ops, labels) {
  const L = labels
  const yn = (v) => (v == null ? '' : v ? L.yes : L.no)
  const head = [L.id, L.date, L.ticker, L.type, L.ccy, L.price, L.qty, L.amount, L.fx, L.pnl, L.rsi, L.note, L.cash, L.reinvested, L.edited, L.source]
  const body = (ops || []).map(o => [
    o.id ?? '', o.date || '', o.ticker || '', L.types?.[o.type] || o.type, o.currency || '', o.price != null ? r6(o.price) : '', o.qty != null ? r6(o.qty) : '',
    r6(Number(o.amount) || 0), o.fx != null ? r6(o.fx) : '', o.pnl != null ? r2(o.pnl) : '', o.rsi != null ? r2(o.rsi) : '', o.note || '',
    yn(o.cash), o.type === 'dividend' ? yn(!!o.reinvested) : '', yn(!!o.edited), o.source || '',
  ])
  return BOM + toCsv([head, ...body])
}

// ── Copia de seguridad JSON ──
// Lo que la persona tiene en Inversiones, para guardarla ella donde quiera.
// La app no la guarda en el dispositivo: solo la descarga.
export const BACKUP_KIND = 'moyiq-invest-backup'
export const BACKUP_VERSION = 1
export function buildBackup({ holdings = [], operations = [], watchlist = [], capital = null, targets = null, now = Date.now() } = {}) {
  return {
    kind: BACKUP_KIND,
    v: BACKUP_VERSION,
    exportedAt: new Date(now).toISOString(),
    holdings: holdings.map(h => ({ t: h.t, type: h.type || 'Stock', sh: h.sh, cost: h.cost, stop: h.stop ?? null, fxCost: h.fxCost ?? null, note: h.note || '' })),
    operations: operations.map(o => ({
      uid: o.uid, id: o.id, type: o.type, ticker: o.ticker || null, date: o.date, currency: o.currency || null, price: o.price ?? null, qty: o.qty ?? null,
      amount: Number(o.amount) || 0, fx: o.fx ?? null, pnl: o.pnl ?? null, rsi: o.rsi ?? null, note: o.note || '', cash: o.cash ?? null,
      reinvested: !!o.reinvested, edited: !!o.edited, source: o.source || null,
    })),
    watchlist: [...watchlist],
    capital: capital > 0 ? capital : null,
    targets: targets && typeof targets === 'object' ? { ...targets } : null,
  }
}
export function backupJson(data) {
  return JSON.stringify(buildBackup(data), null, 2)
}

// Restaurar: devuelve qué se puede traer sin duplicar. Las operaciones van por
// su uid (subirlas dos veces no duplica); las posiciones, solo las de tickers
// que todavía no están (para no sumar dos veces las mismas unidades).
// → { ok, error?, holdings, operations, skippedHoldings }
export function parseBackup(text, { existingTickers = [] } = {}) {
  let d
  try { d = JSON.parse(String(text || '')) } catch { return { ok: false, error: 'invalid_json' } }
  if (!d || d.kind !== BACKUP_KIND || d.v !== BACKUP_VERSION) {
    // Copia de Invest (invest.moyiq.app): { portfolio, trades, ... }.
    if (d && Array.isArray(d.portfolio)) {
      d = { holdings: d.portfolio.map(h => ({ t: h.t, type: h.type, sh: h.sh, cost: h.cost, stop: h.stop ?? null, fxCost: h.fxCost ?? null, note: h.note || '' })), operations: Array.isArray(d.trades) ? d.trades : [] }
    } else return { ok: false, error: 'not_backup' }
  }
  const have = new Set(existingTickers.map(t => String(t).toUpperCase()))
  const holdings = [], skipped = []
  for (const h of Array.isArray(d.holdings) ? d.holdings : []) {
    const t = String(h?.t || '').toUpperCase().trim()
    if (!TICKER_RE.test(t) || !(Number(h.sh) > 0) || !(Number(h.cost) >= 0)) continue
    if (have.has(t)) { skipped.push(t); continue }
    holdings.push({ t, type: TYPES[String(h.type || '').toLowerCase()] || (['Stock', 'ETF', 'Crypto', 'Bond'].includes(h.type) ? h.type : 'Stock'), sh: Number(h.sh), cost: Number(h.cost), stop: Number(h.stop) > 0 ? Number(h.stop) : null, fxCost: Number(h.fxCost) > 0 ? Number(h.fxCost) : null, note: String(h.note || '').slice(0, 500) })
  }
  const operations = (Array.isArray(d.operations) ? d.operations : []).filter(o => o && typeof o === 'object' && o.uid && o.type && o.date)
  // Objetivos de peso: solo tickers válidos y pesos de 0 a 100.
  let targets = null
  if (d.targets && typeof d.targets === 'object' && !Array.isArray(d.targets)) {
    const tg = {}
    for (const [k, v] of Object.entries(d.targets)) {
      const t = String(k).toUpperCase().trim(), n = Number(v)
      if (TICKER_RE.test(t) && Number.isFinite(n) && n >= 0 && n <= 100) tg[t] = n
    }
    if (Object.keys(tg).length) targets = tg
  }
  return { ok: true, holdings, operations, skippedHoldings: skipped, targets }
}

// Nombre de archivo con fecha local.
export function exportName(prefix, now = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${prefix}-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

export { csvCell }
