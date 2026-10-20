// src/utils/npsPrompt.js — NPS automático (auditoría 360, PRD-5).
// Se pide UNA vez por cuenta: al día 14 desde el alta o a los 10 movimientos
// registrados, lo que pase primero. Mostrarlo ya cuenta (responder o "Ahora
// no" lo cierran para siempre en esta cuenta); el servidor además rechaza un
// segundo NPS automático de la misma cuenta (nps_claim). La clave fos_* viaja
// con la cuenta (core/deviceOwner.js). Nada de montos: solo el puntaje, el
// comentario opcional y el motivo del disparo.

export const NPS_KEY = 'fos_nps_prompt'
export const NPS_DAYS = 14
export const NPS_MOVEMENTS = 10
const DAY_MS = 24 * 60 * 60 * 1000

function storage() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null }
}

export function readNpsState(store = storage()) {
  try {
    const v = JSON.parse(store?.getItem(NPS_KEY) || 'null')
    return v && typeof v === 'object' ? v : null
  } catch { return null }
}

// 'day14' | 'movements10' | null. createdAt: alta de la cuenta (ISO o ms).
export function npsTrigger({ createdAt, movements = 0, now = Date.now(), state = readNpsState() }) {
  if (state?.closedAt) return null
  if (Number(movements) >= NPS_MOVEMENTS) return 'movements10'
  const t = typeof createdAt === 'number' ? createdAt : Date.parse(createdAt || '')
  if (Number.isFinite(t) && now - t >= NPS_DAYS * DAY_MS) return 'day14'
  return null
}

// outcome: 'answered' | 'dismissed'. Después de esto no se vuelve a pedir.
export function closeNps(outcome, trigger, now = Date.now(), store = storage()) {
  const state = { closedAt: now, outcome, trigger: trigger || null }
  try { store?.setItem(NPS_KEY, JSON.stringify(state)) } catch { /* sin almacenamiento: puede volver a aparecer, el servidor lo frena */ }
  return state
}
