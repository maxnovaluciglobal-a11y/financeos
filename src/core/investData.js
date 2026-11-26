// src/core/investData.js — lectura Y escritura de los datos de Inversiones.
//
// Las tablas son las de Invest, en el mismo proyecto Supabase y con RLS por
// auth.uid() (inventario 06): portfolio_holdings, invest_operations, watchlist
// y profiles (capital). Todo pasa por `authClient` con la sesión de la persona;
// cada escritura filtra además por user_id, como Invest. Mismas reglas y
// validaciones que Invest (app/index.html: savePos, sbAddHolding,
// sbUpdateHolding, sbDeleteHolding, sbAddWatch, sbRmWatch, saveRuleSettings;
// app/lib/ledger.js: opToRow, rowToOp, isMissingTable) y que las restricciones
// de la tabla (invest-web/supabase/migrations/20261031120000_invest_operations.sql).
//
// PRIVACIDAD: nada de esto se guarda en el dispositivo. La caché es solo en
// memoria, por cuenta, y se vacía al cambiar de cuenta. Lo único que se guarda
// en el dispositivo sigue siendo el snapshot de TOTALES de investBridge.js.
//
// Regla de riesgo: Invest la guarda en el navegador (inv_rule_<uid>) porque
// `profiles` no tiene columnas para el riesgo ni el límite, y F0 no hace
// migraciones. Aquí va en los metadatos de la cuenta (auth.updateUser), donde
// ya vive el perfil de inversionista: sigue a la persona en cualquier
// dispositivo sin tocar el esquema. El capital sí va en profiles.capital.
// F5 (20-nov-2026, decisión de Walter): la clave es `invest_risk_rule` y el
// riesgo por defecto es 1 % (Invest usaba 2 %). Los planes guardados de
// Planificar van en `invest_plans` (utils/investPlan.js: topes de cantidad y
// tamaño, porque los metadatos viajan dentro del token de sesión).
//
// Respuestas: { ok: true, data } o { ok: false, error: '<código>', fields? }.
import { authClient } from './authClient.js'
import { holdingFromRowFull } from '../utils/investValuation.js'
import { logRejection } from '../utils/errorLog.js'
import { investApi } from './investApi.js'
import { currentInvestLimits, canAddMore, announceInvestLimit } from '../utils/investLimits.js'
import { PLANS_KEY, applyPlanChange, plansPayload, readPlans, validatePlans } from '../utils/investPlan.js'

export const TICKER_RE = /^[A-Z0-9.\-^=]{1,15}$/
export const ASSET_TYPES = ['Stock', 'ETF', 'Crypto', 'Bond']
export const OP_TYPES = ['buy', 'sell', 'deposit', 'withdrawal', 'dividend', 'bonus']
export const NOTE_MAX = 500
export const RULE_KEY = 'invest_risk_rule'
export const RULE_DEFAULTS = { risk: 1, limit: 25 }
// Clave de F0 (antes del 20-nov-2026): se lee si la nueva todavía no existe.
export const LEGACY_RULE_KEY = 'invest_rule'
export const HOLDING_COLUMNS = 'id,ticker,asset_type,shares,avg_cost,note,stop,fx_at_cost'
const HOLDING_BASE_COLUMNS = 'id,ticker,asset_type,shares,avg_cost,note'
export const OPERATION_COLUMNS = 'id,seq,type,ticker,op_date,currency,price,qty,amount,fx,pnl,rsi,note,cash,reinvested,edited,source'
const TIMEOUT_MS = 8000
const CACHE_MS = 30 * 1000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const toNum = (v) => {
  if (v == null || v === '') return NaN
  return typeof v === 'number' ? v : parseFloat(String(v).trim().replace(',', '.'))
}
const pos = (v) => { const n = toNum(v); return Number.isFinite(n) && n > 0 ? n : null }

// ── Validación (las mismas reglas que Invest) ──────────────────────
export function normTicker(t) {
  return String(t ?? '').toUpperCase().trim()
}

// input: { t, type, sh, cost, stop?, fxCost?, note? }. prev: la posición que
// se edita (o null en un alta). Costo 0 solo si la posición ya tenía 0 (nació
// de un bono). Stop y tipo de cambio de la compra son opcionales (> 0 o null).
export function validateHolding(input = {}, { prev = null, allowZeroCost = false } = {}) {
  const fields = {}
  const t = normTicker(prev ? prev.t : input.t)
  if (!t) fields.t = 'ticker_required'
  else if (!TICKER_RE.test(t)) fields.t = 'ticker_invalid'
  const type = input.type || 'Stock'
  if (!ASSET_TYPES.includes(type)) fields.type = 'type_invalid'
  const sh = toNum(input.sh)
  if (!(Number.isFinite(sh) && sh > 0)) fields.sh = 'shares_invalid'
  const cost = toNum(input.cost)
  // allowZeroCost: posición que nace de un bono o referido (Invest: applyTrade).
  const zeroOk = cost === 0 && (allowZeroCost || (prev && Number(prev.cost) === 0))
  if (!(Number.isFinite(cost) && (cost > 0 || zeroOk))) fields.cost = 'cost_invalid'
  const rawStop = input.stop
  const stop = rawStop == null || rawStop === '' ? null : pos(rawStop)
  if (rawStop != null && rawStop !== '' && stop == null) fields.stop = 'stop_invalid'
  const rawFx = input.fxCost
  const fxCost = rawFx == null || rawFx === '' ? null : pos(rawFx)
  if (rawFx != null && rawFx !== '' && fxCost == null) fields.fxCost = 'fx_invalid'
  const note = String(input.note ?? '').trim()
  if (note.length > NOTE_MAX) fields.note = 'note_too_long'
  if (Object.keys(fields).length) return { ok: false, error: 'invalid', fields }
  return { ok: true, value: { t, type, sh, cost, stop, fxCost, note } }
}

function holdingToRow(h, { stop = true, fx = true } = {}) {
  const row = { ticker: h.t, asset_type: h.type, shares: h.sh, avg_cost: h.cost, note: h.note || '' }
  if (stop) row.stop = h.stop > 0 ? h.stop : null
  if (fx) row.fx_at_cost = h.fxCost > 0 ? h.fxCost : null
  return row
}

// Columnas opcionales (stop: FA 20261011000000; fx_at_cost: IW 20261019160000).
// Si una base no las tiene, Invest reintenta sin ellas; aquí igual.
export function isColumnError(err, col) {
  const msg = String(err?.message || '') + ' ' + String(err?.details || '')
  if (!new RegExp(`\\b${col}\\b`, 'i').test(msg)) return false
  return /column|schema/i.test(msg + String(err?.code || '')) || err?.code === '42703' || err?.code === 'PGRST204'
}

// invest_operations todavía sin aplicar (ledger.js: isMissingTable).
export function isMissingTable(err) {
  if (!err) return false
  if (err.code === '42P01' || err.code === 'PGRST205' || err.code === 'PGRST202') return true
  return /invest_operations/i.test(String(err.message || '')) && /does not exist|schema cache/i.test(String(err.message || ''))
}

// Una operación del libro, con las restricciones de la tabla.
export function validateOperation(op = {}) {
  const fields = {}
  if (!UUID_RE.test(String(op.uid || ''))) fields.uid = 'uid_invalid'
  if (!OP_TYPES.includes(op.type)) fields.type = 'type_invalid'
  const cashOnly = op.type === 'deposit' || op.type === 'withdrawal'
  const t = op.ticker == null || op.ticker === '' ? null : normTicker(op.ticker)
  if (cashOnly && t) fields.ticker = 'ticker_not_allowed'
  if (!cashOnly && (!t || t.length > 32 || !TICKER_RE.test(t))) fields.ticker = t ? 'ticker_invalid' : 'ticker_required'
  if (!DATE_RE.test(String(op.date || '')) || Number.isNaN(Date.parse(`${op.date}T00:00:00Z`))) fields.date = 'date_invalid'
  for (const k of ['price', 'qty']) {
    if (op[k] != null && op[k] !== '' && !(toNum(op[k]) >= 0)) fields[k] = `${k}_invalid`
  }
  const amount = op.amount == null || op.amount === '' ? 0 : toNum(op.amount)
  if (!(amount >= 0)) fields.amount = 'amount_invalid'
  if (op.fx != null && op.fx !== '' && !(toNum(op.fx) > 0)) fields.fx = 'fx_invalid'
  if (op.currency != null && op.currency !== '' && !/^[A-Za-z]{2,8}$/.test(String(op.currency))) fields.currency = 'currency_invalid'
  if (op.note && String(op.note).length > NOTE_MAX) fields.note = 'note_too_long'
  if (op.source != null && op.source !== 'moyiq') fields.source = 'source_invalid'
  if ((op.type === 'buy' || op.type === 'sell') && !(toNum(op.qty) > 0) && !(amount > 0)) fields.qty = 'qty_or_amount_required'
  return Object.keys(fields).length ? { ok: false, error: 'invalid', fields } : { ok: true }
}

const n0 = (v) => { const n = Number(v); return v != null && Number.isFinite(n) ? n : 0 }
// ledger.js: opToRow / rowToOp (mismos nombres y mismos nulos).
export function opToRow(op, userId) {
  return {
    id: op.uid, user_id: userId, seq: n0(op.id), type: op.type, ticker: op.ticker ? normTicker(op.ticker) : null, op_date: op.date,
    currency: op.currency || null, price: op.price || null, qty: op.qty || null, amount: n0(op.amount),
    fx: op.fx > 0 ? op.fx : null, pnl: op.pnl != null ? op.pnl : null, rsi: op.rsi || null, note: op.note || null,
    cash: op.cash == null ? null : !!op.cash, reinvested: !!op.reinvested, edited: !!op.edited, source: op.source || null,
  }
}
const nn = (v) => (v == null ? null : Number(v))
export function rowToOp(r) {
  return {
    id: Number(r.seq), uid: r.id, ticker: r.ticker, type: r.type, date: r.op_date, currency: r.currency,
    price: nn(r.price), qty: nn(r.qty), amount: Number(r.amount), fx: nn(r.fx), rsi: nn(r.rsi), note: r.note || '', pnl: nn(r.pnl),
    cash: r.cash, reinvested: !!r.reinvested, edited: !!r.edited, source: r.source || null, synced: true,
  }
}

export function newOperationUid(cryptoImpl = globalThis.crypto) {
  if (cryptoImpl?.randomUUID) return cryptoImpl.randomUUID()
  const b = cryptoImpl.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128
  const h = Array.from(b, x => (x + 256).toString(16).slice(1)).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

// Regla de riesgo (Ajustes de Invest): riesgo por operación de 0,1 % a 10 % y
// límite de concentración de 5 % a 100 %. Lo inválido vuelve al valor por defecto.
export function readRiskRule(user) {
  const md = user?.user_metadata || {}
  const r = md[RULE_KEY] || md[LEGACY_RULE_KEY] || {}
  const risk = Number(r.risk), limit = Number(r.limit)
  return {
    risk: risk >= 0.1 && risk <= 10 ? risk : RULE_DEFAULTS.risk,
    limit: limit >= 5 && limit <= 100 ? limit : RULE_DEFAULTS.limit,
  }
}
export function validateRiskRule({ risk, limit } = {}) {
  const fields = {}
  const r = toNum(risk), l = toNum(limit)
  if (!(r >= 0.1 && r <= 10)) fields.risk = 'risk_range'
  if (!(l >= 5 && l <= 100)) fields.limit = 'limit_range'
  return Object.keys(fields).length ? { ok: false, error: 'invalid', fields } : { ok: true, value: { risk: r, limit: l } }
}
export function validateCapital(v) {
  const c = toNum(v)
  return Number.isFinite(c) && c > 0 ? { ok: true, value: c } : { ok: false, error: 'invalid', fields: { capital: 'capital_invalid' } }
}

function withTimeout(promise, ms) {
  let id
  const timeout = new Promise((_, reject) => { id = setTimeout(() => reject(new Error('timeout')), ms) })
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(id))
}

const isDemoUrl = () => { try { return /[?&]demo=true\b/.test(window.location.search) } catch { return false } }
const refreshSnapshot = () => import('./investBridge.js').then(m => m.loadSnapshot({ force: true })).catch(logRejection('investData:snapshot'))

// limits: límites de Starter (utils/investLimits.js; apagados por defecto, null =
// sin límite). onLimit: aviso contextual cuando un alta choca con el límite.
export function createInvestData({ client = authClient, isDemo = isDemoUrl, onHoldingsChange = refreshSnapshot, timeoutMs = TIMEOUT_MS, now = () => Date.now(), limits = currentInvestLimits, onLimit = announceInvestLimit } = {}) {
  let mem = { uid: null, holdings: null, holdingsAt: 0, watch: null, ops: null }
  const cols = { stop: true, fx: true }
  const run = (q) => withTimeout(q, timeoutMs)

  async function session() {
    if (!client) return { error: 'auth_unavailable' }
    try {
      const { data } = await run(client.auth.getSession())
      const user = data?.session?.user || null
      if (!user?.id) return { error: 'session_required' }
      if (mem.uid !== user.id) mem = { uid: user.id, holdings: null, holdingsAt: 0, watch: null, ops: null }
      return { uid: user.id, user }
    } catch { return { error: 'timeout' } }
  }
  const fail = (error, extra) => ({ ok: false, error, ...extra })
  const guardWrite = async () => {
    if (isDemo()) return { error: 'demo' }
    return session()
  }
  const net = (e) => (e?.message === 'timeout' ? 'timeout' : 'network')

  async function selectHoldings(uid) {
    const pick = cols.stop && cols.fx ? HOLDING_COLUMNS : [HOLDING_BASE_COLUMNS, cols.stop && 'stop', cols.fx && 'fx_at_cost'].filter(Boolean).join(',')
    let res = await run(client.from('portfolio_holdings').select(pick).eq('user_id', uid))
    if (res.error && cols.fx && isColumnError(res.error, 'fx_at_cost')) { cols.fx = false; return selectHoldings(uid) }
    if (res.error && cols.stop && isColumnError(res.error, 'stop')) { cols.stop = false; return selectHoldings(uid) }
    return res
  }

  // Insert/update con el reintento sin las columnas opcionales.
  async function writeHolding(build, h) {
    let res = await run(build(holdingToRow(h, cols)))
    if (res.error && cols.fx && isColumnError(res.error, 'fx_at_cost')) { cols.fx = false; res = await run(build(holdingToRow(h, cols))) }
    if (res.error && cols.stop && isColumnError(res.error, 'stop')) { cols.stop = false; res = await run(build(holdingToRow(h, cols))) }
    return res
  }
  const changed = () => { mem.holdings = null; try { onHoldingsChange?.() } catch { /* el snapshot se actualiza en la próxima carga */ } }

  // Límite de Starter para un alta nueva (posiciones o Siguiendo). Sin límites
  // (lo normal hoy) no consulta nada. Si no se puede contar, deja pasar: el
  // límite es de la app, no una barrera de seguridad.
  async function overStarterLimit(kind, uid, ticker = null) {
    const lim = limits?.()
    if (!lim) return null
    let count = null
    try {
      if (kind === 'positions') {
        const res = await selectHoldings(uid)
        if (!res.error) count = (res.data || []).length
      } else {
        const res = await run(client.from('watchlist').select('ticker').eq('user_id', uid))
        const set = new Set((res.data || []).map(r => normTicker(r.ticker)))
        if (!res.error) count = ticker && set.has(ticker) ? 0 : set.size
      }
    } catch { count = null }
    if (count == null || canAddMore(kind, count, lim)) return null
    try { onLimit?.(kind) } catch { /* el aviso es opcional */ }
    return fail('starter_limit', { kind, limit: kind === 'positions' ? lim.positions : lim.watchlist })
  }

  return {
    columns: () => ({ ...cols }),
    async listHoldings({ force = false } = {}) {
      const s = await session()
      if (s.error) return fail(s.error)
      if (!force && mem.holdings && now() - mem.holdingsAt < CACHE_MS) return { ok: true, data: mem.holdings }
      try {
        const res = await selectHoldings(s.uid)
        if (res.error) return fail('holdings_failed')
        mem.holdings = (res.data || []).map(holdingFromRowFull).filter(h => h.t)
        mem.holdingsAt = now()
        return { ok: true, data: mem.holdings }
      } catch (e) { return fail(net(e)) }
    },
    async addHolding(input, { allowZeroCost = false } = {}) {
      const v = validateHolding(input, { allowZeroCost })
      if (!v.ok) return v
      const s = await guardWrite()
      if (s.error) return fail(s.error)
      const limited = await overStarterLimit('positions', s.uid)
      if (limited) return limited
      try {
        const res = await writeHolding((row) => client.from('portfolio_holdings').insert({ ...row, user_id: s.uid }).select(HOLDING_BASE_COLUMNS).single(), v.value)
        if (res.error) return fail('save_failed')
        changed()
        return { ok: true, data: { ...v.value, id: String(res.data?.id ?? '') } }
      } catch (e) { return fail(net(e)) }
    },
    // prev: la posición tal como está (el ticker no se cambia al editar).
    async updateHolding(prev, input) {
      if (!prev?.id) return fail('not_found')
      const v = validateHolding(input, { prev })
      if (!v.ok) return v
      const s = await guardWrite()
      if (s.error) return fail(s.error)
      try {
        const res = await writeHolding((row) => client.from('portfolio_holdings').update(row).eq('id', prev.id).eq('user_id', s.uid).select('id'), v.value)
        if (res.error) return fail('save_failed')
        if (Array.isArray(res.data) && res.data.length === 0) return fail('not_found')
        changed()
        return { ok: true, data: { ...v.value, id: String(prev.id) } }
      } catch (e) { return fail(net(e)) }
    },
    // Stop solo (input de la tabla de Posiciones): null lo quita.
    async setStop(prev, stop) {
      return this.updateHolding(prev, { ...prev, stop })
    },
    // No borra operaciones: el libro las sigue valuando (igual que Invest).
    async deleteHolding(id) {
      if (id == null || id === '') return fail('not_found')
      const s = await guardWrite()
      if (s.error) return fail(s.error)
      try {
        const res = await run(client.from('portfolio_holdings').delete().eq('id', id).eq('user_id', s.uid))
        if (res.error) return fail('delete_failed')
        changed()
        return { ok: true, data: { id: String(id) } }
      } catch (e) { return fail(net(e)) }
    },

    // ── Libro de operaciones ──
    async listOperations() {
      const s = await session()
      if (s.error) return fail(s.error)
      try {
        const res = await run(client.from('invest_operations').select(OPERATION_COLUMNS).eq('user_id', s.uid).order('seq'))
        if (res.error) return isMissingTable(res.error) ? fail('table_missing') : fail('operations_failed')
        mem.ops = (res.data || []).map(rowToOp)
        return { ok: true, data: mem.ops }
      } catch (e) { return fail(net(e)) }
    },
    // Sube una o varias operaciones (upsert por uid: subir dos veces no duplica).
    // Si el lote falla, reintenta de a una: quedan pendientes solo las que fallan.
    async saveOperations(list) {
      const ops = Array.isArray(list) ? list : [list]
      const bad = ops.map(op => ({ op, v: validateOperation(op) })).filter(x => !x.v.ok)
      if (bad.length) return fail('invalid', { fields: bad[0].v.fields, uid: bad[0].op.uid })
      const s = await guardWrite()
      if (s.error) return fail(s.error)
      const upsert = (rows) => run(client.from('invest_operations').upsert(rows, { onConflict: 'id' }))
      try {
        const res = await upsert(ops.map(o => opToRow(o, s.uid)))
        if (!res.error) return { ok: true, data: { saved: ops.map(o => o.uid), failed: [] } }
        if (isMissingTable(res.error)) return fail('table_missing')
        if (ops.length === 1) return fail('save_failed', { data: { saved: [], failed: [ops[0].uid] } })
        const saved = [], failed = []
        for (const o of ops) {
          const r = await upsert([opToRow(o, s.uid)]).catch(() => ({ error: true }))
          ;(r.error ? failed : saved).push(o.uid)
        }
        return failed.length ? fail('save_failed', { data: { saved, failed } }) : { ok: true, data: { saved, failed } }
      } catch (e) { return fail(net(e)) }
    },
    // Borrar una operación no ajusta la posición (Invest hace lo mismo).
    async deleteOperations(uids) {
      const list = (uids || []).filter(u => UUID_RE.test(String(u)))
      if (!list.length) return fail('not_found')
      const s = await guardWrite()
      if (s.error) return fail(s.error)
      try {
        const res = await run(client.from('invest_operations').delete().in('id', list).eq('user_id', s.uid))
        if (res.error) return isMissingTable(res.error) ? fail('table_missing') : fail('delete_failed')
        return { ok: true, data: { deleted: list } }
      } catch (e) { return fail(net(e)) }
    },

    // ── Lista ──
    async listWatchlist() {
      const s = await session()
      if (s.error) return fail(s.error)
      try {
        let res = await run(client.from('watchlist').select('ticker,added_at').eq('user_id', s.uid).order('added_at'))
        if (res.error && isColumnError(res.error, 'added_at')) res = await run(client.from('watchlist').select('ticker').eq('user_id', s.uid))
        if (res.error) return fail('watchlist_failed')
        const seen = new Set()
        mem.watch = (res.data || []).map(r => normTicker(r.ticker)).filter(t => t && !seen.has(t) && seen.add(t))
        return { ok: true, data: mem.watch }
      } catch (e) { return fail(net(e)) }
    },
    async addWatch(ticker) {
      const t = normTicker(ticker)
      if (!TICKER_RE.test(t)) return fail('invalid', { fields: { t: t ? 'ticker_invalid' : 'ticker_required' } })
      if (mem.watch?.includes(t)) return { ok: true, data: { ticker: t, existed: true } }
      const s = await guardWrite()
      if (s.error) return fail(s.error)
      const limited = await overStarterLimit('watchlist', s.uid, t)
      if (limited) return limited
      try {
        const res = await run(client.from('watchlist').insert({ user_id: s.uid, ticker: t }))
        if (res.error && res.error.code !== '23505') return fail('save_failed')
        if (mem.watch && !mem.watch.includes(t)) mem.watch = [...mem.watch, t]
        return { ok: true, data: { ticker: t, existed: res.error?.code === '23505' } }
      } catch (e) { return fail(net(e)) }
    },
    async removeWatch(ticker) {
      const t = normTicker(ticker)
      if (!t) return fail('not_found')
      const s = await guardWrite()
      if (s.error) return fail(s.error)
      try {
        const res = await run(client.from('watchlist').delete().eq('user_id', s.uid).eq('ticker', t))
        if (res.error) return fail('delete_failed')
        if (mem.watch) mem.watch = mem.watch.filter(x => x !== t)
        return { ok: true, data: { ticker: t } }
      } catch (e) { return fail(net(e)) }
    },

    // ── Capital de referencia y regla de riesgo ──
    async getProfile() {
      const s = await session()
      if (s.error) return fail(s.error)
      try {
        const res = await run(client.from('profiles').select('capital').eq('id', s.uid).maybeSingle())
        if (res.error) return fail('profile_failed')
        const c = Number(res.data?.capital)
        return { ok: true, data: { capital: c > 0 ? c : null, rule: readRiskRule(s.user) } }
      } catch (e) { return fail(net(e)) }
    },
    // En USD (la pantalla divide por la tasa de la moneda elegida antes de llamar).
    async setCapital(value) {
      const v = validateCapital(value)
      if (!v.ok) return v
      const s = await guardWrite()
      if (s.error) return fail(s.error)
      try {
        const res = await run(client.from('profiles').update({ capital: v.value }).eq('id', s.uid).select('capital'))
        if (res.error) return fail('save_failed')
        if (Array.isArray(res.data) && res.data.length === 0) return fail('profile_missing')
        return { ok: true, data: { capital: v.value } }
      } catch (e) { return fail(net(e)) }
    },
    async setRiskRule(input) {
      const v = validateRiskRule(input)
      if (!v.ok) return v
      const s = await guardWrite()
      if (s.error) return fail(s.error)
      try {
        const { error } = await run(client.auth.updateUser({ data: { [RULE_KEY]: v.value } }))
        if (error) return fail('save_failed')
        return { ok: true, data: v.value }
      } catch (e) { return fail(net(e)) }
    },

    // ── Planes guardados de Planificar (metadatos de la cuenta) ──
    async getPlans() {
      const s = await session()
      if (s.error) return fail(s.error)
      return { ok: true, data: readPlans(s.user) }
    },
    // Reemplaza la lista entera (la pantalla la arma con upsertPlan/removePlan).
    async savePlans(list) {
      const v = validatePlans(list)
      if (!v.ok) return fail(v.error)
      const s = await guardWrite()
      if (s.error) return fail(s.error)
      try {
        const { error } = await run(client.auth.updateUser({ data: { [PLANS_KEY]: plansPayload(v.list) } }))
        if (error) return fail('save_failed')
        return { ok: true, data: v.list }
      } catch (e) { return fail(net(e)) }
    },
    // Cambio puntual ({ op: 'upsert', plan } | { op: 'remove', id } |
    // { op: 'restore', plan, index }) sobre la lista FRESCA de la cuenta
    // (getUser va al servidor; la sesión en caché puede ser vieja): así otro
    // dispositivo o una carga fallida no pisan los planes que ya están.
    async updatePlans(change) {
      const s = await guardWrite()
      if (s.error) return fail(s.error)
      try {
        const { data, error: readErr } = await run(client.auth.getUser())
        if (readErr || !data?.user?.id) return fail('load_failed')
        if (data.user.id !== s.uid) return fail('session_required')
        const next = applyPlanChange(readPlans(data.user), change)
        if (!next.ok) return fail(next.error)
        const { error } = await run(client.auth.updateUser({ data: { [PLANS_KEY]: plansPayload(next.list) } }))
        if (error) return fail('save_failed')
        return { ok: true, data: next.list }
      } catch (e) { return fail(net(e)) }
    },
    clear() { mem = { uid: null, holdings: null, holdingsAt: 0, watch: null, ops: null } },
  }
}

export const investData = createInvestData()

// Al cambiar o cerrar la cuenta se vacían las cachés en memoria de los datos
// (investData) y de la API de mercado (investApi: guarda cotizaciones por
// ticker). Nada de esto toca el dispositivo; así la cuenta siguiente no ve ni
// un ticker de la anterior. Devuelve la función para dejar de escuchar.
export function bindAccountReset({ client = authClient, resets = [() => investData.clear(), () => investApi.clear()] } = {}) {
  if (!client?.auth?.onAuthStateChange) return () => {}
  let last
  const { data } = client.auth.onAuthStateChange((_ev, session) => {
    const uid = session?.user?.id || null
    if (last !== undefined && uid !== last) for (const fn of resets) { try { fn() } catch { /* una caché que no se vacía se vacía en la próxima sesión */ } }
    last = uid
  })
  return () => data?.subscription?.unsubscribe?.()
}
// Se engancha una vez, cuando se carga Inversiones (este módulo es diferido).
if (typeof window !== 'undefined') bindAccountReset()
