// src/core/investErase.js — "Eliminar mis datos de Inversiones" (F7, Ajustes ›
// Inversiones). Borra SOLO lo de Inversiones de la persona, nunca la cuenta,
// sus finanzas ni la suscripción:
//  · en el servidor, sus filas de invest_alerts, watchlist, invest_operations y
//    portfolio_holdings, desde el cliente y con la sesión de la persona: las
//    políticas RLS "delete own" (auth.uid() = user_id) ya existen en las cuatro
//    (baseline 20261019185000 para holdings y watchlist, 20261120000100 para
//    alertas, invest-web 20261031120000 para operaciones). No hace falta una
//    migración ni una función con service_role;
//  · los planes guardados de Planificar (metadatos de la cuenta, invest_plans);
//  · en el dispositivo, el snapshot de totales y el aporte del mes, y las
//    cachés en memoria (las pasa quien llama: objetivos, investData, alertas).
// Se conservan el perfil de inversionista, la regla de riesgo y el capital de
// referencia: son ajustes, no registros, y se cambian en Planificar.
//
// Sin borrados a medias en silencio: después de cada DELETE se cuenta lo que
// queda (un DELETE sin política RLS no da error, borra 0 filas). Lo que no se
// pudo borrar vuelve en `failed` con su motivo; se puede repetir sin riesgo
// (lo ya borrado vuelve a dar 0 filas).
//
// Cortes de red. postgrest-js y auth-js NO lanzan cuando falla el fetch:
// resuelven { data: null, error: { message: 'TypeError: Failed to fetch',
// code: '' } } con status 0 (auth-js: AuthRetryableFetchError). isNetworkError()
// lo reconoce (y también AbortError, el tiempo agotado y el dispositivo sin
// red) y se trata igual que un corte: se frenan los pasos que faltan, que
// vuelven como 'not_tried'. Antes del primer borrado se hace una consulta de
// prueba: si el servidor no responde, no se envió nada y se dice "no se borró
// nada". Si el pedido ya había salido y no llegó respuesta, el servidor pudo
// haberlo hecho: ese paso vuelve con `sent: true` ("sin confirmar").
//
// Lo que se limpia al terminar:
//  · las cachés en memoria (`resets`), si al menos un paso del servidor se hizo
//    o quedó sin confirmar: así las otras pestañas vuelven a pedir los datos y
//    no muestran lo ya borrado;
//  · lo que vive solo en el dispositivo (LOCAL_KEYS: el aporte del mes no se
//    vuelve a armar), solo si todos los pasos del servidor se completaron. Si
//    no, queda para el reintento.
// Respuesta: { ok, error?, done: [tabla], skipped: [tabla], failed: [{ step, error, sent? }] }.
import { authClient } from './authClient.js'
import { isMissingTable } from './investData.js'
import { PLANS_KEY, plansPayload } from '../utils/investPlan.js'

export const ERASE_TABLES = ['invest_alerts', 'watchlist', 'invest_operations', 'portfolio_holdings']
export const PLANS_STEP = 'invest_plans'
// Claves fos_* de Inversiones con datos de la persona (investBridge.SNAPSHOT_KEY
// y hoy/aporteStore.APORTE_KEY; investErase.test.js comprueba que coincidan).
// Las preferencias de vista (pestaña, vista esencial, moneda de las cifras) no
// son datos y quedan.
export const LOCAL_KEYS = ['fos_invest_snapshot_v1', 'fos_invest_aporte_monthly']
const TIMEOUT_MS = 10000

function withTimeout(promise, ms) {
  let id
  const timeout = new Promise((_, reject) => { id = setTimeout(() => reject(new Error('timeout')), ms) })
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(id))
}
const isDemoUrl = () => { try { return /[?&]demo=true\b/.test(window.location.search) } catch { return false } }
const defaultStorage = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null } }
const STOP = new Set(['network', 'timeout', 'session_required'])

const NET_MSG = /failed to fetch|fetch failed|networkerror|network request failed|load failed|err_internet_disconnected|err_network|aborted|abort/i
const isOffline = () => { try { return typeof navigator !== 'undefined' && navigator.onLine === false } catch { return false } }

// ¿El error es de red (no hubo respuesta HTTP)? `status` es el de la
// respuesta de supabase-js (0 o ausente cuando falló el fetch).
export function isNetworkError(err, status) {
  if (!err) return false
  if (err.name === 'AbortError' || err.name === 'AuthRetryableFetchError' || err.name === 'TypeError') return true
  // Un error de Postgres o de PostgREST siempre trae su código: hubo respuesta.
  if (err.code !== '' && err.code != null) return false
  if (NET_MSG.test(String(err.message || ''))) return true
  if (!status && !err.status) return true
  return isOffline()
}

// Error de PostgREST → código corto. 42501: sin permiso (falta la política o el grant).
function dbCode(err, status) {
  if (err?.message === 'timeout') return 'timeout'
  if (isNetworkError(err, status)) return 'network'
  if (err?.code === '42501' || /permission denied|row-level security/i.test(String(err?.message || ''))) return 'denied'
  if (err?.code === 'PGRST301' || /JWT|jwt expired/i.test(String(err?.message || ''))) return 'session_required'
  return 'delete_failed'
}

export function createInvestErase({ client = authClient, isDemo = isDemoUrl, timeoutMs = TIMEOUT_MS, storage = defaultStorage, resets = [], offline = isOffline } = {}) {
  const run = (q) => withTimeout(q, timeoutMs)
  const net = (e) => (e?.message === 'timeout' ? 'timeout' : 'network')

  function clearDevice() {
    const st = typeof storage === 'function' ? storage() : storage
    for (const k of LOCAL_KEYS) { try { st?.removeItem(k) } catch { /* modo privado: no había nada guardado */ } }
  }
  function resetCaches() {
    for (const fn of resets) { try { fn() } catch { /* una caché en memoria se vacía al recargar */ } }
  }
  const countLeft = (table, uid) => client.from(table).select('user_id', { count: 'exact', head: true }).eq('user_id', uid)

  async function eraseTable(table, uid, markSent) {
    const q = client.from(table).delete().eq('user_id', uid)
    markSent()
    const res = await run(q)
    if (res?.error) return isMissingTable(res.error) ? 'missing' : dbCode(res.error, res.status)
    const left = await run(countLeft(table, uid))
    if (left?.error) {
      if (isMissingTable(left.error)) return 'missing'
      const c = dbCode(left.error, left.status)
      return c === 'network' || c === 'timeout' ? c : 'verify_failed'
    }
    return Number(left?.count) > 0 ? 'not_deleted' : 'ok'
  }

  return {
    async eraseAll() {
      const out = { done: [], skipped: [], failed: [] }
      if (isDemo()) return { ok: false, error: 'demo', ...out }
      if (!client) return { ok: false, error: 'auth_unavailable', ...out }
      const steps = [...ERASE_TABLES, PLANS_STEP]
      const noneTried = (error) => ({ ok: false, error, ...out, failed: steps.map(step => ({ step, error: 'not_tried' })) })
      if (offline()) return noneTried('network')
      let uid
      try {
        const { data, error } = await run(client.auth.getSession())
        if (error && isNetworkError(error, error.status)) return { ok: false, error: 'network', ...out }
        uid = data?.session?.user?.id || null
      } catch (e) { return { ok: false, error: net(e), ...out } }
      if (!uid) return { ok: false, error: 'session_required', ...out }

      // Consulta de prueba (solo lectura): sin servidor no se envía ningún borrado.
      try {
        const probe = await run(countLeft(ERASE_TABLES[0], uid))
        const code = probe?.error && !isMissingTable(probe.error) ? dbCode(probe.error, probe.status) : null
        if (code === 'network' || code === 'timeout' || code === 'session_required') return noneTried(code)
      } catch (e) { return noneTried(net(e)) }

      let stopped = null
      for (const step of steps) {
        if (!stopped && offline()) stopped = 'network'
        if (stopped) { out.failed.push({ step, error: 'not_tried' }); continue }
        let r
        let sent = false
        const markSent = () => { sent = true }
        try {
          if (step === PLANS_STEP) {
            const q = client.auth.updateUser({ data: { [PLANS_KEY]: plansPayload([]) } })
            markSent()
            const { error } = await run(q)
            if (!error) r = 'ok'
            else {
              const c = dbCode(error, error.status)
              r = c === 'network' || c === 'timeout' || c === 'session_required' ? c : 'save_failed'
            }
          } else r = await eraseTable(step, uid, markSent)
        } catch (e) { r = net(e) }
        if (r === 'ok') out.done.push(step)
        else if (r === 'missing') out.skipped.push(step)
        else {
          // Sin respuesta después de enviar: no sabemos si el servidor lo hizo.
          out.failed.push(sent && (r === 'network' || r === 'timeout') ? { step, error: r, sent: true } : { step, error: r })
          if (STOP.has(r)) stopped = r
        }
      }
      const touched = out.done.length > 0 || out.failed.some(f => f.sent)
      if (!out.failed.length) clearDevice()
      if (touched || !out.failed.length) resetCaches()
      if (out.failed.length) return { ok: false, error: stopped || 'partial', ...out }
      return { ok: true, ...out }
    },
  }
}

// Palabra que pide la confirmación, sin importar mayúsculas ni espacios
// alrededor: ELIMINAR (como en Invest) vale en cualquier idioma; en en/pt/de
// también la palabra que muestra la pantalla en ese idioma.
export const ERASE_WORD = 'ELIMINAR'
export function eraseWordOk(v, localWord = ERASE_WORD) {
  const s = String(v ?? '').trim().toLocaleUpperCase()
  return !!s && (s === ERASE_WORD || s === String(localWord || '').trim().toLocaleUpperCase())
}
