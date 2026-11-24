import { describe, it, expect, vi } from 'vitest'
import { createInvestErase, ERASE_TABLES, LOCAL_KEYS, PLANS_STEP, eraseWordOk, isNetworkError } from './investErase.js'
import { eraseOutcome } from '../pages/Investments/settings/model.js'
import { SNAPSHOT_KEY } from './investBridge.js'
import { APORTE_KEY } from '../pages/Investments/hoy/aporteStore.js'
import { PLANS_KEY } from '../utils/investPlan.js'

// Supabase falso: registra cada consulta y responde con `reply(q)`.
function fakeClient(reply = () => ({ data: null, error: null, count: 0 }), { uid = 'u1', update = null } = {}) {
  const log = []
  function builder(table) {
    const q = { table, verb: 'select', filters: [], opts: null }
    const b = {
      select(cols, opts) { if (q.verb === 'select') { q.cols = cols; q.opts = opts || null } return b },
      delete() { q.verb = 'delete'; return b },
      eq(k, v) { q.filters.push(['eq', k, v]); return b },
      then(res, rej) { log.push(q); return Promise.resolve(reply(q)).then(res, rej) },
    }
    return b
  }
  return {
    log,
    from: vi.fn(builder),
    auth: {
      getSession: async () => ({ data: { session: uid ? { user: { id: uid } } : null } }),
      updateUser: vi.fn(update || (async () => ({ data: {}, error: null }))),
    },
  }
}
const memStorage = (init = {}) => {
  const m = new Map(Object.entries(init))
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }
}
const mk = (client, extra = {}) => createInvestErase({ client, isDemo: () => false, storage: memStorage(), ...extra })

describe('Eliminar mis datos de Inversiones (F7)', () => {
  it('borra solo las 4 tablas de Inversiones, filtradas por la persona, y verifica que no quedó nada', async () => {
    const c = fakeClient()
    const r = await mk(c).eraseAll()
    expect(r).toMatchObject({ ok: true, done: [...ERASE_TABLES, PLANS_STEP], failed: [], skipped: [] })
    const dels = c.log.filter(q => q.verb === 'delete')
    expect(dels.map(q => q.table)).toEqual(ERASE_TABLES)
    for (const q of dels) expect(q.filters).toEqual([['eq', 'user_id', 'u1']])
    // Primero una consulta de prueba (solo lectura), después un conteo por tabla.
    const checks = c.log.filter(q => q.verb === 'select')
    expect(checks.map(q => q.table)).toEqual([ERASE_TABLES[0], ...ERASE_TABLES])
    expect(c.log[0].verb).toBe('select')
    for (const q of checks) expect(q.opts).toEqual({ count: 'exact', head: true })
    // Nada de la cuenta, las finanzas ni la suscripción.
    const touched = new Set(c.log.map(q => q.table))
    for (const t of ['profiles', 'cloud_backups', 'licenses', 'push_subscriptions', 'consents']) expect(touched.has(t)).toBe(false)
  })

  it('vacía los planes guardados (metadatos) y conserva perfil, regla y capital', async () => {
    const c = fakeClient()
    await mk(c).eraseAll()
    expect(c.auth.updateUser).toHaveBeenCalledTimes(1)
    const { data } = c.auth.updateUser.mock.calls[0][0]
    expect(Object.keys(data)).toEqual([PLANS_KEY])
    expect(data[PLANS_KEY].list).toEqual([])
  })

  it('borra lo de Inversiones del dispositivo y corre las limpiezas en memoria', async () => {
    const storage = memStorage({ [SNAPSHOT_KEY]: '{}', [APORTE_KEY]: '100', fos_invest_view: 'completa', fos_expenses: '[]' })
    const reset = vi.fn()
    await mk(fakeClient(), { storage, resets: [reset, () => { throw new Error('x') }] }).eraseAll()
    expect(storage.m.has(SNAPSHOT_KEY)).toBe(false)
    expect(storage.m.has(APORTE_KEY)).toBe(false)
    expect(storage.m.get('fos_expenses')).toBe('[]')
    expect(storage.m.get('fos_invest_view')).toBe('completa')
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('las claves locales son las de investBridge y aporteStore', () => {
    expect(LOCAL_KEYS).toEqual([SNAPSHOT_KEY, APORTE_KEY])
  })

  it('una tabla sin política de borrado (DELETE sin error pero quedan filas) se informa, no se calla', async () => {
    const c = fakeClient(q => (q.verb === 'select' && q.table === 'watchlist' ? { count: 3, error: null } : { count: 0, error: null }))
    const r = await mk(c).eraseAll()
    expect(r.ok).toBe(false)
    expect(r.error).toBe('partial')
    expect(r.failed).toEqual([{ step: 'watchlist', error: 'not_deleted' }])
    expect(r.done).toEqual(['invest_alerts', 'invest_operations', 'portfolio_holdings', PLANS_STEP])
  })

  it('permiso denegado (42501) sigue con las demás tablas', async () => {
    const c = fakeClient(q => (q.verb === 'delete' && q.table === 'invest_alerts' ? { error: { code: '42501', message: 'permission denied' } } : { count: 0, error: null }))
    const r = await mk(c).eraseAll()
    expect(r.failed).toEqual([{ step: 'invest_alerts', error: 'denied' }])
    expect(r.done).toContain('portfolio_holdings')
  })

  it('tabla que todavía no existe: se salta sin error', async () => {
    const c = fakeClient(q => (q.table === 'invest_operations' && q.verb === 'delete' ? { error: { code: '42P01', message: 'relation "invest_operations" does not exist' } } : { count: 0, error: null }))
    const r = await mk(c).eraseAll()
    expect(r.ok).toBe(true)
    expect(r.skipped).toEqual(['invest_operations'])
  })

  it('un corte de red (lanzado) frena el resto y lo marca como no intentado; lo local queda para el reintento', async () => {
    let n = 0
    const c = fakeClient(q => { if (q.verb === 'delete' && ++n === 2) throw new Error('fetch failed'); return { count: 0, error: null } })
    const storage = memStorage({ [SNAPSHOT_KEY]: '{}', [APORTE_KEY]: '100' })
    const reset = vi.fn()
    const r = await mk(c, { storage, resets: [reset] }).eraseAll()
    expect(r.ok).toBe(false)
    expect(r.error).toBe('network')
    expect(r.done).toEqual(['invest_alerts'])
    expect(r.failed).toEqual([
      { step: 'watchlist', error: 'network', sent: true },
      { step: 'invest_operations', error: 'not_tried' },
      { step: 'portfolio_holdings', error: 'not_tried' },
      { step: PLANS_STEP, error: 'not_tried' },
    ])
    expect(c.auth.updateUser).not.toHaveBeenCalled()
    // El aporte del mes vive solo en el dispositivo: no se borra a medias.
    expect(storage.m.get(SNAPSHOT_KEY)).toBe('{}')
    expect(storage.m.get(APORTE_KEY)).toBe('100')
    // Pero las cachés en memoria sí se vacían: las alertas ya se borraron.
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('tiempo agotado después de enviar el DELETE: el paso queda "enviado" (pudo borrarse) y lo local no se toca', async () => {
    const c = fakeClient(q => (q.verb === 'delete' ? new Promise(r => setTimeout(() => r({ error: null }), 50)) : { count: 0, error: null }))
    const storage = memStorage({ [SNAPSHOT_KEY]: '{}', [APORTE_KEY]: '100' })
    const r = await mk(c, { storage, timeoutMs: 10 }).eraseAll()
    expect(r).toMatchObject({ ok: false, error: 'timeout', done: [] })
    expect(r.failed[0]).toEqual({ step: 'invest_alerts', error: 'timeout', sent: true })
    expect(r.failed.slice(1).map(f => f.error)).toEqual(['not_tried', 'not_tried', 'not_tried', 'not_tried'])
    expect(c.log.filter(q => q.verb === 'delete').map(q => q.table)).toEqual(['invest_alerts'])
    expect(storage.m.get(APORTE_KEY)).toBe('100')
  })

  it('tiempo agotado en el conteo después de un DELETE sin error: también queda "enviado"', async () => {
    let n = 0
    const c = fakeClient(q => (q.verb === 'select' && ++n > 1 ? new Promise(() => {}) : { error: null, count: 0 }))
    const r = await mk(c, { timeoutMs: 10 }).eraseAll()
    expect(r.failed[0]).toEqual({ step: 'invest_alerts', error: 'timeout', sent: true })
  })

  it('un rechazo sin respuesta de red en los planes también queda "enviado"', async () => {
    const c = fakeClient(undefined, { update: async () => { throw new Error('fetch failed') } })
    const r = await mk(c).eraseAll()
    expect(r.done).toEqual(ERASE_TABLES)
    expect(r.failed).toEqual([{ step: PLANS_STEP, error: 'network', sent: true }])
  })

  it('si un paso falla sin corte, lo del dispositivo queda para el reintento y las cachés se vacían', async () => {
    const c = fakeClient(q => (q.verb === 'delete' && q.table === 'watchlist' ? { error: { code: '42501', message: 'permission denied' } } : { count: 0, error: null }))
    const storage = memStorage({ [APORTE_KEY]: '100' })
    const reset = vi.fn()
    await mk(c, { storage, resets: [reset] }).eraseAll()
    expect(storage.m.get(APORTE_KEY)).toBe('100')
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('sin sesión no toca nada', async () => {
    const c = fakeClient(undefined, { uid: null })
    const storage = memStorage({ [SNAPSHOT_KEY]: '{}' })
    const r = await mk(c, { storage }).eraseAll()
    expect(r).toMatchObject({ ok: false, error: 'session_required', done: [], failed: [] })
    expect(c.log).toEqual([])
    expect(storage.m.has(SNAPSHOT_KEY)).toBe(true)
  })

  it('en el demo no se borra ni se escribe nada', async () => {
    const c = fakeClient()
    const storage = memStorage({ [SNAPSHOT_KEY]: '{}' })
    const r = await createInvestErase({ client: c, isDemo: () => true, storage }).eraseAll()
    expect(r.error).toBe('demo')
    expect(c.log).toEqual([])
    expect(c.auth.updateUser).not.toHaveBeenCalled()
    expect(storage.m.has(SNAPSHOT_KEY)).toBe(true)
  })

  it('tiempo agotado al pedir la sesión', async () => {
    const c = fakeClient()
    c.auth.getSession = () => new Promise(() => {})
    const r = await mk(c, { timeoutMs: 5 }).eraseAll()
    expect(r.error).toBe('timeout')
  })
})

// Formas REALES de supabase-js cuando falla el fetch: no lanzan, resuelven.
// postgrest-js: { data: null, error: { message: 'TypeError: Failed to fetch', details, hint: '', code: '' }, status: 0 }.
// auth-js: { data: { user: null }, error: AuthRetryableFetchError { name, message, status: 0 } }.
const PG_FETCH_FAIL = () => ({ data: null, error: { message: 'TypeError: Failed to fetch', details: 'TypeError: Failed to fetch\n    at fetch', hint: '', code: '' }, count: null, status: 0, statusText: '' })
const PG_ABORT = () => ({ data: null, error: { message: 'AbortError: signal is aborted without reason', details: '', hint: '', code: '' }, count: null, status: 0, statusText: '' })
const AUTH_FETCH_FAIL = async () => ({ data: { user: null }, error: Object.assign(new Error('Failed to fetch'), { name: 'AuthRetryableFetchError', status: 0 }) })

describe('Eliminar: cortes de red con las respuestas reales de supabase-js', () => {
  it('sin servidor desde el principio: no se envía ningún borrado, no se toca nada y dice "no se borró nada"', async () => {
    const c = fakeClient(PG_FETCH_FAIL, { update: AUTH_FETCH_FAIL })
    const storage = memStorage({ [SNAPSHOT_KEY]: '{}', [APORTE_KEY]: '100' })
    const reset = vi.fn()
    const r = await mk(c, { storage, resets: [reset] }).eraseAll()
    expect(r).toMatchObject({ ok: false, error: 'network', done: [] })
    expect(r.failed).toEqual([...ERASE_TABLES, PLANS_STEP].map(step => ({ step, error: 'not_tried' })))
    expect(c.log.filter(q => q.verb === 'delete')).toEqual([])
    expect(c.auth.updateUser).not.toHaveBeenCalled()
    expect(storage.m.get(APORTE_KEY)).toBe('100')
    expect(storage.m.get(SNAPSHOT_KEY)).toBe('{}')
    expect(reset).not.toHaveBeenCalled()
    expect(eraseOutcome(r)).toEqual({ kind: 'nothing', errorKey: 'is.del.err.network', gap: [] })
  })

  it('el DELETE resuelve con "Failed to fetch" a mitad: frena, ese paso queda sin confirmar, lo local queda y las cachés se vacían', async () => {
    const c = fakeClient(q => (q.verb === 'delete' && q.table === 'watchlist' ? PG_FETCH_FAIL() : { data: null, error: null, count: 0, status: 204 }))
    const storage = memStorage({ [SNAPSHOT_KEY]: '{}', [APORTE_KEY]: '100' })
    const reset = vi.fn()
    const r = await mk(c, { storage, resets: [reset] }).eraseAll()
    expect(r.error).toBe('network')
    expect(r.done).toEqual(['invest_alerts'])
    expect(r.failed).toEqual([
      { step: 'watchlist', error: 'network', sent: true },
      { step: 'invest_operations', error: 'not_tried' },
      { step: 'portfolio_holdings', error: 'not_tried' },
      { step: PLANS_STEP, error: 'not_tried' },
    ])
    expect(c.log.filter(q => q.verb === 'delete').map(q => q.table)).toEqual(['invest_alerts', 'watchlist'])
    expect(c.auth.updateUser).not.toHaveBeenCalled()
    expect(storage.m.get(APORTE_KEY)).toBe('100')
    expect(storage.m.get(SNAPSHOT_KEY)).toBe('{}')
    expect(reset).toHaveBeenCalledTimes(1)
    expect(eraseOutcome(r)).toMatchObject({ kind: 'partial', done: ['invest_alerts'], unsure: ['watchlist'] })
  })

  it('el primer DELETE se corta (la prueba sí respondió): "puede que se haya borrado una parte" y las cachés se vacían', async () => {
    const c = fakeClient(q => (q.verb === 'delete' ? PG_FETCH_FAIL() : { error: null, count: 0, status: 200 }))
    const storage = memStorage({ [APORTE_KEY]: '100' })
    const reset = vi.fn()
    const r = await mk(c, { storage, resets: [reset] }).eraseAll()
    expect(r.failed[0]).toEqual({ step: 'invest_alerts', error: 'network', sent: true })
    expect(r.failed.slice(1).every(f => f.error === 'not_tried')).toBe(true)
    expect(storage.m.get(APORTE_KEY)).toBe('100')
    expect(reset).toHaveBeenCalledTimes(1)
    expect(eraseOutcome(r)).toMatchObject({ kind: 'unsure', done: [], unsure: ['invest_alerts'] })
  })

  it('AbortError resuelto también es un corte', async () => {
    const c = fakeClient(q => (q.verb === 'delete' && q.table === 'invest_operations' ? PG_ABORT() : { error: null, count: 0, status: 200 }))
    const r = await mk(c).eraseAll()
    expect(r.error).toBe('network')
    expect(r.failed[0]).toEqual({ step: 'invest_operations', error: 'network', sent: true })
    expect(r.failed.slice(1).map(f => f.error)).toEqual(['not_tried', 'not_tried'])
  })

  it('el conteo de verificación resuelve con "Failed to fetch": sin confirmar y frena', async () => {
    let n = 0
    const c = fakeClient(q => (q.verb === 'select' && ++n === 2 ? PG_FETCH_FAIL() : { error: null, count: 0, status: 200 }))
    const r = await mk(c).eraseAll()
    expect(r.failed[0]).toEqual({ step: 'invest_alerts', error: 'network', sent: true })
    expect(r.failed).toHaveLength(5)
  })

  it('los planes: auth-js resuelve AuthRetryableFetchError (status 0): sin confirmar, lo local queda, las cachés se vacían', async () => {
    const c = fakeClient(undefined, { update: AUTH_FETCH_FAIL })
    const storage = memStorage({ [APORTE_KEY]: '100' })
    const reset = vi.fn()
    const r = await mk(c, { storage, resets: [reset] }).eraseAll()
    expect(r).toMatchObject({ ok: false, error: 'network', done: ERASE_TABLES })
    expect(r.failed).toEqual([{ step: PLANS_STEP, error: 'network', sent: true }])
    expect(storage.m.get(APORTE_KEY)).toBe('100')
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('getSession resuelve con un error de red: no se borra nada', async () => {
    const c = fakeClient()
    c.auth.getSession = AUTH_FETCH_FAIL
    const r = await mk(c).eraseAll()
    expect(r.error).toBe('network')
    expect(c.log).toEqual([])
  })

  it('dispositivo sin red: no se envía nada', async () => {
    const c = fakeClient()
    const r = await mk(c, { offline: () => true }).eraseAll()
    expect(r.error).toBe('network')
    expect(c.log).toEqual([])
    expect(eraseOutcome(r).kind).toBe('nothing')
  })

  it('isNetworkError distingue la falta de respuesta de un error del servidor', () => {
    expect(isNetworkError(PG_FETCH_FAIL().error, 0)).toBe(true)
    expect(isNetworkError(PG_ABORT().error, 0)).toBe(true)
    expect(isNetworkError({ name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 })).toBe(true)
    expect(isNetworkError({ code: '', message: '' }, undefined)).toBe(true)
    expect(isNetworkError({ code: '42501', message: 'permission denied for table watchlist' }, 403)).toBe(false)
    expect(isNetworkError({ code: '57014', message: 'canceling statement due to statement timeout, transaction aborted' }, 500)).toBe(false)
    expect(isNetworkError({ code: 'PGRST301', message: 'JWT expired' }, 401)).toBe(false)
    expect(isNetworkError({ code: '', message: 'Internal Server Error' }, 500)).toBe(false)
    expect(isNetworkError(null)).toBe(false)
  })

  it('todo completo: se borra lo del dispositivo y se vacían las cachés', async () => {
    const storage = memStorage({ [SNAPSHOT_KEY]: '{}', [APORTE_KEY]: '100' })
    const reset = vi.fn()
    const r = await mk(fakeClient(), { storage, resets: [reset] }).eraseAll()
    expect(r.ok).toBe(true)
    expect(storage.m.has(APORTE_KEY)).toBe(false)
    expect(reset).toHaveBeenCalledTimes(1)
  })
})

describe('confirmación escribiendo ELIMINAR', () => {
  it('sin importar mayúsculas ni espacios; en otro idioma vale también su palabra', () => {
    expect(eraseWordOk('eliminar')).toBe(true)
    expect(eraseWordOk('  Eliminar ')).toBe(true)
    expect(eraseWordOk('ELIMINA')).toBe(false)
    expect(eraseWordOk('')).toBe(false)
    expect(eraseWordOk('delete', 'DELETE')).toBe(true)
    expect(eraseWordOk('eliminar', 'DELETE')).toBe(true)
    expect(eraseWordOk('löschen', 'LÖSCHEN')).toBe(true)
    expect(eraseWordOk('delete')).toBe(false)
  })
})
