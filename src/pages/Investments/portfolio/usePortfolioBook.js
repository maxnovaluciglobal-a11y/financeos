// src/pages/Investments/portfolio/usePortfolioBook.js — datos de Portafolio (F1).
//
// Posiciones, libro de operaciones y capital de la cuenta (core/investData.js,
// RLS por auth.uid()), cotizaciones y tipos de cambio de la API de Invest
// (core/investApi.js). TODO vive en memoria mientras la pantalla está abierta:
// nada de posiciones, operaciones ni tickers se guarda en el dispositivo. En
// el demo, la tienda de ejemplo (demo/demoInvestBook.js), también en memoria.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { investData, newOperationUid, RULE_DEFAULTS } from '../../../core/investData.js'
import { investApi } from '../../../core/investApi.js'
import { createDemoInvestStore, demoInvestFundamentals, demoInvestFx, demoInvestQuotes } from '../../../demo/demoInvestBook.js'
import { assetRates, currencyOf, readArsKind, toUsd } from '../../../utils/investValuation.js'
import { positionRows, quoteLists } from '../../../utils/investPositions.js'
import { book } from '../../../utils/investLedger.js'
import { planTrade, localToday } from '../../../utils/investTrade.js'

let demoStore = null
const demoStoreOnce = () => (demoStore = demoStore || createDemoInvestStore())

const readKey = (k) => { try { return localStorage.getItem(k) } catch { return null } }

export function usePortfolioBook({ demo = false } = {}) {
  const store = demo ? demoStoreOnce() : investData
  const [st, setSt] = useState({ phase: 'loading', holdings: [], ops: [], opsState: 'loading', capital: null, rule: RULE_DEFAULTS, error: null })
  const [mkt, setMkt] = useState({ phase: 'loading', quotes: {}, latam: null, ars: null, at: null })
  const [arsKind, setArsKindState] = useState(() => readArsKind(readKey))
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const loadMarket = useCallback(async (holdings) => {
    if (demo) { setMkt({ phase: 'ready', quotes: demoInvestQuotes(), latam: demoInvestFx(), ars: null, at: Date.now() }); return }
    setMkt(m => ({ ...m, phase: m.at ? 'refreshing' : 'loading' }))
    const { stocks, crypto } = quoteLists(holdings)
    const [q, c, latam] = await Promise.all([
      stocks.length ? investApi.quotes(stocks) : {},
      crypto.length ? investApi.crypto(crypto) : {},
      investApi.fxLatam(),
    ])
    const quotes = { ...q, ...c }
    const needsArs = holdings.some(h => currencyOf(h.t, quotes[h.t]?.currency) === 'ARS')
    const ars = needsArs || readKey('fos_invest_display_ccy') === 'ARS' ? await investApi.fxArs() : null
    if (!alive.current) return
    const asked = stocks.length + crypto.length
    setMkt({ phase: asked && !Object.keys(quotes).length ? 'error' : 'ready', quotes, latam, ars, at: Date.now() })
  }, [demo])

  const load = useCallback(async ({ force = false } = {}) => {
    setSt(s => ({ ...s, phase: s.phase === 'ready' ? 'refreshing' : 'loading' }))
    const [h, o, p] = await Promise.all([store.listHoldings({ force }), store.listOperations(), store.getProfile()])
    if (!alive.current) return
    if (!h.ok) { setSt(s => ({ ...s, phase: s.phase === 'refreshing' ? 'ready' : 'error', error: h.error })); return }
    setSt({
      phase: 'ready',
      holdings: h.data,
      ops: o.ok ? o.data : [],
      opsState: o.ok ? 'ready' : o.error === 'table_missing' ? 'missing' : 'error',
      capital: p.ok ? p.data.capital : null,
      rule: p.ok ? p.data.rule : RULE_DEFAULTS,
      error: null,
    })
    loadMarket(h.data)
  }, [store, loadMarket])

  useEffect(() => { load() }, [load])

  const rates = useMemo(() => assetRates(mkt.latam, mkt.ars, arsKind), [mkt.latam, mkt.ars, arsKind])
  const cols = store.columns ? store.columns() : { stop: true, fx: true }
  const positions = useMemo(() => positionRows(st.holdings, mkt.quotes, rates.rates, { limit: st.rule.limit, estimate: !cols.stop }), [st.holdings, mkt.quotes, rates.rates, st.rule.limit, cols.stop])
  const ccyOf = useCallback((t) => currencyOf(t, mkt.quotes[t]?.currency), [mkt.quotes])
  const usd = useCallback((v, c) => toUsd(v, c, rates.rates), [rates.rates])
  const ledger = useMemo(() => book(st.ops, st.holdings, {
    ccyOf,
    priceOf: (t) => mkt.quotes[t]?.price ?? null,
    toUsd: usd,
  }), [st.ops, st.holdings, mkt.quotes, ccyOf, usd])

  // ── Escrituras: cada una devuelve { ok, error?, ... } y recarga lo que cambió ──
  const refreshHoldings = useCallback(async () => {
    const h = await store.listHoldings({ force: true })
    if (h.ok && alive.current) { setSt(s => ({ ...s, holdings: h.data })); loadMarket(h.data) }
  }, [store, loadMarket])
  const refreshOps = useCallback(async () => {
    const o = await store.listOperations()
    if (o.ok && alive.current) setSt(s => ({ ...s, ops: o.data, opsState: 'ready' }))
  }, [store])

  const saveHolding = useCallback(async (prev, input, opts = {}) => {
    const r = prev ? await store.updateHolding(prev, input) : await store.addHolding(input, opts)
    if (r.ok) await refreshHoldings()
    return r
  }, [store, refreshHoldings])

  const setStop = useCallback(async (prev, stop) => {
    const r = await store.updateHolding(prev, { ...prev, stop })
    if (r.ok) await refreshHoldings()
    return r
  }, [store, refreshHoldings])

  const deleteHolding = useCallback(async (row) => {
    const r = await store.deleteHolding(row.id)
    if (r.ok) await refreshHoldings()
    return r
  }, [store, refreshHoldings])

  // Primero la operación; después la posición. Si la posición no se pudo
  // ajustar, la operación queda guardada y se avisa (effectFailed).
  const recordTrade = useCallback(async (form) => {
    const t = String(form.ticker || '').toUpperCase().trim()
    const lots = st.holdings.filter(h => h.t === t)
    const plan = planTrade(form, { lots, ops: st.ops, quoteCcy: mkt.quotes[t]?.currency, rates: rates.rates, today: localToday(), uid: newOperationUid() })
    if (!plan.ok) return { ok: false, error: 'invalid', fields: plan.errors }
    const saved = await store.saveOperations([plan.op])
    if (!saved.ok) return saved
    await refreshOps()
    const e = plan.effect
    let effectOk = true
    if (e.kind === 'create') effectOk = (await store.addHolding(e.input, { allowZeroCost: e.input.cost === 0 })).ok
    else if (e.kind === 'update') effectOk = (await store.updateHolding(e.prev, e.input)).ok
    if (e.kind === 'create' || e.kind === 'update') await refreshHoldings()
    return { ok: true, op: plan.op, effect: e, effectFailed: !effectOk }
  }, [st.holdings, st.ops, mkt.quotes, rates.rates, store, refreshOps, refreshHoldings])

  const deleteOperation = useCallback(async (op) => {
    const r = await store.deleteOperations([op.uid])
    if (r.ok) await refreshOps()
    return r
  }, [store, refreshOps])

  // Importar: una por una, como Invest; devuelve cuántas entraron.
  const importHoldings = useCallback(async (rows) => {
    let ok = 0
    for (const r of rows) {
      const res = await store.addHolding({ t: r.t, type: r.type, sh: r.sh, cost: r.cost, stop: r.stop ?? null, fxCost: r.fxCost ?? null, note: r.note || '' })
      if (res.ok) ok++
    }
    await refreshHoldings()
    return { ok: ok === rows.length, imported: ok, total: rows.length }
  }, [store, refreshHoldings])

  const importOperations = useCallback(async (ops) => {
    if (!ops.length) return { ok: true, imported: 0 }
    const r = await store.saveOperations(ops)
    await refreshOps()
    return { ok: r.ok, imported: r.ok ? ops.length : (r.data?.saved?.length || 0), total: ops.length, error: r.error }
  }, [store, refreshOps])

  const setCapital = useCallback(async (valueUsd) => {
    const r = await store.setCapital(valueUsd)
    if (r.ok && alive.current) setSt(s => ({ ...s, capital: r.data.capital }))
    return r
  }, [store])

  const setArsKind = useCallback((k) => {
    try { localStorage.setItem('fos_invest_ars_kind', k) } catch { /* modo privado: vale para esta visita */ }
    setArsKindState(k === 'Oficial' ? 'Oficial' : 'MEP')
  }, [])

  // Fundamentales para Dividendos: se piden al abrir la pestaña (cuota de Finnhub/FMP).
  const [funds, setFunds] = useState({ phase: 'idle', data: {}, key: '' })
  const loadFundamentals = useCallback(async ({ force = false } = {}) => {
    const tickers = [...new Set(st.holdings.filter(h => h.type !== 'Crypto').map(h => h.t))].sort()
    const key = tickers.join(',')
    if (!force && funds.key === key && (funds.phase === 'ready' || funds.phase === 'loading')) return
    if (demo) { setFunds({ phase: 'ready', data: demoInvestFundamentals(), key }); return }
    setFunds({ phase: 'loading', data: {}, key })
    const data = tickers.length ? await investApi.fundamentals(tickers) : {}
    // Cripto no paga dividendos: no cuenta como "sin respuesta".
    for (const h of st.holdings) if (h.type === 'Crypto') data[h.t] = { dividendYield: null }
    if (alive.current) setFunds({ phase: tickers.length && !Object.keys(data).some(t => tickers.includes(t)) ? 'error' : 'ready', data, key })
  }, [st.holdings, demo, funds.key, funds.phase])

  return {
    demo, store,
    phase: st.phase, error: st.error,
    holdings: st.holdings, ops: st.ops, opsState: st.opsState,
    capital: st.capital, rule: st.rule,
    market: mkt, rates, arsKind, setArsKind,
    positions, ledger, ccyOf, toUsd: usd,
    columns: cols,
    funds, loadFundamentals,
    reload: () => load({ force: true }),
    saveHolding, setStop, deleteHolding, recordTrade, deleteOperation, importHoldings, importOperations, setCapital,
  }
}
