// src/utils/proChecklist.js
// Checklist de los primeros días de Pro (auditoría 360, PRD-4): los mismos
// tres pasos de los correos de la prueba (send-trial-activation-email, días
// 1, 3 y 10): importar movimientos, abrir Modo Asesor y revisar el reporte
// mensual. Un paso se marca solo al abrir su pantalla.
//
// El cliente no sabe si la licencia es de prueba (validate_license no lo
// devuelve), así que la ventana es la de la prueba contada desde el primer día
// en que esta cuenta se ve como Pro en este dispositivo. La clave fos_* viaja
// con la cuenta (core/deviceOwner.js), nunca es del dispositivo.

export const PRO_CHECKLIST_KEY = 'fos_pro_checklist'
export const PRO_CHECKLIST_DAYS = 14
export const PRO_STEPS = [
  { id: 'import', page: 'import', labelKey: 'proTrial.step.import' },
  { id: 'advisor', page: 'advisor', labelKey: 'proTrial.step.advisor' },
  { id: 'report', page: 'reports', labelKey: 'proTrial.step.report' },
]
const DAY_MS = 24 * 60 * 60 * 1000

function storage() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null }
}

export function readChecklist(store = storage()) {
  try {
    const raw = store?.getItem(PRO_CHECKLIST_KEY)
    const v = raw ? JSON.parse(raw) : null
    if (!v || typeof v !== 'object') return null
    return { since: Number(v.since) || null, done: v.done && typeof v.done === 'object' ? v.done : {}, dismissed: !!v.dismissed }
  } catch { return null }
}

function write(state, store = storage()) {
  try { store?.setItem(PRO_CHECKLIST_KEY, JSON.stringify(state)) } catch { /* sin almacenamiento: no se guarda */ }
  return state
}

// Pro visto por primera vez: arranca la ventana. Idempotente.
export function startChecklist(now = Date.now(), store = storage()) {
  const cur = readChecklist(store)
  if (cur?.since) return cur
  return write({ since: now, done: cur?.done || {}, dismissed: false }, store)
}

// Abrió una pantalla: si es la de un paso, queda hecho.
export function markPageVisited(page, store = storage()) {
  const cur = readChecklist(store)
  const step = PRO_STEPS.find(s => s.page === page)
  if (!cur?.since || !step || cur.done[step.id]) return cur
  return write({ ...cur, done: { ...cur.done, [step.id]: true } }, store)
}

export function dismissChecklist(store = storage()) {
  const cur = readChecklist(store)
  if (!cur) return null
  return write({ ...cur, dismissed: true }, store)
}

export function isChecklistVisible(state, now = Date.now()) {
  if (!state?.since || state.dismissed) return false
  if (now - state.since > PRO_CHECKLIST_DAYS * DAY_MS) return false
  return PRO_STEPS.some(s => !state.done[s.id])
}
