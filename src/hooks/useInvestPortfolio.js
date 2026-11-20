// src/hooks/useInvestPortfolio.js — estado del módulo Inversiones para la UI.
// Fases: off (módulo apagado) · locked (sin perfil de inversionista o sin
// cuenta: no se pide nada al servidor) · loading (sin dato todavía) · ready ·
// stale (hay un valor guardado pero no se pudo actualizar; offline dice por
// qué) · error.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { useInvestAccess } from './useInvestAccess.js'
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
  const access = useInvestAccess()
  const allowed = on && (demo || access.status === 'granted')
  const [snap, setSnap] = useState(() => (allowed && !demo ? readSnapshot(safeStorage) : null))
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
    if (!allowed || demo) return undefined
    load(false)
    return subscribeSnapshot((s) => { setSnap(s); setPhase('ready') })
  }, [allowed, demo, load])

  const refresh = useCallback(() => load(true), [load])
  const current = useMemo(() => (demo ? demoInvestSnapshot() : snap), [demo, snap])
  const inv = useMemo(() => (allowed ? investValueForUser(current, settings, readKey) : null), [allowed, current, settings])
  const rate = useMemo(() => (allowed ? resolveUserRate(settings, current?.fx, readKey) : null), [allowed, current, settings])

  return {
    on,
    demo,
    access: access.status,
    phase: !on ? 'off' : !allowed ? 'locked' : demo ? 'ready' : phase,
    snapshot: allowed ? current : null,
    inv,
    rate,
    refresh,
    offline: typeof navigator !== 'undefined' && navigator.onLine === false,
  }
}
