// src/components/help/progressSync.js — progreso de la ayuda en la cuenta
// (aprobado por Walter el 26-nov-2026; migración 20261126010000_help_progress).
//
// Qué se guarda: los ids de los recorridos vistos y de las novedades leídas.
// Nada financiero. Fuente: la fila de la cuenta (help_progress) MÁS la copia
// local (helpCore.js); se usa la unión, así lo que se vio en el teléfono no se
// vuelve a ofrecer en la computadora.
//  - Al arrancar (con sesión, fuera del demo): trae la fila, la suma a lo local
//    y, si lo local tiene algo que la cuenta no, lo manda.
//  - Cada cambio local se manda a los 1,2 s (se agrupan). Si la página se cierra
//    o pasa a segundo plano antes, se manda en ese momento con fetch keepalive,
//    que el navegador termina aunque la página ya no exista.
//  - Sin red o con error: queda la marca fos_help_dirty y se reintenta al volver
//    la red o en el próximo arranque. Nunca se muestra un error: es una marca de
//    "ya lo vi", no algo que la persona tenga que confirmar.
// El demo nunca llama a este módulo (useHelp.js).
import {
  TOURS_SEEN_KEY, NEWS_READ_KEY, HELP_DIRTY_KEY, HELP_PROGRESS_EVENT,
  readList, markHelpSyncReady, isPreReleaseAccount, seedAllToursSeen,
} from './helpCore.js'

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/
export const SAVE_DELAY_MS = 1200

/** Ids válidos, sin repetir, ordenados, como máximo 200 (igual que la base). */
export function cleanIds(list) {
  return [...new Set((Array.isArray(list) ? list : []).filter(x => typeof x === 'string' && ID.test(x)))].sort().slice(0, 200)
}

/**
 * Une lo local con lo de la cuenta. `localChanged`: hay que escribir la copia
 * local; `needsSave`: la cuenta no tiene todo lo local. Pura.
 */
export function mergeProgress(local, server) {
  const lt = cleanIds(local?.tours), ln = cleanIds(local?.news)
  const st = cleanIds(server?.tours), sn = cleanIds(server?.news)
  const tours = cleanIds([...lt, ...st]), news = cleanIds([...ln, ...sn])
  return {
    tours, news,
    localChanged: tours.length !== lt.length || news.length !== ln.length,
    needsSave: tours.length !== st.length || news.length !== sn.length,
  }
}

/** Pedido a la RPC, armado aparte para poder probarlo (keepalive incluido). Pura. */
export function rpcRequest({ url, anonKey, token, tours, news }) {
  return {
    url: `${String(url).replace(/\/+$/, '')}/rest/v1/rpc/merge_help_progress`,
    init: {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_tours: cleanIds(tours), p_news: cleanIds(news) }),
    },
  }
}

const fromRow = (row) => ({
  tours: Array.isArray(row?.tours_seen) ? row.tours_seen : [],
  news: Array.isArray(row?.news_read) ? row.news_read : [],
})

/**
 * Arranca la sincronización. Devuelve stop() (tests). Dependencias inyectables:
 * client (supabase-js), storage, fetch, win, url/anonKey.
 */
export function startHelpSync({
  client,
  storage = globalThis.localStorage,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  win = globalThis.window,
  url = import.meta.env?.VITE_SUPABASE_URL,
  anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY,
} = {}) {
  let token = null
  let user = null
  let timer = null
  let stopped = false
  let inFlight = null

  const local = () => ({ tours: readList(TOURS_SEEN_KEY, storage), news: readList(NEWS_READ_KEY, storage) })
  const dirty = () => { try { return storage?.getItem(HELP_DIRTY_KEY) === '1' } catch { return false } }
  const setDirty = (on) => { try { on ? storage?.setItem(HELP_DIRTY_KEY, '1') : storage?.removeItem(HELP_DIRTY_KEY) } catch { /* modo privado */ } }
  const writeLocal = ({ tours, news }) => {
    try {
      storage?.setItem(TOURS_SEEN_KEY, JSON.stringify(tours))
      storage?.setItem(NEWS_READ_KEY, JSON.stringify(news))
    } catch { /* modo privado: queda la cuenta */ }
  }

  async function refreshToken() {
    try {
      const { data } = await client.auth.getSession()
      token = data?.session?.access_token || null
      user = data?.session?.user || null
    } catch { token = null }
    return token
  }

  // Manda lo local. keepalive: el navegador termina el pedido aunque la página
  // se cierre. Con éxito, la respuesta (la unión en la cuenta) vuelve a lo local.
  function flush() {
    if (stopped || !url || !anonKey || !fetchImpl) return Promise.resolve(false)
    if (!token) return Promise.resolve(false)
    if (win?.navigator && win.navigator.onLine === false) return Promise.resolve(false)
    const { url: u, init } = rpcRequest({ url, anonKey, token, ...local() })
    const sent = JSON.parse(init.body)
    inFlight = fetchImpl(u, init)
      .then(async (res) => {
        if (!res?.ok) return false
        const body = await res.json().catch(() => null)
        const merged = mergeProgress(local(), { tours: body?.tours_seen, news: body?.news_read })
        if (merged.localChanged) writeLocal(merged)
        // Si mientras viajaba se marcó algo nuevo, queda pendiente.
        const now = local()
        const pending = now.tours.some(x => !sent.p_tours.includes(x)) || now.news.some(x => !sent.p_news.includes(x))
        setDirty(pending)
        return true
      })
      .catch(() => false)
      .finally(() => { inFlight = null })
    return inFlight
  }

  function schedule() {
    clearTimeout(timer)
    timer = setTimeout(async () => { await refreshToken(); flush() }, SAVE_DELAY_MS)
  }

  const onChange = () => schedule()
  // Cerrar o pasar a segundo plano: se manda ya, sin esperar el temporizador.
  const onHide = () => {
    if (!dirty() || inFlight) return
    clearTimeout(timer); timer = null
    flush()
  }
  const onVisibility = () => { if (win?.document?.visibilityState === 'hidden') onHide() }
  const onOnline = () => { if (dirty()) schedule() }

  win?.addEventListener?.(HELP_PROGRESS_EVENT, onChange)
  win?.addEventListener?.('pagehide', onHide)
  win?.document?.addEventListener?.('visibilitychange', onVisibility)
  win?.addEventListener?.('online', onOnline)

  const ready = (async () => {
    try {
      if (!client || !(await refreshToken())) return
      // Cuenta de antes de la ayuda: todos los recorridos vistos (helpCore.js).
      if (isPreReleaseAccount(user?.created_at)) seedAllToursSeen(storage)
      const { data, error } = await client.from('help_progress').select('tours_seen, news_read').maybeSingle()
      if (error) { if (dirty()) schedule(); return }
      const merged = mergeProgress(local(), fromRow(data))
      if (merged.localChanged) writeLocal(merged)
      if (merged.needsSave || dirty()) { setDirty(true); schedule() }
    } catch { /* sin red: queda lo local */ }
    finally { markHelpSyncReady() }
  })()

  return {
    ready,
    flush: async () => { clearTimeout(timer); timer = null; await refreshToken(); return flush() },
    stop() {
      stopped = true
      clearTimeout(timer)
      win?.removeEventListener?.(HELP_PROGRESS_EVENT, onChange)
      win?.removeEventListener?.('pagehide', onHide)
      win?.document?.removeEventListener?.('visibilitychange', onVisibility)
      win?.removeEventListener?.('online', onOnline)
    },
    get inFlight() { return inFlight },
  }
}
