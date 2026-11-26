// 14 días de Pro sin tarjeta (modelo A, 26-nov-2026): lo que decide la app.
// Lo que abre Pro es la licencia que emite el servidor (supabase/tests/reverse_trial.sql);
// acá se prueban los avisos, el resumen de uso y cómo el dispositivo toma o suelta
// esa licencia.
import { describe, it, expect, beforeEach, vi } from 'vitest'

function memStore() {
  const m = new Map()
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear() }
}
globalThis.localStorage = memStore()

const {
  dueTrialNotice, trialDay, trialDaysLeft, readTrialState, markTrialNoticeSeen, markTrialFeatureUsed,
  refreshProTrial, startProTrial, declineProTrial, normalizeStatus, TRIAL_STATE_KEY,
} = await import('./proTrial.js')
const { getLicenseInfo, getLicenseKey, getLicensePlan, hasProEntitlement, isStarterAcknowledged } = await import('../utils/licenseValidator.js')

const DAY = 86400000
const T0 = Date.UTC(2026, 10, 26, 12)
const KEY = 'a'.repeat(64)
const write = (o) => localStorage.setItem('fnos_license_v2', JSON.stringify(o))

beforeEach(() => { localStorage.clear() })

describe('dueTrialNotice', () => {
  const active = (startedAt) => ({ status: { active: true, startedAt, endsAt: startedAt + 14 * DAY }, seen: {}, used: [] })
  it('oferta solo en la web, a quien puede empezarla y no respondió', () => {
    const st = { status: { eligible: true }, seen: {}, used: [] }
    expect(dueTrialNotice(st, { web: true })).toBe('offer')
    expect(dueTrialNotice(st, { web: false })).toBe(null)
    expect(dueTrialNotice({ ...st, seen: { offer: true } }, { web: true })).toBe(null)
    expect(dueTrialNotice({ status: { eligible: false }, seen: {}, used: [] })).toBe(null)
  })
  it('recordatorios el día 10 y el 13 (uno por vez), no antes', () => {
    expect(dueTrialNotice(active(T0), { now: T0 + 8 * DAY })).toBe(null)
    expect(dueTrialNotice(active(T0), { now: T0 + 9 * DAY })).toBe('day10')
    expect(dueTrialNotice(active(T0), { now: T0 + 12 * DAY })).toBe('day13')
    expect(dueTrialNotice({ ...active(T0), seen: { day10: true } }, { now: T0 + 11 * DAY })).toBe(null)
    expect(dueTrialNotice(active(T0), { now: T0 + 12 * DAY, web: false })).toBe(null)
  })
  it('al terminar sin compra: aviso de vuelta a Starter, también en la app de tienda', () => {
    const ended = { status: { ended: true, startedAt: T0, endsAt: T0 + 14 * DAY }, seen: {}, used: [] }
    expect(dueTrialNotice(ended, { web: false })).toBe('ended')
    expect(dueTrialNotice({ ...ended, seen: { ended: true } })).toBe(null)
    expect(dueTrialNotice({ ...ended, status: { ...ended.status, converted: true } })).toBe(null)
  })
  it('días y días que quedan', () => {
    expect(trialDay(T0, T0)).toBe(1)
    expect(trialDay(T0, T0 + 9 * DAY + 1)).toBe(10)
    expect(trialDaysLeft(T0 + 14 * DAY, T0 + 12 * DAY)).toBe(2)
    expect(trialDaysLeft(T0, T0 + DAY)).toBe(0)
  })
})

describe('estado guardado', () => {
  it('ver el aviso del día 13 da por visto el del 10', () => {
    markTrialNoticeSeen('day13')
    expect(readTrialState().seen).toEqual({ day10: true, day13: true })
  })
  it('las herramientas usadas se anotan solo durante la prueba y sin repetirse', () => {
    markTrialFeatureUsed('advisor')
    expect(readTrialState().used).toEqual([])
    localStorage.setItem(TRIAL_STATE_KEY, JSON.stringify({ status: { active: true }, seen: {}, used: [] }))
    markTrialFeatureUsed('advisor'); markTrialFeatureUsed('advisor'); markTrialFeatureUsed('steuer'); markTrialFeatureUsed('movements')
    expect(readTrialState().used).toEqual(['advisor', 'country'])
  })
  it('"Seguir con Starter" cierra la oferta', () => {
    declineProTrial()
    expect(readTrialState().seen.offer).toBe(true)
  })
  it('normalizeStatus no guarda la clave', () => {
    expect(normalizeStatus({ ok: true, active: true, license_key: KEY, started_at: T0, ends_at: T0 + 14 * DAY })).toEqual(
      { eligible: false, active: true, ended: false, converted: false, startedAt: T0, endsAt: T0 + 14 * DAY })
    expect(normalizeStatus({ ok: false })).toBe(null)
  })
})

describe('startProTrial', () => {
  it('con el OK del servidor valida la licencia de prueba, marca Starter de respaldo y cierra la oferta', async () => {
    const validate = vi.fn(async (k) => { write({ key: k, plan: 'pro', exp: T0 + 14 * DAY, ts: 1, trial: true, noCard: true }); return true })
    const r = await startProTrial({ rpc: async () => ({ ok: true, license_key: KEY, started_at: T0, ends_at: T0 + 14 * DAY }), validate })
    expect(r).toEqual({ ok: true, endsAt: T0 + 14 * DAY })
    expect(validate).toHaveBeenCalledWith(KEY)
    expect(isStarterAcknowledged()).toBe(true)
    expect(readTrialState()).toMatchObject({ status: { active: true, eligible: false }, seen: { offer: true } })
  })
  it('sin OK (ya la usó, sin red) no toca nada', async () => {
    expect(await startProTrial({ rpc: async () => ({ ok: false, error: 'already_used' }), validate: vi.fn() })).toEqual({ ok: false, error: 'already_used' })
    expect(await startProTrial({ rpc: async () => null, validate: vi.fn() })).toEqual({ ok: false, error: 'network' })
    expect(getLicenseKey()).toBe('')
  })
})

describe('refreshProTrial', () => {
  it('prueba empezada en otro dispositivo: este toma la misma credencial', async () => {
    const validate = vi.fn(async (k) => { write({ key: k, plan: 'pro', exp: Date.now() + DAY, ts: 1, noCard: true }); return true })
    const r = await refreshProTrial({ rpc: async () => ({ ok: true, active: true, license_key: KEY, started_at: T0, ends_at: T0 + 14 * DAY }), validate })
    expect(r.changed).toBe(true)
    expect(getLicenseKey()).toBe(KEY)
    expect(hasProEntitlement()).toBe(true)
  })
  it('terminó: suelta la licencia de prueba y queda en Starter', async () => {
    write({ key: KEY, plan: 'pro', exp: Date.now() + DAY, ts: 1, noCard: true })
    const r = await refreshProTrial({ rpc: async () => ({ ok: true, ended: true, started_at: T0, ends_at: T0 + 14 * DAY }), validate: vi.fn(), entitlement: vi.fn() })
    expect(r.changed).toBe(true)
    expect(getLicenseInfo()).toBe(null)
    expect(getLicensePlan()).toBe('starter')
    expect(isStarterAcknowledged()).toBe(true)
  })
  it('compró Pro: toma la licencia pagada de la cuenta', async () => {
    write({ key: KEY, plan: 'pro', exp: Date.now() + DAY, ts: 1, noCard: true })
    const PAID = 'b'.repeat(64)
    const validate = vi.fn(async (k) => { write({ key: k, plan: 'pro', exp: null, ts: 2 }); return true })
    await refreshProTrial({ userId: 'u1', rpc: async () => ({ ok: true, converted: true, started_at: T0, ends_at: T0 + 14 * DAY }), validate, entitlement: async () => ({ plan: 'pro', license_key: PAID }) })
    expect(getLicenseKey()).toBe(PAID)
    expect(getLicenseInfo().noCard).toBe(false)
  })
  it('B1: compró en otro dispositivo y este ya había soltado la prueba (caché vencida): toma la pagada', async () => {
    const PAID = 'c'.repeat(64)
    const validate = vi.fn(async (k) => { write({ key: k, plan: 'pro', exp: null, ts: 3 }); return true })
    const r = await refreshProTrial({ userId: 'u1', rpc: async () => ({ ok: true, converted: true, started_at: T0, ends_at: T0 + 14 * DAY }), validate, entitlement: async () => ({ plan: 'pro', license_key: PAID }) })
    expect(r.changed).toBe(true)
    expect(getLicenseKey()).toBe(PAID)
    expect(hasProEntitlement()).toBe(true)
  })
  it('B1: si falla la consulta del plan de la cuenta, no lo pasa a Starter (reintenta en la próxima sesión)', async () => {
    write({ key: KEY, plan: 'pro', exp: Date.now() + DAY, ts: 1, noCard: true })
    const r = await refreshProTrial({ userId: 'u1', rpc: async () => ({ ok: true, converted: true, started_at: T0, ends_at: T0 + 14 * DAY }), validate: vi.fn(), entitlement: async () => null })
    expect(r.changed).toBe(false)
    expect(getLicenseKey()).toBe(KEY)
    expect(isStarterAcknowledged()).toBe(false)
  })
  it('una licencia pagada no se toca aunque la cuenta no tenga prueba', async () => {
    write({ key: KEY, plan: 'pro', exp: null, ts: 1 })
    const r = await refreshProTrial({ rpc: async () => ({ ok: true, eligible: false, active: false, ended: false }), validate: vi.fn() })
    expect(r.changed).toBe(false)
    expect(getLicenseKey()).toBe(KEY)
  })
  it('sin respuesta del servidor no cambia nada', async () => {
    write({ key: KEY, plan: 'pro', exp: Date.now() + DAY, ts: 1, noCard: true })
    expect(await refreshProTrial({ rpc: async () => null })).toEqual({ status: null, changed: false })
    expect(getLicenseKey()).toBe(KEY)
  })
})

describe('hasProEntitlement', () => {
  it('Pro, Enterprise y la licencia de pago único abren Pro; Starter o vencida no', () => {
    for (const plan of ['pro', 'enterprise', 'personal']) { write({ key: KEY, plan, exp: null, ts: 1 }); expect(hasProEntitlement(), plan).toBe(true) }
    write({ key: KEY, plan: 'starter', exp: null, ts: 1 }); expect(hasProEntitlement()).toBe(false)
    write({ key: KEY, plan: 'pro', exp: Date.now() - 1, ts: 1 }); expect(hasProEntitlement()).toBe(false)
    localStorage.clear(); expect(hasProEntitlement()).toBe(false)
  })
})
