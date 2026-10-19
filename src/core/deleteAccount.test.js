// Borrado de cuenta (C-22): llamada a la Edge Function y limpieza local de la
// cuenta borrada, sin tocar lo de otra cuenta del mismo navegador.
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mem = new Map()
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)) },
  removeItem: (k) => { mem.delete(k) },
  key: (i) => [...mem.keys()][i] ?? null,
  get length() { return mem.size },
  clear: () => mem.clear(),
}

const { requestAccountDeletion, wipeAccountFromDevice, CONFIRM_WORD } = await import('./deleteAccount.js')
const db = await import('./db/index.js')
const own = await import('./deviceOwner.js')

const res = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

async function dbNames() { return (await indexedDB.databases()).map((d) => d.name).sort() }
async function createDb(name) {
  await new Promise((r) => { const q = indexedDB.open(name, 1); q.onsuccess = () => { q.result.close(); r() } })
}

beforeEach(async () => {
  db.closeDB()
  mem.clear()
  for (const n of await dbNames()) await new Promise((r) => { const q = indexedDB.deleteDatabase(n); q.onsuccess = q.onerror = () => r() })
})

describe('requestAccountDeletion', () => {
  it('manda el token de la sesión y la palabra de confirmación', async () => {
    const f = vi.fn(async () => res({ ok: true }))
    expect(await requestAccountDeletion('tok', f)).toEqual({ ok: true })
    const [url, init] = f.mock.calls[0]
    expect(url).toMatch(/\/functions\/v1\/delete-account$/)
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body)).toEqual({ confirm: CONFIRM_WORD })
  })
  it('sin sesión no llama al servidor', async () => {
    const f = vi.fn()
    expect(await requestAccountDeletion('', f)).toEqual({ ok: false, error: 'session_required' })
    expect(f).not.toHaveBeenCalled()
  })
  it('propaga el error del servidor, de red o de HTTP', async () => {
    expect(await requestAccountDeletion('t', async () => res({ ok: false, error: 'data_delete_failed' }, 503))).toEqual({ ok: false, error: 'data_delete_failed' })
    expect(await requestAccountDeletion('t', async () => { throw new Error('x') })).toEqual({ ok: false, error: 'network' })
    expect(await requestAccountDeletion('t', async () => ({ ok: false, status: 502, json: async () => { throw new Error('html') } }))).toEqual({ ok: false, error: 'http_502' })
  })
})

describe('wipeAccountFromDevice', () => {
  it('borra la base y las claves de la cuenta activa y deja intacta la de otra cuenta', async () => {
    localStorage.setItem(own.LEGACY_KEY, 'uid-b')
    localStorage.setItem(own.OWNER_KEY, JSON.stringify({ uid: 'uid-a' }))
    localStorage.setItem('fnos_license_v2', '{"key":"FNOS-AAAA-AAAA-AAAA"}')
    localStorage.setItem('fos_score_history', '[1]')
    localStorage.setItem('fnos_acct__uid-b', '{"fnos_license_v2":"x"}')
    localStorage.setItem('fnos_error_log', '[]')
    await createDb('financeos')
    await createDb('financeos__uid-a')
    await wipeAccountFromDevice('uid-a')
    expect(await dbNames()).toEqual(['financeos'])
    expect(localStorage.getItem('fnos_license_v2')).toBeNull()
    expect(localStorage.getItem('fos_score_history')).toBeNull()
    expect(localStorage.getItem(own.OWNER_KEY)).toBeNull()
    expect(localStorage.getItem('fnos_acct__uid-b')).not.toBeNull()
    expect(localStorage.getItem(own.LEGACY_KEY)).toBe('uid-b')
    expect(localStorage.getItem('fnos_error_log')).toBe('[]')
  })
  it('si la cuenta era la dueña de la base histórica, la borra y libera la marca', async () => {
    localStorage.setItem(own.LEGACY_KEY, 'uid-a')
    localStorage.setItem(own.OWNER_KEY, JSON.stringify({ uid: 'uid-a' }))
    await createDb('financeos')
    await createDb('financeos__uid-b')
    await wipeAccountFromDevice('uid-a')
    expect(await dbNames()).toEqual(['financeos__uid-b'])
    expect(localStorage.getItem(own.LEGACY_KEY)).toBeNull()
  })
  it('sin uid no hace nada', async () => {
    localStorage.setItem('fnos_license_v2', 'x')
    await wipeAccountFromDevice('')
    expect(localStorage.getItem('fnos_license_v2')).toBe('x')
  })
})
