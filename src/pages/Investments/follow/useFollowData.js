// src/pages/Investments/follow/useFollowData.js — datos de Siguiendo (F4).
//
// Todo en memoria, nunca en el dispositivo (la lista ya vive en la tabla
// watchlist, las alertas en invest_alerts):
//  · lista: core/investData.js (RLS por auth.uid());
//  · alertas: core/investAlerts.js;
//  · precios: investApi.quotes en lotes de 10, refrescados cada 5 min solo con
//    la pestaña visible (como Resumen);
//  · historias de un año: SOLO en Vista completa (tendencia, RSI, MACD,
//    volumen, 52 semanas), una por símbolo y de a 3 en paralelo (runLimited,
//    Invest liQueue), compartidas con la ficha por la caché de investApi.
// Demo: nada sale a la red; todo viene de demo/demoInvestFollow.js.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { investApi } from '../../../core/investApi.js'
import { investData } from '../../../core/investData.js'
import { investAlerts } from '../../../core/investAlerts.js'
import { runLimited } from '../../../utils/investHoy.js'
import { isDuplicate, validateAlert } from '../../../utils/investAlerts.js'
import { DEMO_WATCH, demoAlerts, demoFollowHistory, demoFollowQuotes } from '../../../demo/demoInvestFollow.js'

const REFRESH_MS = 5 * 60 * 1000
const HISTORY_LIMIT = 3

// Estado del demo compartido entre visitas a la pestaña (memoria de la página).
let demoState = null
const demoStore = () => (demoState ||= { watch: [...DEMO_WATCH], alerts: demoAlerts() })
// Las alertas del demo, también para la ficha del activo (misma memoria).
export const demoAlertList = () => demoStore().alerts
export function demoSaveAlert(prev, input) {
  const v = validateAlert(input)
  if (!v.ok) return v
  const st = demoStore()
  if (isDuplicate(st.alerts, v.value, prev?.id || null)) return { ok: false, error: 'duplicate' }
  const a = { ...(prev || {}), id: prev?.id || `demo-al-${Date.now()}`, ...v.value, active: true, lastTriggeredAt: null, createdAt: prev?.createdAt || new Date().toISOString() }
  st.alerts = prev ? st.alerts.map(x => (x.id === prev.id ? a : x)) : [...st.alerts, a]
  return { ok: true, data: a, demo: true }
}

export function useFollowData({ demo = false, full = false } = {}) {
  const [watch, setWatch] = useState({ phase: 'loading', list: [], error: null })
  const [alerts, setAlerts] = useState({ phase: 'loading', list: [], error: null })
  const [quotes, setQuotes] = useState({})
  const [quotesFailed, setQuotesFailed] = useState(false)
  const [hist, setHist] = useState({}) // ticker → filas | null (falló)
  const [retry, setRetry] = useState(0)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const loadWatch = useCallback(async () => {
    if (demo) { setWatch({ phase: 'ready', list: demoStore().watch, error: null }); return }
    setWatch(w => ({ ...w, phase: w.list.length ? 'refreshing' : 'loading', error: null }))
    const r = await investData.listWatchlist()
    if (!alive.current) return
    setWatch(r.ok ? { phase: 'ready', list: r.data, error: null } : { phase: 'error', list: [], error: r.error })
  }, [demo])

  const loadAlerts = useCallback(async (force = false) => {
    if (demo) { setAlerts({ phase: 'ready', list: demoStore().alerts, error: null }); return }
    const r = await investAlerts.list({ force })
    if (!alive.current) return
    setAlerts(r.ok ? { phase: 'ready', list: r.data, error: null } : { phase: 'error', list: [], error: r.error })
  }, [demo])

  useEffect(() => { loadWatch(); loadAlerts() }, [loadWatch, loadAlerts, retry])

  // Precios de lo que se sigue y de lo que tiene alerta.
  const symbols = useMemo(() => [...new Set([...watch.list, ...alerts.list.map(a => a.symbol)])].sort(), [watch.list, alerts.list])
  const symKey = symbols.join(',')
  const fetchQuotes = useCallback(async (list) => {
    if (!list.length) return
    if (demo) { setQuotes(q => ({ ...q, ...demoFollowQuotes(list) })); return }
    const r = await investApi.quotes(list)
    if (!alive.current) return
    setQuotesFailed(Object.keys(r).length === 0)
    setQuotes(q => ({ ...q, ...r }))
  }, [demo])
  useEffect(() => { fetchQuotes(symKey ? symKey.split(',') : []) }, [symKey, fetchQuotes])
  useEffect(() => {
    if (demo || !symKey) return undefined
    let id = null
    const tick = () => { if (document.visibilityState === 'visible') fetchQuotes(symKey.split(',')) }
    const start = () => { if (!id) id = setInterval(tick, REFRESH_MS) }
    const stop = () => { if (id) { clearInterval(id); id = null } }
    const onVis = () => { if (document.visibilityState === 'visible') { tick(); start() } else stop() }
    start()
    document.addEventListener('visibilitychange', onVis)
    return () => { stop(); document.removeEventListener('visibilitychange', onVis) }
  }, [demo, symKey, fetchQuotes])

  // Historias: solo en Vista completa y solo de lo que se sigue.
  const watchKey = watch.list.join(',')
  useEffect(() => {
    if (!full || !watchKey) return undefined
    const todo = watchKey.split(',').filter(t => !(t in hist))
    if (!todo.length) return undefined
    if (demo) { setHist(h => ({ ...h, ...Object.fromEntries(todo.map(t => [t, demoFollowHistory(t)])) })); return undefined }
    let ok = true
    runLimited(todo.map(t => async () => {
      const rows = await investApi.history(t, '1y', '1d')
      if (ok && alive.current) setHist(h => ({ ...h, [t]: rows || null }))
    }), HISTORY_LIMIT, () => ok && alive.current)
    return () => { ok = false }
  // `hist` queda fuera a propósito: cada resultado nuevo no vuelve a planear.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full, watchKey, demo, retry])

  // ── Lista ──
  const follow = useCallback(async (ticker) => {
    const t = String(ticker || '').toUpperCase().trim()
    if (demo) {
      const st = demoStore()
      if (st.watch.includes(t)) return { ok: true, data: { ticker: t, existed: true }, demo: true }
      st.watch = [...st.watch, t]
      setWatch({ phase: 'ready', list: st.watch, error: null })
      return { ok: true, data: { ticker: t, existed: false }, demo: true }
    }
    const r = await investData.addWatch(t)
    if (r.ok && !r.data.existed) setWatch(w => ({ ...w, list: w.list.includes(r.data.ticker) ? w.list : [...w.list, r.data.ticker] }))
    return r
  }, [demo])
  const unfollow = useCallback(async (ticker) => {
    if (demo) {
      const st = demoStore()
      st.watch = st.watch.filter(x => x !== ticker)
      setWatch({ phase: 'ready', list: st.watch, error: null })
      return { ok: true, demo: true }
    }
    const r = await investData.removeWatch(ticker)
    if (r.ok) setWatch(w => ({ ...w, list: w.list.filter(x => x !== ticker) }))
    return r
  }, [demo])
  // Deshacer: vuelve a su lugar en la lista (Invest rmWatch).
  const refollow = useCallback(async (ticker, index) => {
    const r = demo ? { ok: true } : await investData.addWatch(ticker)
    if (!r.ok) return r
    if (demo) demoStore().watch = insertAt(demoStore().watch, ticker, index)
    setWatch(w => ({ ...w, list: insertAt(w.list, ticker, index) }))
    return { ok: true }
  }, [demo])

  // ── Alertas ──
  const saveAlert = useCallback(async (prev, input) => {
    if (demo) {
      const r = demoSaveAlert(prev, input)
      if (r.ok) setAlerts({ phase: 'ready', list: demoStore().alerts, error: null })
      return r
    }
    const r = prev ? await investAlerts.update(prev.id, { ...input, active: prev.active }) : await investAlerts.create(input)
    if (r.ok) setAlerts(s => ({ ...s, phase: 'ready', list: prev ? s.list.map(x => (x.id === prev.id ? r.data : x)) : [...s.list, r.data] }))
    return r
  }, [demo])
  const deleteAlert = useCallback(async (a) => {
    if (demo) {
      const st = demoStore()
      st.alerts = st.alerts.filter(x => x.id !== a.id)
      setAlerts({ phase: 'ready', list: st.alerts, error: null })
      return { ok: true, demo: true }
    }
    const r = await investAlerts.remove(a.id)
    if (r.ok) setAlerts(s => ({ ...s, list: s.list.filter(x => x.id !== a.id) }))
    return r
  }, [demo])
  // Deshacer un borrado: vuelve tal cual estaba (pausa y último aviso incluidos).
  const restoreAlert = useCallback(async (a) => {
    if (demo) {
      const st = demoStore()
      if (!st.alerts.some(x => x.id === a.id)) st.alerts = [...st.alerts, { ...a }]
      setAlerts({ phase: 'ready', list: st.alerts, error: null })
      return { ok: true, demo: true, data: a }
    }
    const r = await investAlerts.restore(a)
    if (r.ok) setAlerts(s => ({ ...s, phase: 'ready', list: [...s.list, r.data] }))
    return r
  }, [demo])
  const setAlertActive = useCallback(async (a, active) => {
    if (demo) {
      const st = demoStore()
      st.alerts = st.alerts.map(x => (x.id === a.id ? { ...x, active, lastTriggeredAt: active ? null : x.lastTriggeredAt } : x))
      setAlerts({ phase: 'ready', list: st.alerts, error: null })
      return { ok: true, demo: true }
    }
    const r = await investAlerts.setActive(a.id, active)
    if (r.ok) setAlerts(s => ({ ...s, list: s.list.map(x => (x.id === a.id ? r.data : x)) }))
    return r
  }, [demo])
  const importAlerts = useCallback(async (items) => {
    if (demo) return { ok: false, error: 'demo' }
    const r = await investAlerts.importMany(items)
    if (r.ok) loadAlerts(true)
    return r
  }, [demo, loadAlerts])

  return {
    watch, alerts, quotes, quotesFailed, hist,
    follow, unfollow, refollow,
    saveAlert, deleteAlert, restoreAlert, setAlertActive, importAlerts,
    reload: () => { setHist(h => Object.fromEntries(Object.entries(h).filter(([, v]) => v != null))); setRetry(n => n + 1) },
  }
}

function insertAt(list, t, index) {
  if (list.includes(t)) return list
  const out = [...list]
  out.splice(Math.max(0, Math.min(index ?? out.length, out.length)), 0, t)
  return out
}

// Solo para pruebas.
export function __resetDemoFollow() { demoState = null }
