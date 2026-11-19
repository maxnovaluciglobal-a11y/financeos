// src/utils/investProfile.js — perfil de inversionista que habilita Inversiones.
//
// Decisión de Walter (19-nov-2026): la pantalla de Inversiones dentro de moyiq
// solo se abre con un "perfil avanzado": cuenta con sesión + un cuestionario
// corto (experiencia, horizonte, tolerancia al riesgo) + aceptar el aviso
// legal. No se cobra por esto: los datos de mercado no tienen licencia
// comercial (INV-1). Cuando la haya, Pro se puede sumar como otra vía.
//
// El perfil vive en la cuenta (user_metadata.invest_profile de Supabase Auth),
// así que se conserva entre dispositivos y no requiere tablas nuevas. No se
// usa para recomendar nada: solo deja constancia de que la persona se
// autodeclaró y aceptó que es información educativa.

export const PROFILE_VERSION = 1
export const PROFILE_KEY = 'invest_profile'

export const PROFILE_QUESTIONS = [
  { id: 'experience', options: ['none', 'some', 'active'] },
  { id: 'horizon', options: ['short', 'medium', 'long'] },
  { id: 'risk', options: ['low', 'medium', 'high'] },
]

const VALID = Object.fromEntries(PROFILE_QUESTIONS.map(q => [q.id, new Set(q.options)]))

export function answersComplete(answers) {
  return PROFILE_QUESTIONS.every(q => VALID[q.id].has(answers?.[q.id]))
}

// Completo = versión vigente, las tres respuestas válidas y el aviso aceptado.
export function profileComplete(profile) {
  if (!profile || typeof profile !== 'object') return false
  if (profile.v !== PROFILE_VERSION) return false
  if (!answersComplete(profile)) return false
  const at = Date.parse(profile.ackAt)
  return Number.isFinite(at) && at > 0
}

export function readProfile(user) {
  const p = user?.user_metadata?.[PROFILE_KEY]
  return p && typeof p === 'object' ? p : null
}

export function buildProfile(answers, now = new Date()) {
  if (!answersComplete(answers)) throw new Error('profile_incomplete')
  const out = { v: PROFILE_VERSION, ackAt: now.toISOString() }
  for (const q of PROFILE_QUESTIONS) out[q.id] = answers[q.id]
  return out
}

// Estado de acceso a Inversiones. Orden: demo (siempre abierto, con datos de
// ejemplo) → cargando la sesión → sin cuenta → falta el perfil → habilitado.
export function investAccessState({ demo = false, sessionLoaded = true, user = null } = {}) {
  if (demo) return 'granted'
  if (!sessionLoaded) return 'loading'
  if (!user?.id) return 'no-account'
  return profileComplete(readProfile(user)) ? 'granted' : 'needs-profile'
}
