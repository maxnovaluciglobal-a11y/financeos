// src/utils/leadsLang.js
//
// Idioma del lead para las RPC register_starter_lead / register_demo_lead
// (y register_diagnostico_lead desde la landing). La migración
// supabase/migrations/20261009000000_leads_lang.sql agrega el parámetro
// opcional p_lang; ANTES de que esté aplicada, mandar p_lang hace que
// PostgREST responda 404 (no existe función con ese argumento) y el lead no
// se guarda. Por eso p_lang solo sale detrás de este flag.

// flip to true only AFTER migration 20261009000000_leads_lang.sql is applied and nurture functions are deployed
export const LEADS_LANG_ENABLED = false

const LEAD_LANGS = ['es', 'en', 'pt', 'de']

// 'pt-BR' → 'pt', 'EN' → 'en', 'fr'/''/null → null. Misma regla que la
// normalización de la migración y que _shared/emailLang.ts.
export function normalizeLeadLang(value) {
  if (typeof value !== 'string') return null
  const base = value.trim().toLowerCase().split(/[-_]/)[0]
  return LEAD_LANGS.includes(base) ? base : null
}

// Devuelve params con p_lang agregado solo si el flag está activo y el idioma
// es uno de los 4. Nunca muta params. `enabled` es inyectable para tests.
export function withLeadLang(params, lang, enabled = LEADS_LANG_ENABLED) {
  if (!enabled) return params
  const l = normalizeLeadLang(lang)
  if (!l) return params
  return { ...params, p_lang: l }
}
