// src/core/pushAsk.js — cuándo mostrar la hoja de pre-permiso de avisos (R09,
// con ejemplos desde el 24-nov-2026).
// Fuera del JS inicial: lo cargan la hoja (components/PushAsk.jsx), el chequeo
// del Shell (import dinámico), Ajustes e Inicio. Las reglas son puras y
// testeables; las de almacenamiento reciben el storage para los tests.
// Reglas del pedido automático (el de Ajustes, Inversiones o Primeros pasos lo
// pide la persona y no espera): nunca al abrir la app; recién después del 3.er
// movimiento registrado; nunca si el navegador no soporta push, si ya están
// activados, si no hay licencia (enablePush la exige), en el demo ni en la app
// de tienda (esa versión no envía avisos). "Ahora no" en el pedido automático
// lo pospone PUSH_SNOOZE_DAYS días; después de PUSH_MAX_DISMISSALS no se
// vuelve a ofrecer solo. Activarlos alguna vez, o apagarlos en Ajustes, lo
// cierra para siempre (`done`): quien los apagó no quiere que se los ofrezcan.
export const PUSH_ASKED_KEY = 'fos_push_asked'
export const PUSH_ASK_MIN_MOVEMENTS = 3
export const PUSH_SNOOZE_DAYS = 14
export const PUSH_MAX_DISMISSALS = 3
const DAY_MS = 24 * 3600 * 1000

// Lo guardado: { at: ms del último "Ahora no", n: cuántos, done?: true }.
// Antes del 24-nov era "1" (se preguntó una vez): cuenta como un "Ahora no"
// de recién. loadPushAsk lo reescribe con la fecha de la primera lectura, así
// vence a los PUSH_SNOOZE_DAYS días como cualquier otro.
export function readPushAsk(raw, now = Date.now()) {
  if (raw == null || raw === '') return { at: 0, n: 0 }
  if (raw === '1') return { at: now, n: 1, legacy: true }
  try {
    const v = JSON.parse(raw)
    const at = Number(v?.at) || 0
    const n = Math.max(0, Math.floor(Number(v?.n) || 0))
    return v?.done ? { at, n, done: true } : { at, n }
  } catch { return { at: now, n: PUSH_MAX_DISMISSALS } }
}

const encode = ({ at = 0, n = 0, done = false } = {}) => JSON.stringify(done ? { at, n, done: true } : { at, n })

export function snoozedPushAsk(prev, now = Date.now()) {
  return encode({ ...prev, at: now, n: (prev?.n || 0) + 1 })
}

export function pushAskSnoozed(state, now = Date.now(), days = PUSH_SNOOZE_DAYS) {
  if (!state) return false
  if (state.done) return true
  if (!state.n) return false
  if (state.n >= PUSH_MAX_DISMISSALS) return true
  return now - (Number(state.at) || 0) < days * DAY_MS
}

// ¿Se puede ofrecer el permiso en esta instancia? (también decide si
// "Primeros pasos" muestra el paso de avisos)
export function pushOfferable({ supported, hasLicense, isDemo, native }) {
  return !!supported && !!hasLicense && !isDemo && !native
}

export function shouldAskPush({ supported, enabled, asked, hasLicense, isDemo, native = false, movementCount, now = Date.now() }) {
  if (enabled || !pushOfferable({ supported, hasLicense, isDemo, native })) return false
  // `asked`: el valor guardado tal cual (string), el estado ya leído o un booleano de antes.
  const state = typeof asked === 'string' || asked == null ? readPushAsk(asked, now)
    : typeof asked === 'object' ? asked
      : (asked ? { at: now, n: 1 } : { at: 0, n: 0 })
  if (pushAskSnoozed(state, now)) return false
  return (Number(movementCount) || 0) >= PUSH_ASK_MIN_MOVEMENTS
}

const store = (s) => s || (typeof localStorage !== 'undefined' ? localStorage : null)

/** Lee el estado guardado; migra el "1" de antes a { at: ahora, n: 1 }. */
export function loadPushAsk(storage, now = Date.now()) {
  let raw = null
  try { raw = store(storage)?.getItem(PUSH_ASKED_KEY) ?? null } catch { return { at: now, n: PUSH_MAX_DISMISSALS } }
  const st = readPushAsk(raw, now)
  if (st.legacy) {
    delete st.legacy
    try { store(storage)?.setItem(PUSH_ASKED_KEY, encode(st)) } catch { /* sin almacenamiento: se vuelve a migrar la próxima vez */ }
  }
  return st
}

/**
 * Lo que deja guardado un resultado de la hoja. Activados → `done` (no se
 * vuelve a ofrecer solo). Solo cuenta como "Ahora no" el del pedido automático
 * cerrado por la persona: los pedidos de Ajustes o Inversiones y los errores
 * del servidor (save_failed, no_license) o del navegador no posponen nada.
 * @param {{ ok?: boolean, error?: string }} r @param {{ auto?: boolean }} opts
 */
export function recordPushResult(r, { auto = false } = {}, storage, now = Date.now()) {
  if (!r?.ok && !(auto && r?.error === 'dismissed')) return
  const prev = loadPushAsk(storage, now)
  const next = r?.ok ? encode({ ...prev, done: true }) : snoozedPushAsk(prev, now)
  try { store(storage)?.setItem(PUSH_ASKED_KEY, next) } catch { /* sin almacenamiento: se vuelve a ofrecer más adelante */ }
}

/** Apagados a mano (Ajustes): no se vuelven a ofrecer solos. */
export function markPushAskDone(storage, now = Date.now()) {
  recordPushResult({ ok: true }, {}, storage, now)
}
