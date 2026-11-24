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
// (lo ya borrado vuelve a dar 0 filas). Un corte de red o de sesión frena los
// pasos que faltan, que vuelven como 'not_tried'.
// Respuesta: { ok, error?, done: [tabla], skipped: [tabla], failed: [{ step, error }] }.
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

// Error de PostgREST → código corto. 42501: sin permiso (falta la política o el grant).
function dbCode(err) {
  if (err?.code === '42501' || /permission denied|row-level security/i.test(String(err?.message || ''))) return 'denied'
  if (err?.code === 'PGRST301' || /JWT|jwt expired/i.test(String(err?.message || ''))) return 'session_required'
  return 'delete_failed'
}

export function createInvestErase({ client = authClient, isDemo = isDemoUrl, timeoutMs = TIMEOUT_MS, storage = defaultStorage, resets = [] } = {}) {
  const run = (q) => withTimeout(q, timeoutMs)
  const net = (e) => (e?.message === 'timeout' ? 'timeout' : 'network')

  function clearLocal() {
    const st = typeof storage === 'function' ? storage() : storage
    for (const k of LOCAL_KEYS) { try { st?.removeItem(k) } catch { /* modo privado: no había nada guardado */ } }
    for (const fn of resets) { try { fn() } catch { /* una caché en memoria se vacía al recargar */ } }
  }

  async function eraseTable(table, uid) {
    const res = await run(client.from(table).delete().eq('user_id', uid))
    if (res?.error) return isMissingTable(res.error) ? 'missing' : dbCode(res.error)
    const left = await run(client.from(table).select('user_id', { count: 'exact', head: true }).eq('user_id', uid))
    if (left?.error) return isMissingTable(left.error) ? 'missing' : 'verify_failed'
    return Number(left?.count) > 0 ? 'not_deleted' : 'ok'
  }

  return {
    async eraseAll() {
      const out = { done: [], skipped: [], failed: [] }
      if (isDemo()) return { ok: false, error: 'demo', ...out }
      if (!client) return { ok: false, error: 'auth_unavailable', ...out }
      let uid
      try {
        const { data } = await run(client.auth.getSession())
        uid = data?.session?.user?.id || null
      } catch (e) { return { ok: false, error: net(e), ...out } }
      if (!uid) return { ok: false, error: 'session_required', ...out }

      const steps = [...ERASE_TABLES, PLANS_STEP]
      let stopped = null
      for (const step of steps) {
        if (stopped) { out.failed.push({ step, error: 'not_tried' }); continue }
        let r
        try {
          if (step === PLANS_STEP) {
            const { error } = await run(client.auth.updateUser({ data: { [PLANS_KEY]: plansPayload([]) } }))
            r = error ? dbCode(error) === 'session_required' ? 'session_required' : 'save_failed' : 'ok'
          } else r = await eraseTable(step, uid)
        } catch (e) { r = net(e) }
        if (r === 'ok') out.done.push(step)
        else if (r === 'missing') out.skipped.push(step)
        else {
          out.failed.push({ step, error: r })
          if (STOP.has(r)) stopped = r
        }
      }
      // Lo del dispositivo se borra siempre: se vuelve a armar desde el servidor.
      clearLocal()
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
