// Siguiendo (F4): lógica pura de Mi lista, Descubrir, Comparar y alertas, el
// cliente de invest_alerts (con un cliente falso) y la navegación a Siguiendo.
import { describe, it, expect, beforeEach } from 'vitest'
import {
  COMPARE_MAX, COMPARE_PERIODS, DISCOVER_LISTS, DISCOVER_MAX, addToCompare, applyFilters, byTrend, compareSet, corrReading, discoverCsv,
  followRow, moveBand, normFilters, parseTickers, periodOf, removeFromCompare, slicePeriod, trendCounts,
} from './investFollow.js'
import {
  ALERT_LIMIT, COOLDOWN_MS, alertStatus, alertsBySymbol, alertsSummary, conditionMet, fromRow, isDuplicate, parseLegacyAlerts,
  roundLevel, suggestLevels, validateAlert,
} from './investAlerts.js'
import { createInvestAlerts } from '../core/investAlerts.js'
import { FOLLOW_TABS, FOLLOW_TAB_KEY, bootFollowTab, bootTab, queueFollow, rememberFollowTab, takeFollowFocus, takeQueuedCompare, __resetInvestNav } from './investNav.js'

// Velas diarias de días hábiles terminando el 2026-11-20, con un paso por día.
function candles(n, { start = 100, step = 0.001, wave = 0, end = '2026-11-20' } = {}) {
  const out = []
  const d = new Date(`${end}T00:00:00Z`)
  while (out.length < n) {
    const wd = d.getUTCDay()
    if (wd !== 0 && wd !== 6) out.unshift(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() - 1)
  }
  let px = start
  return out.map((date, i) => {
    px = px * (1 + step + (wave ? wave * Math.sin(i / 3) : 0))
    return { date, open: px, high: px * 1.01, low: px * 0.99, close: px, volume: 1000 + i }
  })
}

describe('Mi lista', () => {
  it('sin velas solo precio y día; con un año, lecturas y 52 semanas', () => {
    const q = { price: 110, changePct: 0.012, high52: 120, low52: 80, currency: 'USD', name: 'X' }
    const r0 = followRow('spy', q, null)
    expect(r0).toMatchObject({ t: 'SPY', price: 110, changePct: 0.012, scored: false, trend: null, rsi: null })
    expect(r0.range.pos).toBeCloseTo(0.75, 6)
    const r1 = followRow('SPY', q, candles(260))
    expect(r1.scored).toBe(true)
    expect(r1.trend).toBe('UP')
    expect(r1.rsi).toBeGreaterThan(70)
    expect(r1.yearPct).toBeGreaterThan(0)
    expect(r1.macd).toMatchObject({ sign: 'pos' })
  })
  it('conteo y filtro por tendencia', () => {
    const rows = [{ t: 'A', trend: 'UP' }, { t: 'B', trend: 'DOWN' }, { t: 'C', trend: null }]
    expect(trendCounts(rows)).toEqual({ all: 3, UP: 1, MIX: 0, DOWN: 1 })
    expect(byTrend(rows, 'UP').map(r => r.t)).toEqual(['A'])
    expect(byTrend(rows, 'all')).toHaveLength(3)
  })
})

describe('Descubrir', () => {
  it('listas fijas sin repetidos y con símbolos válidos (incluye ETF amplios, dividendos y bonos)', () => {
    expect(DISCOVER_LISTS.map(l => l.id)).toEqual(expect.arrayContaining(['etfBroad', 'dividends', 'bonds']))
    for (const l of DISCOVER_LISTS) {
      expect(new Set(l.tickers).size).toBe(l.tickers.length)
      expect(l.tickers.length).toBeLessThanOrEqual(DISCOVER_MAX)
      for (const t of l.tickers) expect(t).toMatch(/^[\^A-Z0-9.=-]{1,15}$/)
    }
  })
  it('texto libre → símbolos, con tope y los inválidos aparte', () => {
    expect(parseTickers('aapl, msft;  aapl  $$ voo')).toEqual({ tickers: ['AAPL', 'MSFT', 'VOO'], cut: 0, bad: ['$$'] })
    const many = Array.from({ length: 35 }, (_, i) => `T${i}`).join(' ')
    expect(parseTickers(many).tickers).toHaveLength(DISCOVER_MAX)
    expect(parseTickers(many).cut).toBe(5)
  })
  it('un RSI desconocido no pasa un filtro de RSI y el CSV lleva solo lo filtrado', () => {
    const rows = [{ t: 'B', rsi: 50, trend: 'UP', price: 10 }, { t: 'A', rsi: null, trend: 'UP', price: 5 }, { t: 'C', rsi: 80, trend: 'DOWN', price: 1 }]
    expect(applyFilters(rows, { rsiMin: 40, rsiMax: 60 }).map(r => r.t)).toEqual(['B'])
    expect(applyFilters(rows, {}).map(r => r.t)).toEqual(['A', 'B', 'C'])
    expect(normFilters({ rsiMin: 90, rsiMax: 10 })).toEqual({ rsiMin: 10, rsiMax: 90, trend: 'all' })
    const csv = discoverCsv(applyFilters(rows, { trend: 'DOWN' }), { ticker: 'Activo', price: 'Precio', trend: 'Tendencia', sma50: 'SMA 50', sma200: 'SMA 200', year: 'Año', trends: { UP: 'Sube', MIX: 'Mixta', DOWN: 'Baja' } })
    expect(csv).toContain('C')
    expect(csv).not.toMatch(/\bB\b/)
    // A prueba de fórmulas.
    expect(discoverCsv([{ t: '=CMD()', price: 1 }], { ticker: 'a', price: 'b', trend: 'c', sma50: 'd', sma200: 'e', year: 'f', trends: {} })).not.toMatch(/(^|\n|,)=CMD/)
  })
})

describe('Comparar', () => {
  it('hasta 4, sin repetidos, al menos 2', () => {
    expect(addToCompare(['A', 'B'], 'c')).toEqual({ ok: true, list: ['A', 'B', 'C'] })
    expect(addToCompare(['A', 'B'], 'a')).toEqual({ ok: false, error: 'dup' })
    expect(addToCompare(['A', 'B', 'C', 'D'], 'E')).toEqual({ ok: false, error: 'max' })
    expect(addToCompare(['A'], '')).toEqual({ ok: false, error: 'empty' })
    expect(addToCompare(['A'], 'a b')).toEqual({ ok: false, error: 'invalid' })
    expect(removeFromCompare(['A', 'B'], 'A')).toEqual({ ok: false, error: 'min' })
    expect(removeFromCompare(['A', 'B', 'C'], 'A')).toEqual({ ok: true, list: ['B', 'C'] })
    expect(COMPARE_MAX).toBe(4)
  })
  it('3A son 3 años de calendario aunque se pidan 5', () => {
    expect(periodOf('3A')).toMatchObject({ months: 36, range: '5y' })
    const rows = slicePeriod(candles(1300), 36)
    expect(rows[0].date >= '2023-11-19').toBe(true)
    expect(rows[0].date <= '2023-11-22').toBe(true)
    expect(COMPARE_PERIODS.map(p => p.key)).toEqual(['1M', '3M', '6M', '1A', '3A'])
  })
  it('medidas por activo y por par; la serie corta no se dibuja ni se inventa', () => {
    const h = { A: candles(80, { step: 0.002 }), B: candles(80, { step: 0.001, wave: 0.01 }), C: candles(4) }
    const r = compareSet(['A', 'B', 'C'], h, '3M')
    expect(r.missing).toEqual(['C'])
    expect(Object.keys(r.series)).toEqual(['A', 'B'])
    expect(r.series.A[0].pct).toBe(0)
    expect(r.best).toBe('A')
    expect(r.calmest).toBe('A')
    expect(r.stats.A.volYear).toBeCloseTo(r.stats.A.vol * Math.sqrt(252), 10)
    expect(r.stats.B.move).toBeTruthy()
    expect(r.pairs).toHaveLength(1)
    expect(r.pairs[0]).toMatchObject({ a: 'A', b: 'B' })
  })
  it('"cuánto se mueve" y la lectura de la correlación en palabras', () => {
    expect([moveBand(0.1), moveBand(0.2), moveBand(0.5), moveBand(null)]).toEqual(['low', 'mid', 'high', null])
    expect([corrReading(0.9), corrReading(0.5), corrReading(0), corrReading(-0.5), corrReading(null)]).toEqual(['same', 'similar', 'independent', 'opposite', 'na'])
  })
})

describe('alertas: reglas (iguales a invest-alerts-check)', () => {
  it('valida símbolo, condición y nivel', () => {
    expect(validateAlert({ symbol: ' aapl ', condition: 'above', threshold: '190,5' })).toEqual({ ok: true, value: { symbol: 'AAPL', condition: 'above', threshold: 190.5 } })
    expect(validateAlert({ symbol: '', condition: 'x', threshold: 0 }).fields).toEqual({ symbol: 'symbol_required', condition: 'condition_invalid', threshold: 'threshold_invalid' })
    expect(validateAlert({ symbol: 'A', condition: 'pct_move', threshold: 150 }).fields).toEqual({ threshold: 'pct_invalid' })
    expect(validateAlert({ symbol: 'A B', condition: 'below', threshold: 1 }).fields).toEqual({ symbol: 'symbol_invalid' })
  })
  it('se cumple con el precio de ahora y nunca sin precio', () => {
    expect(conditionMet('above', 100, { price: 100 })).toBe(true)
    expect(conditionMet('above', 100, { price: 99.9 })).toBe(false)
    expect(conditionMet('below', 100, { price: 100 })).toBe(true)
    expect(conditionMet('pct_move', 3, { price: 10, changePct: -0.031 })).toBe(true)
    expect(conditionMet('pct_move', 3, { price: 10, changePct: 0.02 })).toBe(false)
    expect(conditionMet('above', 100, null)).toBe(false)
  })
  it('estado: lo que falta, lo que se movió y el aviso de las últimas 24 h', () => {
    const now = Date.parse('2026-11-23T12:00:00Z')
    const a = { condition: 'above', threshold: 110, lastTriggeredAt: new Date(now - COOLDOWN_MS + 60000).toISOString() }
    const st = alertStatus(a, { price: 100 }, now)
    expect(st.gap).toBeCloseTo(0.1, 10)
    expect(st.reached).toBe(false)
    expect(st.notifiedRecently).toBe(true)
    expect(alertStatus({ condition: 'below', threshold: 90 }, { price: 100 }, now).gap).toBeCloseTo(0.1, 10)
    expect(alertStatus({ condition: 'pct_move', threshold: 3 }, { price: 1, changePct: -0.01 }, now).moved).toBe(-0.01)
    expect(alertStatus({ condition: 'above', threshold: 1 }, null, now)).toMatchObject({ price: null, reached: false, gap: null })
  })
  it('sugerencias solo del lado correcto del precio, sin casi repetidas', () => {
    expect(suggestLevels({ condition: 'below', price: 100, avgCost: 95, low52: 80, high52: 120 }).map(x => x.kind)).toEqual(['cost', 'low52', 'down10'])
    expect(suggestLevels({ condition: 'above', price: 100, avgCost: 95, high52: 110 }).map(x => x.kind)).toEqual(['high52'])
    expect(suggestLevels({ condition: 'pct_move' }).map(x => x.value)).toEqual([3, 5, 10])
    expect(suggestLevels({ condition: 'above', price: null })).toEqual([])
    expect(roundLevel(0.123456)).toBe(0.1235)
    expect(roundLevel(123.456)).toBe(123.46)
  })
  it('duplicados, resumen y agrupado por activo', () => {
    const list = [{ id: '1', symbol: 'A', condition: 'above', threshold: 10, active: true }, { id: '2', symbol: 'A', condition: 'below', threshold: 5, active: false }, { id: '3', symbol: 'B', condition: 'above', threshold: 1, active: true }]
    expect(isDuplicate(list, { symbol: 'a', condition: 'above', threshold: 10 })).toBe(true)
    expect(isDuplicate(list, { symbol: 'a', condition: 'above', threshold: 10 }, '1')).toBe(false)
    expect(alertsSummary(list, { A: { price: 11 }, B: { price: 0.5 } })).toEqual({ total: 3, active: 2, paused: 1, reached: 1, assets: 2 })
    expect(alertsBySymbol(list).get('A')).toHaveLength(2)
    expect(fromRow({ id: 'x', symbol: 'aapl', condition: 'below', threshold: '5.5', active: false, last_triggered_at: null, created_at: 't' })).toEqual({ id: 'x', symbol: 'AAPL', condition: 'below', threshold: 5.5, active: false, lastTriggeredAt: null, createdAt: 't' })
  })
  it('traspaso: formato de Invest (Max/Min), formato nuevo y copia sin alertas', () => {
    const legacy = [{ id: 1, asset: 'aapl', type: 'Max', trigger: 200 }, { asset: 'msft', type: 'Min', trigger: '300' }, { asset: 'AAPL', type: 'Max', trigger: 200 }, { asset: 'X', type: 'Otro', trigger: 1 }, null]
    expect(parseLegacyAlerts(JSON.stringify(legacy))).toEqual({ ok: true, items: [{ symbol: 'AAPL', condition: 'above', threshold: 200 }, { symbol: 'MSFT', condition: 'below', threshold: 300 }], skipped: 3 })
    expect(parseLegacyAlerts({ alerts: [{ symbol: 'VOO', condition: 'pct_move', threshold: 5 }] }).items).toHaveLength(1)
    expect(parseLegacyAlerts({ _v: 2, portfolio: [], watchlist: [] })).toMatchObject({ ok: false, error: 'no_alerts_in_backup' })
    expect(parseLegacyAlerts('{nope')).toMatchObject({ ok: false, error: 'bad_json' })
    expect(parseLegacyAlerts({ foo: 1 })).toMatchObject({ ok: false, error: 'not_alerts' })
  })
})

// Cliente falso de Supabase: lo justo para invest_alerts.
function fakeClient({ uid = 'u1', error = null, rows = [] } = {}) {
  const db = { rows: rows.map(r => ({ ...r })) }
  const calls = []
  let seq = 0
  const match = (r, f) => f.every(([k, v]) => r[k] === v)
  function exec(q) {
    if (error) return { data: null, error }
    if (q.op === 'select') return { data: db.rows.filter(r => match(r, q.f)), error: null }
    if (q.op === 'insert') {
      const list = (Array.isArray(q.p) ? q.p : [q.p]).map(x => ({ id: `id${++seq}`, last_triggered_at: null, created_at: `c${seq}`, ...x }))
      db.rows.push(...list)
      return { data: list, error: null }
    }
    if (q.op === 'update') {
      const hit = db.rows.filter(r => match(r, q.f))
      for (const r of hit) Object.assign(r, q.p)
      return { data: hit, error: null }
    }
    db.rows = db.rows.filter(r => !match(r, q.f))
    return { data: null, error: null }
  }
  return {
    db, calls,
    auth: { getSession: async () => ({ data: { session: uid ? { user: { id: uid } } : null } }) },
    from(table) {
      const q = { table, op: 'select', f: [], p: null }
      const api = {
        select() { return api },
        insert(p) { q.op = 'insert'; q.p = p; return api },
        update(p) { q.op = 'update'; q.p = p; return api },
        delete() { q.op = 'delete'; return api },
        eq(k, v) { q.f.push([k, v]); return api },
        order() { return api },
        then(res, rej) { calls.push(q); return Promise.resolve(exec(q)).then(res, rej) },
      }
      return api
    },
  }
}

describe('core/investAlerts (invest_alerts con RLS)', () => {
  it('lista, crea, edita (rearma), pausa y borra, siempre filtrando por la cuenta', async () => {
    const c = fakeClient({ rows: [{ id: 'z', user_id: 'otro', symbol: 'X', condition: 'above', threshold: 1, active: true }] })
    const api = createInvestAlerts({ client: c, isDemo: () => false })
    expect((await api.list()).data).toEqual([])
    const cr = await api.create({ symbol: 'aapl', condition: 'above', threshold: 200 })
    expect(cr.ok).toBe(true)
    expect(c.db.rows.find(r => r.id === cr.data.id)).toMatchObject({ user_id: 'u1', symbol: 'AAPL', active: true })
    expect(await api.create({ symbol: 'AAPL', condition: 'above', threshold: 200 })).toEqual({ ok: false, error: 'duplicate' })
    c.db.rows.find(r => r.id === cr.data.id).last_triggered_at = 'ayer'
    const up = await api.update(cr.data.id, { symbol: 'AAPL', condition: 'below', threshold: 150 })
    expect(up.data).toMatchObject({ condition: 'below', threshold: 150, lastTriggeredAt: null })
    expect((await api.setActive(cr.data.id, false)).data.active).toBe(false)
    expect((await api.remove(cr.data.id)).ok).toBe(true)
    expect(c.db.rows.map(r => r.id)).toEqual(['z'])
    // Nunca sin la cuenta: cada lectura o cambio filtra por user_id; el alta lo lleva en el cuerpo.
    for (const q of c.calls) {
      if (q.op === 'insert') expect(q.p.user_id).toBe('u1')
      else expect(q.f).toContainEqual(['user_id', 'u1'])
    }
  })
  it('importa sin repetidos y respetando el tope', async () => {
    const c = fakeClient()
    const api = createInvestAlerts({ client: c, isDemo: () => false })
    await api.create({ symbol: 'A', condition: 'above', threshold: 1 })
    const r = await api.importMany([{ symbol: 'A', condition: 'above', threshold: 1 }, { symbol: 'B', condition: 'below', threshold: 2 }, { symbol: '', condition: 'x' }])
    expect(r).toEqual({ ok: true, data: { added: 1, skipped: 2 } })
    expect(ALERT_LIMIT).toBe(50)
  })
  it('sin la tabla, sin sesión, en el demo y en el tope responde con un código', async () => {
    const missing = createInvestAlerts({ client: fakeClient({ error: { code: '42P01', message: 'relation "public.invest_alerts" does not exist' } }), isDemo: () => false })
    expect(await missing.list()).toEqual({ ok: false, error: 'table_missing' })
    const anon = createInvestAlerts({ client: fakeClient({ uid: null }), isDemo: () => false })
    expect(await anon.list()).toEqual({ ok: false, error: 'session_required' })
    const demo = createInvestAlerts({ client: fakeClient(), isDemo: () => true })
    expect(await demo.create({ symbol: 'A', condition: 'above', threshold: 1 })).toEqual({ ok: false, error: 'demo' })
    const cap = createInvestAlerts({ client: fakeClient({ error: { code: '23514', message: 'alert_limit' } }), isDemo: () => false })
    expect(await cap.create({ symbol: 'A', condition: 'above', threshold: 1 })).toEqual({ ok: false, error: 'limit' })
  })
})

describe('navegación a Siguiendo', () => {
  const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) } }
  beforeEach(() => __resetInvestNav())
  it('2 sub-pestañas; la guardada vale y una rara cae en Mi lista', () => {
    expect(FOLLOW_TABS).toEqual(['lista', 'descubrir'])
    const st = mem()
    expect(bootFollowTab({ storage: st })).toBe('lista')
    rememberFollowTab('descubrir', st)
    expect(st.getItem(FOLLOW_TAB_KEY)).toBe('descubrir')
    expect(bootFollowTab({ storage: st })).toBe('descubrir')
    st.setItem(FOLLOW_TAB_KEY, 'toString')
    expect(bootFollowTab({ storage: st })).toBe('lista')
    // Lo que no es una sub-pestaña no se guarda.
    rememberFollowTab('alertas', st)
    expect(st.getItem(FOLLOW_TAB_KEY)).toBe('toString')
  })
  it('las sub-pestañas viejas (Alertas, Comparar) guardadas o en el historial abren Mi lista', () => {
    for (const old of ['alertas', 'comparar']) {
      const st = mem(); st.setItem(FOLLOW_TAB_KEY, old)
      expect(bootFollowTab({ storage: st })).toBe('lista')
      globalThis.history = { state: { invFollow: old }, replaceState(s) { this.state = s } }
      expect(bootFollowTab({ storage: mem() })).toBe('lista')
      delete globalThis.history
    }
    // Ajustes › "Ver mis alertas" (queueFollow con el nombre viejo): Mi lista con las alertas enfocadas, una vez.
    queueFollow({ sub: 'alertas' })
    expect(bootTab({ search: '' })).toBe('siguiendo')
    expect(bootFollowTab({ storage: mem() })).toBe('lista')
    expect(takeFollowFocus()).toBe('alertas')
    expect(takeFollowFocus()).toBeNull()
  })
  it('desde la ficha: "Comparar" abre Mi lista con la hoja de Comparar y esos activos, una sola vez', () => {
    queueFollow({ sub: 'comparar', compare: ['aapl', 'SPY', 'x y', 'MSFT', 'QQQ', 'VOO'] })
    expect(bootTab({ search: '' })).toBe('siguiendo')
    expect(bootFollowTab({ storage: mem() })).toBe('lista')
    expect(takeFollowFocus()).toBeNull()
    expect(takeQueuedCompare()).toEqual(['AAPL', 'SPY', 'MSFT', 'QQQ'])
    expect(takeQueuedCompare()).toBeNull()
  })
})

describe('revisión 23-nov', () => {
  it('slicePeriod: fin de mes no se desborda (31-mar − 1M empieza el 28-feb)', () => {
    const days = []
    for (let d = new Date('2026-01-15T00:00:00Z'); d <= new Date('2026-03-31T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) days.push(d.toISOString().slice(0, 10))
    const rows = days.map((date, i) => ({ date, open: 1 + i, high: 1 + i, low: 1 + i, close: 1 + i, volume: 1 }))
    const out = slicePeriod(rows, 1)
    expect(out[0].date).toBe('2026-02-28')
    expect(slicePeriod(rows, 2)[0].date).toBe('2026-01-31')
  })
  it('deshacer el borrado de una alerta la devuelve con su pausa y su último aviso', async () => {
    const c = fakeClient()
    const api = createInvestAlerts({ client: c, isDemo: () => false })
    await api.list()
    const last = '2026-11-23T10:00:00.000Z'
    const r = await api.restore({ symbol: 'AAPL', condition: 'above', threshold: 200, active: false, lastTriggeredAt: last })
    expect(r.ok).toBe(true)
    expect(c.db.rows.find(x => x.id === r.data.id)).toMatchObject({ user_id: 'u1', active: false, last_triggered_at: last })
    const r2 = await api.restore({ symbol: 'MSFT', condition: 'below', threshold: 100, lastTriggeredAt: 'basura' })
    expect(c.db.rows.find(x => x.id === r2.data.id)).toMatchObject({ active: true, last_triggered_at: null })
    expect(await api.restore({ symbol: 'AAPL', condition: 'above', threshold: 200 })).toEqual({ ok: false, error: 'duplicate' })
  })
})
