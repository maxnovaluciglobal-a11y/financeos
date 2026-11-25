// src/core/localAlerts/Host.jsx — avisos locales: programar, mostrar y pedir
// el permiso (24-nov-2026). Lo monta Shell con lazy(): no pesa en la carga
// inicial (scripts/bundleBudget.js).
//
//  · App de tienda: cada vez que cambian los datos o la app vuelve al frente,
//    recalcula (plan.js) y reemplaza lo programado en @capacitor/local-
//    notifications (native.js). Solo con el permiso concedido; en el demo no.
//  · Web/PWA: no hay servidor que mande estos avisos. Lo que vence ahora sale
//    como notificación del sistema solo si el permiso ya está concedido (se
//    pide siempre por la hoja de ejemplos, core/pushPrimer.js) y mientras
//    moyiq está abierto; además se ven en la tarjeta del Inicio
//    (pages/Dashboard/LocalAlertsCard.jsx).
//  · Permiso en la app de tienda: requestLocalAlerts() (primer.js) abre la
//    hoja de ejemplos (PushAsk mode="local") y recién con "Permitir" pide el
//    permiso del sistema. Pedido automático: shouldAskLocal(), evaluado recién
//    después de guardar desde el Registro rápido (evento QUICKADD_SAVED_EVENT
//    del Shell), igual que el pedido automático de la web; nunca al abrir la
//    app ni encima de otra hoja (Novedades, el recorrido).
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { isNativeApp } from '../../native/platform.js'
import { fmtMoney, currencySymbol, catName } from '../../utils/index.js'
import { ExtrasStringsGate } from '../../extras/strings.js'
import { planLocalAlerts, alertPrefs, alertText, dueNow, withRecorded, withFireTimes, readLedger } from './plan.js'
import { setLocalPrimerHost, shouldAskLocal, LOCAL_ASKED_KEY } from './primer.js'
import { readPushAsk, snoozedPushAsk } from '../pushAsk.js'
import { logRejection } from '../../utils/errorLog.js'

const PushAsk = lazy(() => import('../../components/PushAsk.jsx'))
export const LEDGER_KEY = 'fos_local_alerts'
// Lo emite el Shell al guardar desde el Registro rápido.
export const QUICKADD_SAVED_EVENT = 'fos:quickadd-saved'
const loadNative = () => import('./native.js')

function readLS(k) { try { return localStorage.getItem(k) } catch { return null } }
function writeLS(k, v) { try { localStorage.setItem(k, v) } catch { /* sin almacenamiento: se reintenta al abrir */ } }

export default function LocalAlertsHost() {
  return (
    <Suspense fallback={null}>
      <ExtrasStringsGate><Inner /></ExtrasStringsGate>
    </Suspense>
  )
}

function Inner() {
  const app = useApp()
  const { t, lang } = useT()
  const native = isNativeApp()
  const { incomes, expenses, setAsides, budgets, recurring, settings, showToast } = app
  const isDemo = !!settings?.isDemo
  const [askOpen, setAskOpen] = useState(false)
  const waiters = useRef([])
  const auto = useRef(false)
  const [tick, setTick] = useState(0)

  // Volver al frente (pestaña visible o la app que sale del fondo) recalcula.
  useEffect(() => {
    const on = () => { if (document.visibilityState === 'visible') setTick(n => n + 1) }
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])

  const texts = useCallback((alerts) => {
    const sym = currencySymbol(settings?.currency, settings?.language)
    const amounts = alertPrefs(settings).amounts
    const money = (n) => fmtMoney(n, sym)
    const cat = (c) => catName(c, lang)
    return alerts.map(a => ({ ...a, ...alertText(a, { t, money, cat, amounts }) })).filter(a => a.title)
  }, [settings, t, lang])

  // Programar / disparar (con un respiro para no recalcular en cada tecla).
  useEffect(() => {
    if (isDemo) return
    const id = setTimeout(() => run().catch(logRejection('localAlerts:schedule')), 1500)
    async function run() {
      const now = Date.now()
      const ledger = readLedger(readLS(LEDGER_KEY))
      const { alerts } = planLocalAlerts({ incomes, expenses, setAsides, budgets, recurring, settings, now, ledger })
      if (native) {
        const n = await loadNative()
        if (!n.localAlertsAvailable() || (await n.localPermission()) !== 'granted') return
        const items = withFireTimes(texts(alerts), now)
        const r = await n.scheduleLocal(items, { channelName: t('la.settings.title'), now })
        // El ledger guarda la hora real de entrega de lo que quedó programado.
        if (r?.ok) writeLS(LEDGER_KEY, JSON.stringify(withRecorded(ledger, r.scheduled || [], now)))
        return
      }
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
      const due = texts(dueNow(alerts, now))
      if (!due.length) return
      const icon = `${import.meta.env?.BASE_URL || '/app/'}icon-192.png`
      const reg = await navigator.serviceWorker?.getRegistration?.().catch(() => null)
      const shown = []
      for (const a of due) {
        const opts = { body: a.body, tag: a.key, icon }
        try {
          // Chrome en Android no deja usar new Notification() (lanza): ahí
          // solo sirve el service worker. Sin ninguno, queda la tarjeta del Inicio.
          if (reg?.showNotification) await reg.showNotification(a.title, opts)
          else new Notification(a.title, opts)
          shown.push({ ...a, at: now })
        } catch (err) { logRejection('localAlerts:notify')(err) }
      }
      if (shown.length) writeLS(LEDGER_KEY, JSON.stringify(withRecorded(ledger, shown, now)))
    }
    return () => clearTimeout(id)
  }, [incomes, expenses, setAsides, budgets, recurring, settings, native, isDemo, texts, t, tick])

  // ── Hoja de ejemplos para el permiso de avisos locales (app de tienda)
  useEffect(() => {
    if (!native) return
    return setLocalPrimerHost(() => new Promise((resolve) => {
      waiters.current.push(resolve)
      setAskOpen(true)
    }))
  }, [native])

  // Pedido automático: después de guardar desde el Registro rápido (como el
  // de la web, Shell › pushCheck), con los conteos ya al día y sin otra hoja
  // abierta (la del Registro rápido cerrándose, Novedades, el recorrido): si
  // hay una, queda para el próximo guardado.
  const countRef = useRef(0)
  countRef.current = (incomes?.length || 0) + (expenses?.length || 0)
  useEffect(() => {
    if (!native || isDemo) return
    let alive = true
    const timers = []
    const otherSheet = () => !!document.querySelector('[aria-modal="true"]')
    const check = async (tries) => {
      if (!alive) return
      if (otherSheet()) { if (tries > 0) timers.push(setTimeout(() => check(tries - 1), 700)); return }
      const n = await loadNative()
      const available = n.localAlertsAvailable()
      const permission = available ? await n.localPermission() : 'unsupported'
      if (!alive || otherSheet() || !shouldAskLocal({ available, permission, asked: readLS(LOCAL_ASKED_KEY), isDemo, movementCount: countRef.current })) return
      auto.current = true
      setAskOpen(true)
    }
    const onSaved = () => timers.push(setTimeout(() => check(2).catch(logRejection('localAlerts:auto')), 600))
    window.addEventListener(QUICKADD_SAVED_EVENT, onSaved)
    return () => { alive = false; timers.forEach(clearTimeout); window.removeEventListener(QUICKADD_SAVED_EVENT, onSaved) }
  }, [native, isDemo])

  const enable = useCallback(async () => (await loadNative()).enableLocalAlerts(), [])

  function onResult(r) {
    const wasAuto = auto.current
    auto.current = false
    // Solo el "Ahora no" del pedido automático cuenta (y pospone): no un
    // error, ni la hoja pedida desde Primeros pasos o Ajustes.
    if (wasAuto && r?.error === 'dismissed') writeLS(LOCAL_ASKED_KEY, snoozedPushAsk(readPushAsk(readLS(LOCAL_ASKED_KEY))))
    if (r?.ok) setTick(n => n + 1)
    const ws = waiters.current.splice(0)
    for (const w of ws) w(r)
    if (!wasAuto && ws.length) return
    if (r?.ok) showToast?.(t('la.enabled'))
  }

  if (!askOpen) return null
  return (
    <Suspense fallback={null}>
      <PushAsk open={askOpen} mode="local" onEnable={enable} onClose={() => setAskOpen(false)} onResult={onResult} />
    </Suspense>
  )
}
