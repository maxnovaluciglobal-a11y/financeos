// src/hooks/useInvestPortfolio.js — estado del módulo Inversiones para la UI.
// Fases: off (módulo apagado) · loading (sin dato todavía) · ready · stale (hay
// un valor guardado pero no se pudo actualizar; offline dice por qué) · error.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { loadSnapshot, readSnapshot, subscribeSnapshot } from '../core/investBridge.js'
import { demoInvestSnapshot } from '../demo/demoInvest.js'
import { moduleOn } from '../utils/modules.js'
import { investValueForUser, resolveUserRate } from '../utils/investNetWorth.js'

const safeStorage = {
  getItem: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  setItem: (k, v) => { try { localStorage.setItem(k, v) } catch { /* almacenamiento o API del navegador no disponible: se sigue sin ello */ } },
}
const readKey = (k) => safeStorage.getItem(k)

export function useInvestPortfolio() {
  const { settings = {} } = useApp() || {}
  const on = moduleOn(settings, 'investments')
  const demo = !!settings.isDemo
  const [snap, setSnap] = useState(() => (on && !demo ? readSnapshot(safeStorage) : null))
  const [phase, setPhase] = useState('loading')

  const load = useCallback((force) => {
    setPhase('loading')
    return loadSnapshot({ force, storage: safeStorage })
      .then((s) => { setSnap(s); setPhase('ready') })
      .catch(() => {
        const last = readSnapshot(safeStorage)
        setSnap(last)
        setPhase(last ? 'stale' : 'error')
      })
  }, [])

  useEffect(() => {
    if (!on || demo) return undefined
    load(false)
    return subscribeSnapshot((s) => { setSnap(s); setPhase('ready') })
  }, [on, demo, load])

  const refresh = useCallback(() => load(true), [load])
  const current = useMemo(() => (demo ? demoInvestSnapshot() : snap), [demo, snap])
  const inv = useMemo(() => (on ? investValueForUser(current, settings, readKey) : null), [on, current, settings])
  const rate = useMemo(() => (on ? resolveUserRate(settings, current?.fx, readKey) : null), [on, current, settings])

  return {
    on,
    demo,
    phase: !on ? 'off' : demo ? 'ready' : phase,
    snapshot: on ? current : null,
    inv,
    rate,
    refresh,
    offline: typeof navigator !== 'undefined' && navigator.onLine === false,
  }
}
