// Vista esencial / completa (utils/investView.js) como hook: la sección y la
// ficha del activo leen la misma elección y se enteran del cambio al instante.
import { useCallback, useSyncExternalStore } from 'react'
import { createViewStore, DEFAULT_VIEW } from '../../../utils/investView.js'

const storage = {
  getItem: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  setItem: (k, v) => { try { localStorage.setItem(k, v) } catch { /* modo privado: vale para esta visita */ } },
}
const store = createViewStore(storage)

export function useInvestView() {
  const view = useSyncExternalStore(store.subscribe, store.get, () => DEFAULT_VIEW)
  const setView = useCallback((v) => store.set(v), [])
  return [view, setView]
}
