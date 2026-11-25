import { describe, it, expect } from 'vitest'
import { shouldAskPush, readPushAsk, snoozedPushAsk, pushAskSnoozed, pushOfferable, loadPushAsk, recordPushResult, markPushAskDone, PUSH_ASKED_KEY, PUSH_SNOOZE_DAYS, PUSH_MAX_DISMISSALS } from './pushAsk.js'

const NOW = Date.UTC(2026, 10, 24, 12)
const DAY = 24 * 3600 * 1000
const base = { supported: true, enabled: false, asked: null, hasLicense: true, isDemo: false, movementCount: 3, now: NOW }

describe('shouldAskPush (R09)', () => {
  it('aparece después del 3.er movimiento', () => {
    expect(shouldAskPush({ ...base, movementCount: 2 })).toBe(false)
    expect(shouldAskPush(base)).toBe(true)
    expect(shouldAskPush({ ...base, movementCount: 40 })).toBe(true)
  })
  it('nunca si el navegador no soporta push o ya están activados', () => {
    expect(shouldAskPush({ ...base, supported: false })).toBe(false)
    expect(shouldAskPush({ ...base, enabled: true })).toBe(false)
  })
  it('nunca sin licencia, en el demo ni en la app de tienda', () => {
    expect(shouldAskPush({ ...base, hasLicense: false })).toBe(false)
    expect(shouldAskPush({ ...base, isDemo: true })).toBe(false)
    expect(shouldAskPush({ ...base, native: true })).toBe(false)
  })
})

describe('"Ahora no" pospone el pedido', () => {
  it(`no vuelve a preguntar durante ${PUSH_SNOOZE_DAYS} días`, () => {
    const asked = snoozedPushAsk(readPushAsk(null, NOW), NOW)
    expect(shouldAskPush({ ...base, asked, now: NOW + DAY })).toBe(false)
    expect(shouldAskPush({ ...base, asked, now: NOW + (PUSH_SNOOZE_DAYS - 1) * DAY })).toBe(false)
    expect(shouldAskPush({ ...base, asked, now: NOW + PUSH_SNOOZE_DAYS * DAY })).toBe(true)
  })
  it(`después de ${PUSH_MAX_DISMISSALS} "Ahora no" no se ofrece solo nunca más`, () => {
    let st = readPushAsk(null, NOW)
    let t = NOW
    for (let i = 0; i < PUSH_MAX_DISMISSALS; i++) { const raw = snoozedPushAsk(st, t); st = readPushAsk(raw, t); t += 100 * DAY }
    expect(st.n).toBe(PUSH_MAX_DISMISSALS)
    expect(pushAskSnoozed(st, t + 1000 * DAY)).toBe(true)
  })
  it('el valor viejo "1" cuenta como un "Ahora no" de recién (no pregunta justo al actualizar)', () => {
    expect(readPushAsk('1', NOW)).toMatchObject({ at: NOW, n: 1 })
    expect(shouldAskPush({ ...base, asked: '1' })).toBe(false)
  })
  it('un valor ilegible no vuelve a preguntar', () => {
    expect(shouldAskPush({ ...base, asked: '{roto' })).toBe(false)
  })
  it('booleanos de antes: true = ya preguntado', () => {
    expect(shouldAskPush({ ...base, asked: true })).toBe(false)
    expect(shouldAskPush({ ...base, asked: false })).toBe(true)
  })
  it('pushOfferable: soporte + licencia, fuera del demo y de la app de tienda', () => {
    expect(pushOfferable({ supported: true, hasLicense: true, isDemo: false, native: false })).toBe(true)
    expect(pushOfferable({ supported: true, hasLicense: true, isDemo: false, native: true })).toBe(false)
    expect(pushOfferable({ supported: true, hasLicense: false, isDemo: false, native: false })).toBe(false)
  })
})

const memStorage = (init = {}) => {
  const m = new Map(Object.entries(init))
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), map: m }
}

describe('lo guardado tras la hoja (revisión del 24-nov)', () => {
  it('activados: no se vuelve a ofrecer solo aunque después se apaguen', () => {
    const st = memStorage()
    recordPushResult({ ok: true }, { auto: false }, st, NOW)
    expect(loadPushAsk(st, NOW).done).toBe(true)
    expect(shouldAskPush({ ...base, asked: loadPushAsk(st, NOW + 999 * DAY), now: NOW + 999 * DAY })).toBe(false)
  })
  it('apagados en Ajustes: tampoco se ofrecen solos', () => {
    const st = memStorage()
    markPushAskDone(st, NOW)
    expect(shouldAskPush({ ...base, asked: st.getItem(PUSH_ASKED_KEY), now: NOW + 999 * DAY })).toBe(false)
  })
  it('solo cuenta el "Ahora no" del pedido automático', () => {
    const st = memStorage()
    recordPushResult({ ok: false, error: 'dismissed' }, { auto: false }, st, NOW)
    expect(st.getItem(PUSH_ASKED_KEY)).toBe(null)
    for (const error of ['save_failed', 'no_license', 'permission_denied', 'failed']) recordPushResult({ ok: false, error }, { auto: true }, st, NOW)
    expect(st.getItem(PUSH_ASKED_KEY)).toBe(null)
    recordPushResult({ ok: false, error: 'dismissed' }, { auto: true }, st, NOW)
    expect(loadPushAsk(st, NOW)).toEqual({ at: NOW, n: 1 })
  })
  it('el "1" de antes se migra a { at, n: 1 } en la primera lectura y vence a los 14 días', () => {
    const st = memStorage({ [PUSH_ASKED_KEY]: '1' })
    expect(loadPushAsk(st, NOW)).toEqual({ at: NOW, n: 1 })
    expect(JSON.parse(st.getItem(PUSH_ASKED_KEY))).toEqual({ at: NOW, n: 1 })
    const later = NOW + PUSH_SNOOZE_DAYS * DAY
    expect(shouldAskPush({ ...base, asked: loadPushAsk(st, later), now: later })).toBe(true)
  })
})
