// src/components/lock/AppLockGate.jsx — decide si la app se ve o se pide el PIN (T14).
//
// Envuelve <AppProvider><Inner/></AppProvider> en App.jsx (solo el camino
// real: el demo y el CRM interno no pasan por acá, no se bloquean). Mientras
// está bloqueada renderiza SOLO <AppLock/>: AppProvider ni siquiera se monta,
// así que no hay datos financieros en el árbol de React ni en el DOM.
//
// Cuándo bloquea:
//   · al arrancar (arranque en frío / recarga), si el bloqueo está activo;
//   · al volver de segundo plano si pasó el tiempo elegido (1/5/15 min),
//     medido con visibilitychange + timestamp;
//   · "Bloquear ahora" desde Ajustes.
//
// Mientras la app está en segundo plano se oculta #root (clase en <html>):
// el selector de apps del sistema muestra la captura del último frame, y no
// queremos que esa captura tenga montos. Al volver, si corresponde bloquear,
// la pantalla de bloqueo se monta (flushSync) ANTES de quitar el velo.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import AppLock from './AppLock.jsx'
import { getLockConfig } from '../../core/appLockStore.js'
import { isLockEnabled, shouldLockOnResume } from '../../core/appLock.js'
import { getSettings } from '../../core/db/index.js'

const AppLockContext = createContext(null)

// null fuera del gate (modo demo) → Ajustes no muestra la tarjeta de Seguridad.
export function useAppLock() {
  return useContext(AppLockContext)
}

const VEIL_CLASS = 'fos-lock-veil'

export default function AppLockGate({ children }) {
  const [ready, setReady] = useState(false)
  const [config, setConfig] = useState(null)
  const [locked, setLocked] = useState(false)
  const configRef = useRef(null)
  const lockedRef = useRef(false)
  const hiddenAtRef = useRef(null)

  const applyConfig = useCallback((c) => {
    const cfg = isLockEnabled(c) ? c : null
    configRef.current = cfg
    setConfig(cfg)
    return cfg
  }, [])

  const setLockedBoth = useCallback((v) => { lockedRef.current = v; setLocked(v) }, [])

  // Arranque: leer bloqueo + idioma/tema (la pantalla de bloqueo se muestra
  // antes de que AppProvider exista, así que fijamos lang/data-theme acá).
  // Si leer la configuración falla, la app abre sin bloqueo: un error de
  // IndexedDB nunca debe dejar la app inutilizable.
  useEffect(() => {
    let cancelled = false
    Promise.all([getLockConfig().catch(() => null), getSettings().catch(() => null)]).then(([c, st]) => {
      if (cancelled) return
      if (st) {
        document.documentElement.setAttribute('data-theme', st.theme || 'light')
        document.documentElement.setAttribute('lang', st.language || 'es')
      }
      const cfg = applyConfig(c)
      setLockedBoth(!!cfg)
      setReady(true)
    })
    return () => { cancelled = true }
  }, [applyConfig, setLockedBoth])

  useEffect(() => {
    const root = document.documentElement
    function onVisibility() {
      const cfg = configRef.current
      if (document.visibilityState === 'hidden') {
        if (cfg && !lockedRef.current) {
          hiddenAtRef.current = Date.now()
          root.classList.add(VEIL_CLASS)
        }
        return
      }
      if (cfg && !lockedRef.current && shouldLockOnResume(hiddenAtRef.current, Date.now(), cfg.timeoutMin)) {
        flushSync(() => setLockedBoth(true))
      }
      hiddenAtRef.current = null
      root.classList.remove(VEIL_CLASS)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      root.classList.remove(VEIL_CLASS)
    }
  }, [setLockedBoth])

  const refresh = useCallback(async () => applyConfig(await getLockConfig()), [applyConfig])
  const lockNow = useCallback(() => { if (configRef.current) setLockedBoth(true) }, [setLockedBoth])
  const value = useMemo(() => ({ config, refresh, lockNow }), [config, refresh, lockNow])

  if (!ready) return null
  if (locked && config) {
    return <AppLock config={config} onUnlocked={() => setLockedBoth(false)} />
  }
  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>
}
