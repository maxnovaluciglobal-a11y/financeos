// src/admin/crmLogic.js — lógica pura del panel CRM (C-46 / COM-8).

// La fuente vacía con cuenta creada es un alta directa (sin lead previo):
// crm_refresh_contact la deja vacía para que un lead posterior la complete.
export function fuenteLabel(row) {
  if (row?.fuente) return row.fuente
  return row?.cuenta_creada_en ? 'cuenta' : '—'
}

// Puntaje simple 0-100 para ordenar el seguimiento: cuenta +30, entró en los
// últimos 7 días +20, opt-in confirmado +15, Pro +35.
export function leadScore(row, now = Date.now()) {
  if (!row) return 0
  let s = 0
  if (row.plan === 'gratis' || row.plan === 'pro' || row.cuenta_creada_en) s += 30
  if (row.ultimo_login && now - new Date(row.ultimo_login).getTime() <= 7 * 86400000) s += 20
  if (row.optin_confirmado) s += 15
  if (row.plan === 'pro') s += 35
  return Math.min(100, s)
}

// Vista "Hoy": contactos con una próxima acción vencida o para hoy, la más
// atrasada primero. `today` en formato AAAA-MM-DD (fecha local).
export function todayQueue(rows, today) {
  return (rows || [])
    .filter(r => r?.proxima_accion && r.proxima_accion_fecha && r.proxima_accion_fecha <= today)
    .sort((a, b) => a.proxima_accion_fecha.localeCompare(b.proxima_accion_fecha))
}

export const ACTIVITY_TYPES = ['nota', 'correo', 'llamada', 'mensaje', 'reunion']
