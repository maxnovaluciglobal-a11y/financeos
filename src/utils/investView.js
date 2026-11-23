// src/utils/investView.js — Vista esencial / Vista completa de Inversiones
// (ajustes del 20-nov-2026, PLAN de invest-en-moyiq; coherencia 360 §5).
//
// Esencial (por defecto) deja lo que cualquier persona entiende sin saber de
// bolsa: valor, lo que pusiste, lo que sumó el mercado y una línea simple de
// precio. Completa suma lo de quien ya opera: velas, RSI, MACD, bandas de
// Bollinger, medias, stop y riesgo al stop, la cinta de mercado. Nada se borra:
// el interruptor solo elige qué se dibuja.
//
// La elige la persona (nunca el perfil de inversionista: "No lo usamos para
// recomendarte nada"). Se guarda en `fos_invest_view`, clave de la cuenta en
// este dispositivo (core/deviceOwner.js), así cada cuenta recuerda la suya.
export const VIEW_KEY = 'fos_invest_view'
export const VIEWS = ['esencial', 'completa']
export const DEFAULT_VIEW = 'esencial'

export const isView = (v) => VIEWS.includes(v)
export const isFull = (v) => v === 'completa'

export function readView(storage = null) {
  let v = null
  try { v = storage?.getItem(VIEW_KEY) ?? null } catch { v = null }
  return isView(v) ? v : DEFAULT_VIEW
}

export function writeView(v, storage = null) {
  if (!isView(v)) return false
  try { storage?.setItem(VIEW_KEY, v) } catch { /* modo privado: vale para esta visita */ }
  return true
}

// Qué se muestra en cada vista. Una sola tabla para que Resumen, Portafolio,
// Mercado y la ficha decidan igual.
const FULL_ONLY = new Set([
  'candles', // velas (la esencial dibuja una línea de precio)
  'indicators', // RSI, MACD, medias, Bollinger, volumen y la pestaña Indicadores
  'stop', // stop, riesgo al stop y capital de referencia
  'strip', // cinta de mercado
  'review', // "Para revisar hoy" (medias y RSI)
  'movingAverages', // media de 200 días del mercado
  'unrealized', // "Resultado (si vendieras hoy)": la esencial ya lo cuenta en "El mercado sumó"
  'riskR', // Planificar: stop, R, escenarios en múltiplos de R y límite por posición
  'ladder', // Planificar: escaleras de compra sobre medias móviles
])
export function shows(view, part) {
  return isFull(view) || !FULL_ONLY.has(part)
}

// Interruptor compartido entre la sección y la ficha (las dos se montan a la
// vez en el historial): un cambio en una se ve en la otra sin recargar.
// Se lee del almacenamiento cada vez (sin copia en memoria): si cambia la
// cuenta del dispositivo, vale la vista de la cuenta nueva. Sin almacenamiento
// (modo privado), la elección vive en `fallback` mientras dure la visita.
const subs = new Set()
let fallback = null
export function createViewStore(storage) {
  return {
    get() {
      let saved = null
      try { saved = storage?.getItem(VIEW_KEY) ?? null } catch { saved = null }
      return isView(saved) ? saved : fallback || DEFAULT_VIEW
    },
    set(v) {
      if (!writeView(v, storage)) return
      fallback = v
      for (const fn of subs) fn(v)
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn) },
  }
}

// Solo para pruebas.
export function __resetInvestView() { fallback = null; subs.clear() }
