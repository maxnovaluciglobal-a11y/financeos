// src/core/investAlerts.js — alertas de precio de Inversiones en el servidor (F4).
//
// Tabla public.invest_alerts (migración 20261120000100) con RLS por auth.uid():
// cada cuenta lee y cambia solo las suyas; cada escritura filtra además por
// user_id, como investData.js. La función programada invest-alerts-check las
// revisa y avisa por push. Mientras la migración no esté aplicada, la tabla no
// existe: todo responde { ok: false, error: 'table_missing' } y la pantalla lo
// dice con calma (nunca un error genérico).
//
// PRIVACIDAD: nada se guarda en el dispositivo; caché solo en memoria, por
// cuenta (se vacía al cambiar de cuenta, como investData).
// Respuestas: { ok: true, data } o { ok: false, error: '<código>', fields? }.
import { authClient } from './authClient.js'
import { isMissingTable } from './investData.js'
import { ALERT_LIMIT, fromRow, isDuplicate, validateAlert } from '../utils/investAlerts.js'

export const ALERT_COLUMNS = 'id,symbol,condition,threshold,active,last_triggered_at,created_at'
const TIMEOUT_MS = 8000

function withTimeout(promise, ms) {
  let id
  const timeout = new Promise((_, reject) => { id = setTimeout(() => reject(new Error('timeout')), ms) })
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(id))
}
const isDemoUrl = () => { try { return /[?&]demo=true\b/.test(window.location.search) } catch { return false } }
const missing = (err) => isMissingTable(err) || /invest_alerts/i.test(String(err?.message || '')) && /does not exist|schema cache/i.test(String(err?.message || ''))
// El trigger invest_alerts_cap responde 23514 'alert_limit'.
const isLimit = (err) => err?.code === '23514' && /alert_limit/.test(String(err?.message || ''))

export function createInvestAlerts({ client = authClient, isDemo = isDemoUrl, timeoutMs = TIMEOUT_MS } = {}) {
  let mem = { uid: null, list: null }
  const run = (q) => withTimeout(q, timeoutMs)
  const fail = (error, extra) => ({ ok: false, error, ...extra })
  const net = (e) => (e?.message === 'timeout' ? 'timeout' : 'network')

  async function session() {
    if (!client) return { error: 'auth_unavailable' }
    try {
      const { data } = await run(client.auth.getSession())
      const uid = data?.session?.user?.id || null
      if (!uid) return { error: 'session_required' }
      if (mem.uid !== uid) mem = { uid, list: null }
      return { uid }
    } catch { return { error: 'timeout' } }
  }
  const guardWrite = async () => (isDemo() ? { error: 'demo' } : session())
  const dbError = (err, fallback) => (missing(err) ? 'table_missing' : isLimit(err) ? 'limit' : fallback)

  return {
    async list({ force = false } = {}) {
      const s = await session()
      if (s.error) return fail(s.error)
      if (!force && mem.list) return { ok: true, data: mem.list }
      try {
        const res = await run(client.from('invest_alerts').select(ALERT_COLUMNS).eq('user_id', s.uid).order('created_at'))
        if (res.error) return fail(dbError(res.error, 'alerts_failed'))
        mem.list = (res.data || []).map(fromRow).filter(Boolean)
        return { ok: true, data: mem.list }
      } catch (e) { return fail(net(e)) }
    },
    async create(input) {
      const v = validateAlert(input)
      if (!v.ok) return v
      if (mem.list && isDuplicate(mem.list, v.value)) return fail('duplicate')
      if (mem.list && mem.list.length >= ALERT_LIMIT) return fail('limit')
      const s = await guardWrite()
      if (s.error) return fail(s.error)
      try {
        const res = await run(client.from('invest_alerts').insert({ user_id: s.uid, ...v.value, active: true }).select(ALERT_COLUMNS))
        if (res.error) return fail(dbError(res.error, 'save_failed'))
        const a = fromRow(Array.isArray(res.data) ? res.data[0] : res.data)
        if (a && mem.list) mem.list = [...mem.list, a]
        return { ok: true, data: a }
      } catch (e) { return fail(net(e)) }
    },
    // Deshacer un borrado: la misma alerta, activa o en pausa y con su último
    // aviso (si no, una alerta que ya sonó hoy volvería a sonar antes de 24 h).
    async restore(alert) {
      const v = validateAlert(alert || {})
      if (!v.ok) return v
      if (mem.list && isDuplicate(mem.list, v.value)) return fail('duplicate')
      if (mem.list && mem.list.length >= ALERT_LIMIT) return fail('limit')
      const s = await guardWrite()
      if (s.error) return fail(s.error)
      const ms = alert.lastTriggeredAt ? Date.parse(alert.lastTriggeredAt) : NaN
      const row = { user_id: s.uid, ...v.value, active: alert.active !== false, last_triggered_at: Number.isFinite(ms) ? new Date(ms).toISOString() : null }
      try {
        const res = await run(client.from('invest_alerts').insert(row).select(ALERT_COLUMNS))
        if (res.error) return fail(dbError(res.error, 'save_failed'))
        const a = fromRow(Array.isArray(res.data) ? res.data[0] : res.data)
        if (a && mem.list) mem.list = [...mem.list, a]
        return { ok: true, data: a }
      } catch (e) { return fail(net(e)) }
    },
    // Editar nivel o condición vuelve a armar la alerta (borra el último aviso).
    async update(id, input) {
      const v = validateAlert(input)
      if (!v.ok) return v
      if (mem.list && isDuplicate(mem.list, v.value, id)) return fail('duplicate')
      const s = await guardWrite()
      if (s.error) return fail(s.error)
      try {
        const patch = { ...v.value, active: input.active !== false, last_triggered_at: null }
        const res = await run(client.from('invest_alerts').update(patch).eq('id', id).eq('user_id', s.uid).select(ALERT_COLUMNS))
        if (res.error) return fail(dbError(res.error, 'save_failed'))
        const a = fromRow(Array.isArray(res.data) ? res.data[0] : res.data)
        if (!a) return fail('not_found')
        if (mem.list) mem.list = mem.list.map(x => (x.id === id ? a : x))
        return { ok: true, data: a }
      } catch (e) { return fail(net(e)) }
    },
    async setActive(id, active) {
      const s = await guardWrite()
      if (s.error) return fail(s.error)
      try {
        const patch = active ? { active: true, last_triggered_at: null } : { active: false }
        const res = await run(client.from('invest_alerts').update(patch).eq('id', id).eq('user_id', s.uid).select(ALERT_COLUMNS))
        if (res.error) return fail(dbError(res.error, 'save_failed'))
        const a = fromRow(Array.isArray(res.data) ? res.data[0] : res.data)
        if (!a) return fail('not_found')
        if (mem.list) mem.list = mem.list.map(x => (x.id === id ? a : x))
        return { ok: true, data: a }
      } catch (e) { return fail(net(e)) }
    },
    async remove(id) {
      const s = await guardWrite()
      if (s.error) return fail(s.error)
      try {
        const res = await run(client.from('invest_alerts').delete().eq('id', id).eq('user_id', s.uid))
        if (res.error) return fail(dbError(res.error, 'delete_failed'))
        if (mem.list) mem.list = mem.list.filter(x => x.id !== id)
        return { ok: true, data: { id } }
      } catch (e) { return fail(net(e)) }
    },
    // Traspaso: varias de una vez (las repetidas y las que pasan el tope se saltan).
    async importMany(items) {
      const s = await guardWrite()
      if (s.error) return fail(s.error)
      const cur = mem.list ? [...mem.list] : (await this.list()).data || []
      const room = Math.max(0, ALERT_LIMIT - cur.length)
      const fresh = []
      for (const it of items || []) {
        const v = validateAlert(it)
        if (!v.ok || isDuplicate([...cur, ...fresh], v.value)) continue
        fresh.push(v.value)
      }
      const take = fresh.slice(0, room)
      if (!take.length) return { ok: true, data: { added: 0, skipped: (items || []).length } }
      try {
        const res = await run(client.from('invest_alerts').insert(take.map(x => ({ user_id: s.uid, ...x, active: true }))).select(ALERT_COLUMNS))
        if (res.error) return fail(dbError(res.error, 'save_failed'))
        const added = (res.data || []).map(fromRow).filter(Boolean)
        mem.list = [...cur, ...added]
        return { ok: true, data: { added: added.length, skipped: (items || []).length - added.length } }
      } catch (e) { return fail(net(e)) }
    },
    clear() { mem = { uid: null, list: null } },
  }
}

export const investAlerts = createInvestAlerts()

if (typeof window !== 'undefined' && authClient?.auth?.onAuthStateChange) {
  let last
  authClient.auth.onAuthStateChange((_ev, session) => {
    const uid = session?.user?.id || null
    if (last !== undefined && uid !== last) investAlerts.clear()
    last = uid
  })
}
