// src/extras/loyalty.js — Puntos y millas (24-nov-2026): saldos de programas
// de fidelidad cargados a mano. Lógica pura (tests en loyalty.test.js).
//
// Dónde viven: settings.loyalty = [{ id, program, points, valuePerPoint? }]
// y settings.loyaltyInNetWorth (false por defecto). En settings y no en una
// store nueva: no hace falta migración de IndexedDB, viajan en el respaldo y
// en el sync como el resto de los ajustes, y una cuenta vieja simplemente no
// tiene la lista. No son dinero: Patrimonio los muestra aparte y NO los suma
// al total salvo que la persona lo active (y aun así solo en su tarjeta, sin
// tocar calcNetWorth, que comparten Reportes y el PDF).

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

/** Lista limpia: descarta lo roto (sin nombre o puntos inválidos). */
export function loyaltyList(settings) {
  const raw = Array.isArray(settings?.loyalty) ? settings.loyalty : []
  return raw
    .filter(p => p && typeof p === 'object' && String(p.program || '').trim())
    .map(p => ({
      id: String(p.id || ''),
      program: String(p.program).trim().slice(0, 60),
      points: Math.max(0, Math.round(num(p.points))),
      valuePerPoint: num(p.valuePerPoint) > 0 ? num(p.valuePerPoint) : null,
    }))
}

/** Valor estimado de un programa (null sin valor por punto). */
export function programValue(p) {
  return p && p.valuePerPoint > 0 ? Math.round(p.points * p.valuePerPoint * 100) / 100 : null
}

/** Suma de lo que tiene valor estimado. */
export function loyaltyTotal(list) {
  return Math.round((list || []).reduce((s, p) => s + (programValue(p) || 0), 0) * 100) / 100
}

export const includeInNetWorth = (settings) => settings?.loyaltyInNetWorth === true

/** Valida el formulario. Devuelve { ok, error?, item? } (error = clave i18n). */
export function validateProgram({ program, points, valuePerPoint }) {
  const name = String(program || '').trim()
  if (!name) return { ok: false, error: 'loyalty.form.needName' }
  const pts = Number(String(points ?? '').replace(/[.\s]/g, '').replace(',', '.'))
  if (!(Number.isFinite(pts) && pts >= 0) || String(points ?? '').trim() === '') return { ok: false, error: 'loyalty.form.needPoints' }
  const v = Number(String(valuePerPoint ?? '').replace(',', '.'))
  return { ok: true, item: { program: name.slice(0, 60), points: Math.round(pts), valuePerPoint: Number.isFinite(v) && v > 0 ? v : null } }
}

/** Alta o edición (por id); devuelve la lista nueva para settings.loyalty. */
export function upsertProgram(list, item, id = null) {
  const cur = Array.isArray(list) ? list : []
  if (id && cur.some(p => p.id === id)) return cur.map(p => (p.id === id ? { ...p, ...item, id } : p))
  const newId = id || `lp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  return [...cur, { ...item, id: newId }]
}

export function removeProgram(list, id) {
  return (Array.isArray(list) ? list : []).filter(p => p.id !== id)
}

// Demo (24-nov-2026): dos programas de ejemplo mientras la persona del demo no
// cargó los suyos. Viven acá (chunk diferido) y no en demoData.js para no pesar
// en la carga inicial; nunca se guardan solos en settings. El nombre sale del
// idioma activo y el valor por punto, de la moneda de la persona del demo
// (orden de magnitud típico de una milla; sin moneda conocida, sin valor).
const DEMO_VALUE = { CLP: 10, COP: 40, MXN: 0.2, ARS: 12, PEN: 0.04, UYU: 0.5, BRL: 0.06, USD: 0.012, EUR: 0.011 }
export function demoLoyalty(currency, t = (k) => k) {
  const v = DEMO_VALUE[currency] || null
  return [
    { id: 'demo-lp-1', program: t('loyalty.demo.miles'), points: 18500, valuePerPoint: v },
    { id: 'demo-lp-2', program: t('loyalty.demo.card'), points: 4200, valuePerPoint: null },
  ]
}
export const withDemoLoyalty = (settings, t) =>
  (settings?.isDemo && !Array.isArray(settings.loyalty) ? { ...settings, loyalty: demoLoyalty(settings.currency, t) } : settings)
