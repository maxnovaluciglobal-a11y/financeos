// src/utils/marketingConsent.js
//
// Doble opt-in de marketing (§ 7 Abs. 2 UWG / RGPD art. 7). La migración
// supabase/migrations/20261010010000_marketing_double_optin.sql:
//   - agrega p_consent_marketing a register_starter_lead (hasta ahí Starter
//     no recibía consentimiento y la fila entraba con consent true por
//     default) — ANTES de aplicarla, mandar ese parámetro hace que PostgREST
//     responda 404 y el lead no se guarde;
//   - genera un consent_token cuando la casilla está marcada; el token solo
//     viaja en el correo de send-optin-confirmation, que el cliente pide con
//     { source, id } justo después del registro.
// Por eso las dos cosas salen detrás de este flag, igual que
// LEADS_LANG_ENABLED en leadsLang.js.

// flip to true only AFTER migration 20261010010000_marketing_double_optin.sql
// is applied and send-optin-confirmation + the nurture functions are deployed
export const MARKETING_DOI_ENABLED = true

// Fuentes que acepta send-optin-confirmation (tabla de leads de cada una).
export const OPTIN_SOURCES = ['starter', 'diagnostico', 'demo']

// Params de register_starter_lead con p_consent_marketing (solo `true`
// estricto cuenta como consentimiento). Nunca muta params.
export function withStarterConsent(params, consent, enabled = MARKETING_DOI_ENABLED) {
  if (!enabled) return params
  return { ...params, p_consent_marketing: consent === true }
}

// ¿Hay que pedir el correo de confirmación? Solo con el flag, la casilla
// marcada y un registro que devolvió id.
export function shouldRequestOptin(data, consent, enabled = MARKETING_DOI_ENABLED) {
  return !!(enabled && consent === true && data && data.ok && data.id)
}
