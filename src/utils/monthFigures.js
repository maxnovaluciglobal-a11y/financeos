// @ts-check
// src/utils/monthFigures.js — piezas chicas compartidas por las cifras del mes
// (auditoría 360, G2-N1). Cada pantalla sumaba por su cuenta: unas con
// Number(), otras con `+ r.amount` (un monto guardado como texto concatenaba),
// y ninguna redondeaba. Acá viven la suma, el redondeo a centavos y la meta de
// ahorro del usuario, para que Inicio, Reportes y el Asesor digan lo mismo.

/**
 * Redondea a centavos y nunca devuelve −0: con montos que se compensan
 * (0,30 − 0,10 − 0,20) la coma flotante deja −5,55e-17 y la pantalla mostraba
 * "Te falta −$0,00" en rojo (ENG-N5).
 * @param {number} n
 * @returns {number}
 */
export function roundCents(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100
  return v === 0 ? 0 : v
}

/**
 * Suma `amount` de los registros, con Number() y redondeada a centavos.
 * @param {Array<{ amount?: unknown }>} records
 * @returns {number}
 */
export function sumAmounts(records) {
  let s = 0
  for (const r of records || []) s += Number(r?.amount) || 0
  return roundCents(s)
}

export const DEFAULT_SAVING_GOAL = 0.25

/**
 * Meta de ahorro del usuario como fracción (settings.savingGoalPct en %).
 * Respeta un 0 % elegido a propósito; solo sin valor usa el 25 % por defecto
 * (antes `pct/100 || 0.25` convertía el 0 en 25 %, V-G2-F1 y G2-N10).
 * @param {{ savingGoalPct?: unknown } | null | undefined} settings
 * @returns {number}
 */
export function savingGoal(settings) {
  const raw = settings?.savingGoalPct
  if (raw == null || raw === '') return DEFAULT_SAVING_GOAL
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n / 100 : DEFAULT_SAVING_GOAL
}

/**
 * ¿La tasa de ahorro llega a la meta? Con tolerancia de redondeo (15 % contra
 * una meta de 15 % llega).
 * @param {number} savingRate
 * @param {number} goal
 */
export function meetsSavingGoal(savingRate, goal) {
  return (Number(savingRate) || 0) >= goal - 1e-9
}
