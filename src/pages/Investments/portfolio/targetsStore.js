// src/pages/Investments/portfolio/targetsStore.js — Objetivos de Portafolio
// compartidos con Planificar › Aportes ("Según tus objetivos", F5).
// Solo en memoria mientras la app está abierta, como antes en PortfolioTab:
// llevan tickers y no se guardan en el dispositivo. Cambiar de cuenta recarga
// la página (core/deviceOwner.js), así que no pasan de una cuenta a otra.
import { useCallback, useSyncExternalStore } from 'react'

let current = null
const subs = new Set()

export const getTargets = () => current
export function setTargetsValue(tg) {
  current = tg && typeof tg === 'object' ? { ...tg } : null
  for (const fn of subs) fn()
}
function subscribe(fn) { subs.add(fn); return () => subs.delete(fn) }

export function useTargets() {
  const tg = useSyncExternalStore(subscribe, getTargets, () => null)
  const set = useCallback((v) => setTargetsValue(v), [])
  return [tg, set]
}

// Solo para pruebas.
export function __resetTargets() { current = null; subs.clear() }
