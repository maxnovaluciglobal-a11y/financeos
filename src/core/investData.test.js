import { describe, it, expect, vi } from 'vitest'
import {
  createInvestData, validateHolding, validateOperation, validateRiskRule, validateCapital, readRiskRule,
  opToRow, rowToOp, isMissingTable, isColumnError, newOperationUid, HOLDING_COLUMNS, RULE_KEY,
} from './investData.js'

// Supabase falso: cada consulta queda registrada (tabla, verbo, filtros, filas)
// y responde lo que diga `reply(q)`.
function fakeClient(reply = () => ({ data: [], error: null }), { uid = 'u1', user = null } = {}) {
  const log = []
  function builder(table) {
    const q = { table, verb: 'select', filters: [], payload: null, cols: null, opts: null }
    const b = {
      select(cols) { if (q.verb === 'select') q.cols = cols; else q.returning = cols; return b },
      insert(p) { q.verb = 'insert'; q.payload = p; return b },
      update(p) { q.verb = 'update'; q.payload = p; return b },
      upsert(p, o) { q.verb = 'upsert'; q.payload = p; q.opts = o; return b },
      delete() { q.verb = 'delete'; return b },
      eq(k, v) { q.filters.push(['eq', k, v]); return b },
      in(k, v) { q.filters.push(['in', k, v]); return b },
      order(k) { q.order = k; return b },
      single() { q.single = true; return b },
      maybeSingle() { q.single = true; return b },
      then(res, rej) { log.push(q); return Promise.resolve(reply(q)).then(res, rej) },
    }
    return b
  }
  const u = user || (uid ? { id: uid, user_metadata: {} } : null)
  return {
    log,
    from: vi.fn(builder),
    auth: {
      getSession: async () => ({ data: { session: u ? { user: u } : null } }),
      updateUser: vi.fn(async ({ data }) => ({ data: { user: { ...u, user_metadata: { ...u.user_metadata, ...data } } }, error: null })),
    },
  }
}
const mk = (client, extra = {}) => createInvestData({ client, isDemo: () => false, onHoldingsChange: vi.fn(), ...extra })
const UID = '3f2c7a8e-1b2d-4c5e-8f9a-0b1c2d3e4f50'

describe('validateHolding (savePos de Invest)', () => {
  it('ticker requerido y válido; unidades y entrada > 0', () => {
    expect(validateHolding({}).fields).toMatchObject({ t: 'ticker_required', sh: 'shares_invalid', cost: 'cost_invalid' })
    expect(validateHolding({ t: 'a b', sh: 1, cost: 1 }).fields.t).toBe('ticker_invalid')
    expect(validateHolding({ t: ' aapl ', sh: '2,5', cost: '100' })).toEqual({ ok: true, value: { t: 'AAPL', type: 'Stock', sh: 2.5, cost: 100, stop: null, fxCost: null, note: '' } })
  })
  it('costo 0 solo si la posición ya tenía 0 (nació de un bono)', () => {
    expect(validateHolding({ t: 'A', sh: 1, cost: 0 }).ok).toBe(false)
    expect(validateHolding({ sh: 1, cost: 0 }, { prev: { id: 1, t: 'A', cost: 0 } }).ok).toBe(true)
    expect(validateHolding({ sh: 1, cost: 0 }, { prev: { id: 1, t: 'A', cost: 5 } }).ok).toBe(false)
  })
  it('al editar el ticker no cambia', () => {
    expect(validateHolding({ t: 'OTRO', sh: 1, cost: 1 }, { prev: { id: 1, t: 'AAPL', cost: 1 } }).value.t).toBe('AAPL')
  })
  it('stop y tipo de cambio de la compra opcionales: vacío = null, inválido = error', () => {
    expect(validateHolding({ t: 'A', sh: 1, cost: 1, stop: '', fxCost: null }).value).toMatchObject({ stop: null, fxCost: null })
    expect(validateHolding({ t: 'A', sh: 1, cost: 1, stop: 90, fxCost: 950 }).value).toMatchObject({ stop: 90, fxCost: 950 })
    expect(validateHolding({ t: 'A', sh: 1, cost: 1, stop: -1, fxCost: 0 }).fields).toEqual({ stop: 'stop_invalid', fxCost: 'fx_invalid' })
  })
  it('tipo de activo de la tabla y nota de hasta 500', () => {
    expect(validateHolding({ t: 'A', sh: 1, cost: 1, type: 'Bond' }).ok).toBe(true)
    expect(validateHolding({ t: 'A', sh: 1, cost: 1, type: 'Casa' }).fields.type).toBe('type_invalid')
    expect(validateHolding({ t: 'A', sh: 1, cost: 1, note: 'x'.repeat(501) }).fields.note).toBe('note_too_long')
  })
})

describe('validateOperation (restricciones de invest_operations)', () => {
  const base = { uid: UID, type: 'buy', ticker: 'AAPL', date: '2026-11-20', qty: 1, price: 100, amount: 100 }
  it('una compra válida pasa', () => expect(validateOperation(base).ok).toBe(true))
  it('depósito y retiro sin ticker; el resto con ticker', () => {
    expect(validateOperation({ ...base, type: 'deposit', ticker: null }).ok).toBe(true)
    expect(validateOperation({ ...base, type: 'deposit' }).fields.ticker).toBe('ticker_not_allowed')
    expect(validateOperation({ ...base, ticker: '' }).fields.ticker).toBe('ticker_required')
  })
  it('tipo, fecha, montos, fx, moneda, nota, origen y uid', () => {
    const f = validateOperation({ uid: 'x', type: 'regalo', ticker: 'A', date: '20-11-2026', price: -1, qty: -1, amount: -1, fx: 0, currency: 'D', note: 'x'.repeat(501), source: 'otro' }).fields
    expect(Object.keys(f).sort()).toEqual(['amount', 'currency', 'date', 'fx', 'note', 'price', 'qty', 'source', 'type', 'uid'].sort())
  })
  it('compra o venta sin unidades ni monto no sirve', () => {
    expect(validateOperation({ ...base, qty: null, amount: 0 }).fields.qty).toBe('qty_or_amount_required')
  })
})

describe('opToRow / rowToOp (ledger.js)', () => {
  it('ida y vuelta conserva la operación', () => {
    const op = { id: 3, uid: UID, type: 'dividend', ticker: 'aapl', date: '2026-11-01', currency: 'USD', price: null, qty: null, amount: 12.5, fx: null, rsi: null, note: '', pnl: null, cash: null, reinvested: true, edited: false, source: null }
    const row = opToRow(op, 'u1')
    expect(row).toMatchObject({ id: UID, user_id: 'u1', seq: 3, ticker: 'AAPL', op_date: '2026-11-01', amount: 12.5, cash: null, reinvested: true, note: null })
    expect(rowToOp(row)).toMatchObject({ id: 3, uid: UID, type: 'dividend', amount: 12.5, reinvested: true, synced: true })
  })
  it('uid nuevo con formato UUID v4', () => {
    expect(newOperationUid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    const fallback = newOperationUid({ getRandomValues: (b) => b.fill(255) })
    expect(fallback).toMatch(/^ffffffff-ffff-4fff-bfff-ffffffffffff$/)
  })
  it('isMissingTable e isColumnError', () => {
    expect(isMissingTable({ code: 'PGRST205' })).toBe(true)
    expect(isMissingTable({ message: 'relation "public.invest_operations" does not exist' })).toBe(true)
    expect(isMissingTable({ code: '23505' })).toBe(false)
    expect(isColumnError({ message: 'column "fx_at_cost" does not exist' }, 'fx_at_cost')).toBe(true)
    expect(isColumnError({ message: 'stop the world' }, 'stop')).toBe(false)
  })
})

describe('portfolio_holdings con RLS (siempre filtrado por la cuenta)', () => {
  it('lee las columnas reales, incluidas stop y nota, de la cuenta de la sesión', async () => {
    const c = fakeClient((q) => ({ data: q.verb === 'select' ? [{ id: 9, ticker: 'aapl', asset_type: 'Stock', shares: 2, avg_cost: 100, note: 'n', stop: 90, fx_at_cost: null }] : [], error: null }))
    const d = mk(c)
    const r = await d.listHoldings()
    expect(r).toEqual({ ok: true, data: [{ id: '9', t: 'AAPL', type: 'Stock', sh: 2, cost: 100, fxCost: null, stop: 90, note: 'n' }] })
    expect(c.log[0]).toMatchObject({ table: 'portfolio_holdings', cols: HOLDING_COLUMNS, filters: [['eq', 'user_id', 'u1']] })
    await d.listHoldings()
    expect(c.log).toHaveLength(1) // caché en memoria
  })
  it('alta: valida, escribe con user_id y avisa el cambio', async () => {
    const c = fakeClient((q) => ({ data: q.verb === 'insert' ? { id: 11 } : [], error: null }))
    const onHoldingsChange = vi.fn()
    const d = mk(c, { onHoldingsChange })
    expect((await d.addHolding({ t: '', sh: 1, cost: 1 })).fields.t).toBe('ticker_required')
    expect(c.log).toHaveLength(0)
    const r = await d.addHolding({ t: 'sqm-b.sn', sh: 10, cost: 60000, fxCost: 900, stop: 55000, note: 'lote 1' })
    expect(r.ok).toBe(true)
    expect(r.data.id).toBe('11')
    expect(c.log[0].payload).toEqual({ user_id: 'u1', ticker: 'SQM-B.SN', asset_type: 'Stock', shares: 10, avg_cost: 60000, note: 'lote 1', stop: 55000, fx_at_cost: 900 })
    expect(onHoldingsChange).toHaveBeenCalledTimes(1)
  })
  it('si la base no tiene fx_at_cost (o stop), reintenta sin esa columna', async () => {
    let n = 0
    const c = fakeClient(() => {
      n++
      if (n === 1) return { data: null, error: { message: 'column "fx_at_cost" of relation "portfolio_holdings" does not exist', code: '42703' } }
      if (n === 2) return { data: null, error: { message: "Could not find the 'stop' column of 'portfolio_holdings' in the schema cache", code: 'PGRST204' } }
      return { data: { id: 1 }, error: null }
    })
    const d = mk(c)
    const r = await d.addHolding({ t: 'A', sh: 1, cost: 1, stop: 1, fxCost: 2 })
    expect(r.ok).toBe(true)
    expect('fx_at_cost' in c.log[1].payload).toBe(false)
    expect('stop' in c.log[2].payload).toBe(false)
    expect(d.columns()).toEqual({ stop: false, fx: false })
  })
  it('edición y borrado filtran por id Y por user_id; 0 filas = no encontrada', async () => {
    const c = fakeClient((q) => ({ data: q.verb === 'update' ? [] : null, error: null }))
    const d = mk(c)
    const prev = { id: '5', t: 'AAPL', sh: 1, cost: 100 }
    expect((await d.updateHolding(prev, { sh: 2, cost: 100 })).error).toBe('not_found')
    expect(c.log[0].filters).toEqual([['eq', 'id', '5'], ['eq', 'user_id', 'u1']])
    expect(c.log[0].payload.ticker).toBe('AAPL')
    expect('user_id' in c.log[0].payload).toBe(false) // UPDATE es por columna: nunca user_id ni id
    const del = await d.deleteHolding('5')
    expect(del.ok).toBe(true)
    expect(c.log[1]).toMatchObject({ verb: 'delete', filters: [['eq', 'id', '5'], ['eq', 'user_id', 'u1']] })
  })
  it('el stop se guarda solo y null lo quita', async () => {
    const c = fakeClient(() => ({ data: [{ id: '5' }], error: null }))
    const d = mk(c)
    const prev = { id: '5', t: 'AAPL', type: 'ETF', sh: 1, cost: 100, stop: 90, fxCost: null, note: '' }
    expect((await d.setStop(prev, null)).ok).toBe(true)
    expect(c.log[0].payload).toMatchObject({ stop: null, asset_type: 'ETF', shares: 1 })
  })
  it('sin sesión no se lee ni se escribe; en el demo nunca se escribe', async () => {
    const none = mk(fakeClient(undefined, { uid: null }))
    expect((await none.listHoldings()).error).toBe('session_required')
    const c = fakeClient()
    const demo = mk(c, { isDemo: () => true })
    expect((await demo.addHolding({ t: 'A', sh: 1, cost: 1 })).error).toBe('demo')
    expect((await demo.addWatch('A')).error).toBe('demo')
    expect(c.log).toHaveLength(0)
    expect((await mk(null).listHoldings()).error).toBe('auth_unavailable')
  })
  it('al cambiar de cuenta la caché en memoria se vacía', async () => {
    let user = { id: 'u1', user_metadata: {} }
    const c = fakeClient(() => ({ data: [], error: null }))
    c.auth.getSession = async () => ({ data: { session: { user } } })
    const d = mk(c)
    await d.listHoldings()
    user = { id: 'u2', user_metadata: {} }
    await d.listHoldings()
    expect(c.log).toHaveLength(2)
    expect(c.log[1].filters).toEqual([['eq', 'user_id', 'u2']])
  })
})

describe('invest_operations', () => {
  const op = { id: 1, uid: UID, type: 'deposit', ticker: null, date: '2026-11-20', amount: 500, currency: 'USD' }
  it('lee ordenado por seq y sube con upsert por id', async () => {
    const c = fakeClient((q) => ({ data: q.verb === 'select' ? [opToRow(op, 'u1')] : null, error: null }))
    const d = mk(c)
    expect((await d.listOperations()).data[0]).toMatchObject({ uid: UID, type: 'deposit', amount: 500 })
    expect(c.log[0]).toMatchObject({ table: 'invest_operations', order: 'seq', filters: [['eq', 'user_id', 'u1']] })
    expect((await d.saveOperations(op)).ok).toBe(true)
    expect(c.log[1]).toMatchObject({ verb: 'upsert', opts: { onConflict: 'id' } })
    expect(c.log[1].payload[0].user_id).toBe('u1')
  })
  it('una operación inválida no sale; tabla sin aplicar = table_missing', async () => {
    const c = fakeClient(() => ({ data: null, error: { code: 'PGRST205' } }))
    const d = mk(c)
    expect((await d.saveOperations({ ...op, type: 'x' })).error).toBe('invalid')
    expect(c.log).toHaveLength(0)
    expect((await d.saveOperations(op)).error).toBe('table_missing')
    expect((await d.listOperations()).error).toBe('table_missing')
  })
  it('si el lote falla, reintenta de a una y dice cuáles quedaron pendientes', async () => {
    const uid2 = '3f2c7a8e-1b2d-4c5e-8f9a-0b1c2d3e4f51'
    const c = fakeClient((q) => ({ data: null, error: q.payload.length > 1 || q.payload[0].id === uid2 ? { code: '23514' } : null }))
    const r = await mk(c).saveOperations([op, { ...op, uid: uid2 }])
    expect(r.ok).toBe(false)
    expect(r.data).toEqual({ saved: [UID], failed: [uid2] })
  })
  it('borra por uid y por cuenta', async () => {
    const c = fakeClient(() => ({ data: null, error: null }))
    expect((await mk(c).deleteOperations([UID, 'no-uuid'])).data.deleted).toEqual([UID])
    expect(c.log[0].filters).toEqual([['in', 'id', [UID]], ['eq', 'user_id', 'u1']])
  })
})

describe('watchlist', () => {
  it('lee sin duplicados, en orden de alta; agrega y quita filtrando por la cuenta', async () => {
    const c = fakeClient((q) => ({ data: q.verb === 'select' ? [{ ticker: 'aapl' }, { ticker: 'AAPL' }, { ticker: 'SPY' }] : null, error: q.verb === 'insert' && q.payload.ticker === 'SPY' ? { code: '23505' } : null }))
    const d = mk(c)
    expect((await d.listWatchlist()).data).toEqual(['AAPL', 'SPY'])
    expect(c.log[0].order).toBe('added_at')
    expect((await d.addWatch('spy')).data).toEqual({ ticker: 'SPY', existed: true })
    expect(c.log).toHaveLength(1) // ya estaba en la lista: no se pide nada
    expect((await d.addWatch('nvda')).ok).toBe(true)
    expect(c.log[1].payload).toEqual({ user_id: 'u1', ticker: 'NVDA' })
    expect((await d.addWatch('no válido')).error).toBe('invalid')
    await d.removeWatch('nvda')
    expect(c.log[2]).toMatchObject({ verb: 'delete', filters: [['eq', 'user_id', 'u1'], ['eq', 'ticker', 'NVDA']] })
  })
})

describe('capital y regla de riesgo', () => {
  it('capital > 0 en profiles.capital de la propia fila', async () => {
    const c = fakeClient((q) => ({ data: q.verb === 'update' ? [{ capital: 5000 }] : { capital: 0 }, error: null }))
    const d = mk(c)
    expect((await d.getProfile()).data).toEqual({ capital: null, rule: { risk: 2, limit: 25 } })
    expect((await d.setCapital(0)).fields.capital).toBe('capital_invalid')
    expect((await d.setCapital('5000')).ok).toBe(true)
    expect(c.log[1]).toMatchObject({ table: 'profiles', verb: 'update', payload: { capital: 5000 }, filters: [['eq', 'id', 'u1']] })
  })
  it('regla: 0,1–10 % y 5–100 %, en los metadatos de la cuenta', async () => {
    expect(validateRiskRule({ risk: 0.05, limit: 4 }).fields).toEqual({ risk: 'risk_range', limit: 'limit_range' })
    expect(readRiskRule({ user_metadata: { [RULE_KEY]: { risk: 1.5, limit: 30 } } })).toEqual({ risk: 1.5, limit: 30 })
    expect(readRiskRule({ user_metadata: { [RULE_KEY]: { risk: 50, limit: 'x' } } })).toEqual({ risk: 2, limit: 25 })
    const c = fakeClient()
    expect((await mk(c).setRiskRule({ risk: '1,5', limit: 30 })).data).toEqual({ risk: 1.5, limit: 30 })
    expect(c.auth.updateUser).toHaveBeenCalledWith({ data: { [RULE_KEY]: { risk: 1.5, limit: 30 } } })
    expect(validateCapital('abc').ok).toBe(false)
  })
})

describe('privacidad', () => {
  it('el módulo no toca localStorage ni sessionStorage', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(new URL('./investData.js', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '')
    expect(src).not.toMatch(/localStorage|sessionStorage|indexedDB/)
  })
})

describe('cambio de cuenta', () => {
  it('vacía las cachés en memoria cuando cambia o se cierra la sesión, no en la primera', async () => {
    const { bindAccountReset } = await import('./investData.js')
    let cb = null
    const unsubscribe = vi.fn()
    const client = { auth: { onAuthStateChange: (fn) => { cb = fn; return { data: { subscription: { unsubscribe } } } } } }
    const reset = vi.fn()
    const stop = bindAccountReset({ client, resets: [reset] })
    cb('INITIAL_SESSION', { user: { id: 'a' } })
    cb('TOKEN_REFRESHED', { user: { id: 'a' } })
    expect(reset).not.toHaveBeenCalled()
    cb('SIGNED_IN', { user: { id: 'b' } })
    cb('SIGNED_OUT', null)
    expect(reset).toHaveBeenCalledTimes(2)
    stop()
    expect(unsubscribe).toHaveBeenCalled()
    expect(bindAccountReset({ client: null })).toBeTypeOf('function')
  })
})
