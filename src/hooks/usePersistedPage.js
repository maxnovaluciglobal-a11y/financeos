// Persiste la página activa en localStorage para restaurar al reabrir la app.
// Ignora páginas legales y settings (no tiene sentido restaurarlas).
import { useState } from 'react'

const STORAGE_KEY = 'fos_active_page'
const SKIP_PERSIST = new Set(['privacy', 'terms', 'license', 'disclaimer'])

// `override`: página pedida por un enlace de correo (utils/deepLink.js). Gana sobre
// la guardada: es una intención explícita de esta visita.
export function usePersistedPage(initial = 'dashboard', override = null) {
  const [page, setPageState] = useState(() => {
    if (override) return override
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved && !SKIP_PERSIST.has(saved) ? saved : initial
    } catch {
      return initial
    }
  })

  function setPage(next) {
    setPageState(next)
    if (!SKIP_PERSIST.has(next)) {
      try { localStorage.setItem(STORAGE_KEY, next) } catch {}
    }
  }

  return [page, setPage]
}
