// src/utils/swOpen.js — destino pedido por el service worker con la app abierta.
//
// Al tocar un aviso push con la app ya abierta, public/push-sw.js le manda a
// la ventana { type: 'moyiq-open', open: '<destino de ?open=>' } con un
// MessageChannel. La app cambia de pantalla por estado (sin recargar, sin
// perder lo que estaba a medio llenar) y contesta { ok: true }; si no contesta,
// el service worker recarga con navigate(url) como respaldo.
import { pageFromSearch } from './deepLink.js'

export const OPEN_MESSAGE = 'moyiq-open'

// Aplica el mensaje: true si lo entendió y va al destino. Inversiones carga
// investNav.js con import() (no pesa en la carga inicial, scripts/
// bundleBudget.js): primero deja la pestaña en cola y recién después cambia de
// página, así Inversiones la toma al montar. Si el import falla, igual abre
// Inversiones en su pestaña de siempre.
export function openFromMessage(data, setPage) {
  if (!data || data.type !== OPEN_MESSAGE || typeof data.open !== 'string' || typeof setPage !== 'function') return false
  const open = data.open
  if (!/^[a-z-]{1,40}$/.test(open)) return false
  const page = pageFromSearch(`?open=${open}`)
  if (!page) return false
  if (page === 'investments') {
    import('./investNav.js')
      .then(m => m.openInvestLink(open), () => {})
      .then(() => setPage(page))
    return true
  }
  setPage(page)
  return true
}

// Escucha los mensajes del service worker. Devuelve la función para dejar de escuchar.
export function listenSwOpen(setPage, sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : null) {
  if (!sw || typeof sw.addEventListener !== 'function') return () => {}
  const onMessage = (e) => {
    if (!e?.data || e.data.type !== OPEN_MESSAGE) return
    const ok = openFromMessage(e.data, setPage)
    try { e.ports?.[0]?.postMessage({ ok }) } catch { /* el service worker ya no espera */ }
  }
  sw.addEventListener('message', onMessage)
  // Los mensajes del service worker esperan en cola hasta startMessages() (o
  // hasta que termina de cargar el documento).
  try { sw.startMessages?.() } catch { /* navegador viejo */ }
  return () => sw.removeEventListener('message', onMessage)
}
