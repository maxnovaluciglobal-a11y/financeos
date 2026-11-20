// src/pages/Investments/hoy/aporteStore.js — el aporte del mes que Hoy pasa a
// Planificar › Aportes (Invest: setAporte → capitalPlan.monthly).
// Se guarda SOLO el monto en US$ (nunca tickers ni posiciones), en una clave
// fos_* que es de la cuenta (core/deviceOwner.js), y se avisa con un evento
// para que Planificar lo tome si ya está montada.
export const APORTE_KEY = 'fos_invest_aporte_monthly'
export const APORTE_EVENT = 'fos:invest-aporte'

export function readAporte(read) {
  let raw = null
  try { raw = read(APORTE_KEY) } catch { raw = null }
  const v = Number(raw)
  return Number.isFinite(v) && v > 0 && v <= 1e13 ? Math.round(v * 100) / 100 : null
}

export function saveAporte(usd, write) {
  const v = Math.round(Number(usd) * 100) / 100
  if (!(v > 0)) return false
  try { write(APORTE_KEY, String(v)) } catch { /* modo privado: el monto viaja solo en el evento */ }
  try { window.dispatchEvent(new CustomEvent(APORTE_EVENT, { detail: { usd: v } })) } catch { /* sin ventana (pruebas) */ }
  return true
}
