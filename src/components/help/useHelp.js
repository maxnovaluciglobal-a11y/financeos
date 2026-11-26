// src/components/help/useHelp.js — estado de la ayuda de cada pantalla (ayuda
// en la app, 26-nov-2026). Va en el JS inicial y es chico: decide CUÁNDO hay
// algo que mostrar (panel, pregunta de la primera visita, recorrido) y Shell
// monta HelpHost.jsx (diferido) solo entonces.
//  - Primera visita a una pantalla con recorrido: pregunta "¿Primera vez en X?"
//    en vez de arrancar solo (antes solo el Inicio arrancaba). Nunca en el demo
//    ni con otra hoja o diálogo abierto (helpCore.isUiBusy).
//  - requestTourReplay(page) (Más, "Pregúntale a moyiq") sigue funcionando.
//  - openHelp(page) abre el panel desde otra parte de la app.
//  - Novedades sin leer: el contador del "?" se calcula en reposo (news.js).
//  - Progreso en la cuenta: progressSync.js, fuera del demo y solo con sesión.
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  HELP_OPEN_EVENT, HELP_PROGRESS_EVENT, TOUR_REPLAY_EVENT, TOUR_PAGES,
  takeTourReplay, setHelpDemo, readSeen, markSeen, readNewsRead, shouldOfferTour, isUiBusy,
  helpSyncReady, markHelpSyncReady, initHelpDevice, setHelpUnread,
} from './helpCore.js'
import { logRejection } from '../../utils/errorLog.js'

const idle = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 1200))

let deviceChecked = false
let syncStarted = false
function startSync() {
  if (syncStarted) return
  syncStarted = true
  Promise.all([import('../../core/authClient.js'), import('./progressSync.js')])
    .then(([{ authClient, AUTH_ENABLED }, { startHelpSync }]) => {
      if (!AUTH_ENABLED || !authClient) { markHelpSyncReady(); return }
      startHelpSync({ client: authClient })
    })
    .catch((e) => { markHelpSyncReady(); logRejection('help:sync')(e) })
}

export function useHelp(page, { isDemo = false, newsFilter } = {}) {
  const [panel, setPanel] = useState(false)
  const [prompt, setPrompt] = useState(null)   // página que pregunta "¿Primera vez…?"
  const [tour, setTour] = useState(null)       // página cuyo recorrido está abierto
  const [unread, setUnread] = useState(0)
  setHelpDemo(isDemo)
  // Antes de cualquier pregunta: ¿este dispositivo ya tenía datos de la app?
  if (!isDemo && !deviceChecked) { deviceChecked = true; initHelpDevice() }
  // Con un recorrido o el panel abiertos no se pregunta "¿Primera vez…?".
  const busyRef = useRef(false)
  busyRef.current = panel || !!tour

  // Progreso en la cuenta: una sola vez por carga, nunca en el demo.
  useEffect(() => {
    if (isDemo) { markHelpSyncReady(); return }
    const id = idle(startSync)
    return () => (typeof cancelIdleCallback === 'function' ? cancelIdleCallback(id) : clearTimeout(id))
  }, [isDemo])

  // Al cambiar de pantalla se cierra lo de la anterior.
  useEffect(() => { setPanel(false); setPrompt(null); setTour(null) }, [page])

  // Recorrido pedido desde otra pantalla (Más) o desde la misma (hoja del asistente).
  useEffect(() => {
    const start = () => setTimeout(() => { setPrompt(null); setPanel(false); setTour(page) }, 400)
    let id = null
    if (TOUR_PAGES.includes(page) && takeTourReplay(page)) id = start()
    const onReq = (e) => { if (e.detail?.page === page && takeTourReplay(page)) { setTour(null); id = start() } }
    window.addEventListener(TOUR_REPLAY_EVENT, onReq)
    return () => { window.removeEventListener(TOUR_REPLAY_EVENT, onReq); if (id) clearTimeout(id) }
  }, [page])

  // Abrir el panel desde otra parte (openHelp).
  useEffect(() => {
    const on = () => { setPrompt(null); setPanel(true) }
    window.addEventListener(HELP_OPEN_EVENT, on)
    return () => window.removeEventListener(HELP_OPEN_EVENT, on)
  }, [])

  // Primera visita: espera a que la página monte y a lo que trae la cuenta.
  useEffect(() => {
    if (isDemo || !TOUR_PAGES.includes(page)) return
    let cancelled = false
    const id = setTimeout(async () => {
      const ready = await helpSyncReady()
      if (!ready || cancelled || busyRef.current) return
      if (!shouldOfferTour({ page, seen: readSeen(), isDemo, busy: isUiBusy() })) return
      setPrompt(p => p || page)
    }, 900)
    return () => { cancelled = true; clearTimeout(id) }
  }, [page, isDemo])

  // Contador de novedades sin leer (en reposo; se recalcula al leer).
  useEffect(() => {
    let alive = true
    const count = () => import('./news.js').then(({ visibleNews, unreadCount }) => {
      if (!alive) return
      const n = unreadCount(visibleNews(newsFilter || {}), readNewsRead())
      setUnread(n)
      setHelpUnread(n)
    }).catch(logRejection('help:news'))
    const id = idle(count)
    window.addEventListener(HELP_PROGRESS_EVENT, count)
    return () => {
      alive = false
      window.removeEventListener(HELP_PROGRESS_EVENT, count)
      typeof cancelIdleCallback === 'function' ? cancelIdleCallback(id) : clearTimeout(id)
    }
  }, [newsFilter])

  const openPanel = useCallback(() => { setPrompt(null); setTour(null); setPanel(true) }, [])
  const closePanel = useCallback(() => setPanel(false), [])
  // Desde el panel: se cierra el panel y el recorrido arranca cuando el foco ya volvió al "?".
  const startTour = useCallback(() => { setPanel(false); setPrompt(null); setTimeout(() => setTour(page), 80) }, [page])
  const closeTour = useCallback(() => { markSeen(page); setPrompt(null); setTour(null) }, [page])
  const acceptPrompt = useCallback(() => { markSeen(page); setPrompt(null); setTour(page) }, [page])
  const dismissPrompt = useCallback(() => { markSeen(page); setPrompt(null) }, [page])
  // La pantalla no tiene nada que mostrar todavía (vacía o sin el plan): no se marca.
  const skipPrompt = useCallback(() => setPrompt(null), [])

  return {
    panel, prompt, tour, unread,
    active: panel || !!prompt || !!tour,
    openPanel, closePanel, startTour, closeTour, acceptPrompt, dismissPrompt, skipPrompt,
  }
}
