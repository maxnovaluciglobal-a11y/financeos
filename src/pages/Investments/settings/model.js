// Lógica pura de Ajustes › Inversiones (F7), sin React, para probarla en node.
import { PROFILE_QUESTIONS, profileComplete } from '../../../utils/investProfile.js'
import { ERASE_TABLES, PLANS_STEP } from '../../../core/investErase.js'

// Estado de los avisos para mostrar: el de PushOffer (follow/shared.js:
// demo | unsupported | noLicense | on | off) más 'blocked' cuando están
// apagados porque el navegador negó el permiso (ahí "Activar" no sirve).
export function pushView(state, permission = 'default') {
  return state === 'off' && permission === 'denied' ? 'blocked' : state
}

// Perfil de inversionista → lo que se muestra: { complete, answers: [[id, opción]], ackAt }.
export function profileSummary(profile) {
  if (!profileComplete(profile)) return { complete: false, answers: [], ackAt: null }
  return { complete: true, answers: PROFILE_QUESTIONS.map(q => [q.id, profile[q.id]]), ackAt: profile.ackAt }
}
// Respuestas para precargar la hoja al editar (solo las válidas).
export function profileAnswers(profile) {
  const out = {}
  for (const q of PROFILE_QUESTIONS) if (q.options.includes(profile?.[q.id])) out[q.id] = profile[q.id]
  return out
}

// Mismo correo de soporte que Ajustes y la Ayuda (help/dict.js › HELP_EMAIL).
export const SUPPORT_EMAIL = 'support@moyiq.app'

export const ERASE_STEPS = [...ERASE_TABLES, PLANS_STEP]
const NOTHING = new Set(['session_required', 'auth_unavailable', 'network', 'timeout'])
const GAP = new Set(['not_deleted', 'denied'])

// Resultado de investErase.eraseAll() → qué decir.
//  ok · demo · nothing (no se borró nada: sesión, cuenta o red antes de
//  enviar cualquier borrado) · partial.
// En partial: lo borrado, lo que quedó sin confirmar (se envió y no hubo
// respuesta: puede que el servidor lo haya borrado), lo que no se borró y los
// pasos sin permiso (hueco de RLS).
export function eraseOutcome(r) {
  if (r?.ok) return { kind: 'ok' }
  if (r?.error === 'demo') return { kind: 'demo' }
  const done = [...(r?.done || []), ...(r?.skipped || [])]
  const all = r?.failed || []
  const unsure = all.filter(f => f.sent).map(f => f.step)
  if (!done.length && !unsure.length && NOTHING.has(r?.error)) {
    return { kind: 'nothing', errorKey: `is.del.err.${r.error === 'timeout' ? 'network' : r.error}` }
  }
  return {
    kind: 'partial',
    done: (r?.done || []),
    unsure,
    failed: all.filter(f => !f.sent).map(f => f.step),
    gap: all.filter(f => GAP.has(f.error)).map(f => f.step),
  }
}
