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

// Lo que hace "Ir a Planificar" / "Repartir" con el monto del mes:
//  · con un monto en US$ lo guarda y avisa a Planificar (saveAporte);
//  · en el ejemplo ("Ver un ejemplo" o el demo) no guarda nada ni emite el
//    evento: los datos no son de la persona;
//  · sin monto en US$ (no hay tipo de cambio para la moneda de la persona) no
//    convierte 1:1 ni usa un monto guardado de otro mes: devuelve la moneda
//    para avisar "escribe el monto en USD" (Invest: inventario §3, regla 12).
export function commitAporte({ usd, ccy = null, sample = false }, write) {
  const v = Math.round(Number(usd) * 100) / 100
  if (!(v > 0)) return { ok: false, usd: null, saved: false, noRate: ccy && ccy !== 'USD' ? ccy : null }
  if (sample) return { ok: true, usd: v, saved: false, noRate: null }
  return { ok: saveAporte(v, write), usd: v, saved: true, noRate: null }
}
