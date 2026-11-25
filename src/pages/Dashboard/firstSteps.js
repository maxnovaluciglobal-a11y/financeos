// src/pages/Dashboard/firstSteps.js — "Primeros pasos · n de 5" del Inicio
// (R06; con 5 pasos desde el 24-nov-2026).
// El progreso sale de los datos reales, nunca de un flag guardado: si alguien
// borra su único presupuesto, el paso vuelve a quedar pendiente. Los pasos son
// los que arman "Te queda": lo que entra, lo que sale, lo que ya está
// comprometido y el límite por categoría, y al final los avisos.
//   1. income  — un ingreso en el mes que se mira o un fijo de ingreso (sueldo)
//   2. expense — al menos un gasto (registrado a mano o importado)
//   3. fixed   — al menos un pago fijo (regla de gasto; suscripciones y cuotas
//                de deudas cuentan, ya son reglas)
//   4. budget  — al menos un presupuesto
//   5. alerts  — avisos activados en este dispositivo: push web en el
//                navegador, avisos locales en la app de tienda (con el plugin;
//                pushOffered/pushOn valen para los dos). Donde no se pueden
//                ofrecer (navegador sin push, sin licencia, permiso bloqueado,
//                app sin el plugin) el quinto paso es el respaldo: un archivo
//                descargado (settings.lastBackupAt) o el sync cifrado activo
//
// Solo para cuentas nuevas (revisión del 24-nov): un paso puede volver a
// quedar pendiente (el ingreso depende del mes; los avisos, del dispositivo),
// así que la tarjeta no puede depender solo de "¿está completa?". Se muestra
// durante FIRST_STEPS_DAYS desde el registro más viejo de la cuenta y nunca
// más después de completarse una vez. Una cuenta que ya existía (movimientos,
// fijos o presupuestos de hace más de 30 días, un respaldo viejo) no la ve.
// El estado { since, done } se guarda por dispositivo; como `since` sale de
// los datos, otro dispositivo de la misma cuenta llega a la misma respuesta.
import { isSetAside } from '../../utils/setAside.js'

export const FIRST_STEP_IDS = ['income', 'expense', 'fixed', 'budget', 'alerts']
// Las dos claves son de este dispositivo (localStorage), no de la cuenta.
export const FIRST_STEPS_HIDDEN_KEY = 'fos_first_steps_hidden'
export const FIRST_STEPS_STATE_KEY = 'fos_first_steps'
export const FIRST_STEPS_DAYS = 30
const DAY_MS = 24 * 3600 * 1000

const has = (a) => Array.isArray(a) && a.length > 0

export function firstStepsProgress({
  incomes = [], expenses = [], budgets = [], recurring = [], activeMonth = '',
  lastBackupAt = null, syncOn = false, pushOffered = false, pushOn = false,
} = {}) {
  const rules = (Array.isArray(recurring) ? recurring : []).filter(r => r && !r.paused)
  const inc = Array.isArray(incomes) ? incomes : []
  const exp = (Array.isArray(expenses) ? expenses : []).filter(r => !isSetAside(r))
  const lastId = pushOffered ? 'alerts' : 'backup'
  const doneById = {
    income: inc.some(r => !activeMonth || String(r?.date || '').startsWith(activeMonth)) || rules.some(r => r.kind === 'income'),
    expense: has(exp),
    fixed: rules.some(r => r.kind !== 'income'),
    budget: has(budgets),
    alerts: !!pushOn,
    backup: !!lastBackupAt || !!syncOn,
  }
  const ids = [...FIRST_STEP_IDS.slice(0, 4), lastId]
  const steps = ids.map(id => ({ id, done: !!doneById[id] }))
  const done = steps.filter(s => s.done).length
  return {
    steps,
    done,
    total: steps.length,
    complete: done === steps.length,
    // El primer paso pendiente es el que lleva el botón principal.
    nextId: steps.find(s => !s.done)?.id || null,
  }
}

const stamp = (v) => { const ms = typeof v === 'number' ? v : Date.parse(String(v || '')); return Number.isFinite(ms) && ms > 0 ? ms : null }

/**
 * Desde cuándo existe la cuenta: el registro más viejo que se conoce. Un
 * movimiento sin createdAt es de una versión vieja (o de un respaldo): cuenta
 * cuándo se importó (importedAt) y, si tampoco, su fecha. Importar una cartola
 * del año pasado en una cuenta nueva no la vuelve vieja. Fijos y presupuestos solo cuentan con createdAt (las plantillas
 * del onboarding pueden no traerlo). Sin nada, `now`.
 */
export function accountSince({ incomes = [], expenses = [], budgets = [], recurring = [], lastBackupAt = null } = {}, now = Date.now()) {
  let min = now
  const take = (v) => { const ms = stamp(v); if (ms != null && ms < min) min = ms }
  for (const list of [incomes, expenses]) for (const r of Array.isArray(list) ? list : []) take(r?.createdAt || r?.importedAt || r?.date)
  for (const list of [budgets, recurring]) for (const r of Array.isArray(list) ? list : []) take(r?.createdAt)
  take(lastBackupAt)
  return min
}

/** Lo guardado: { since: ms, done: completó la tarjeta alguna vez }. */
export function readFirstStepsState(raw) {
  try {
    const v = raw ? JSON.parse(raw) : null
    return { since: stamp(v?.since) || 0, done: !!v?.done }
  } catch { return { since: 0, done: false } }
}

/** El estado nuevo: `since` solo baja (llegan datos viejos por sync o respaldo); `done` no vuelve atrás. */
export function nextFirstStepsState(prev, data, progress, now = Date.now()) {
  const fromData = accountSince(data, now)
  const since = prev?.since ? Math.min(prev.since, fromData) : fromData
  return { since, done: !!prev?.done || !!progress?.complete }
}

// ¿Se muestra la tarjeta? Nunca en el demo, completa (ni completada antes),
// ocultada a mano ni pasados FIRST_STEPS_DAYS desde que existe la cuenta.
export function firstStepsVisible(progress, { isDemo = false, hidden = false, state = null, now = Date.now() } = {}) {
  if (isDemo || hidden || !progress || progress.complete) return false
  if (!state) return true
  if (state.done) return false
  return now - (state.since || now) < FIRST_STEPS_DAYS * DAY_MS
}
