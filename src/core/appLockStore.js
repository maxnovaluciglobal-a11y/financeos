// src/core/appLockStore.js — persistencia del bloqueo (T14), sobre la store
// 'security' de IndexedDB. La lógica (hash, límites, WebAuthn) está en
// appLock.js; acá solo se lee y se escribe.
//
// Forma de los registros:
//   'lock'     → { enabled, pin: <registro de hashPin>, biometric: { credentialId } | null,
//                  timeoutMin, updatedAt }
//   'attempts' → { count, lockedUntil }

import { securityGet, securityPut, securityDelete } from './db/index.js'
import { normalizeTimeout, DEFAULT_TIMEOUT_MIN, isPinRecord } from './appLock.js'

const LOCK_KEY = 'lock'
const ATTEMPTS_KEY = 'attempts'

export async function getLockConfig() {
  try {
    const c = await securityGet(LOCK_KEY)
    if (!c || typeof c !== 'object') return null
    return { ...c, timeoutMin: normalizeTimeout(c.timeoutMin) }
  } catch {
    return null
  }
}

export async function saveLockConfig({ pin, biometric = null, timeoutMin = DEFAULT_TIMEOUT_MIN }) {
  if (!isPinRecord(pin)) throw new Error('invalid_pin_record')
  const cfg = {
    enabled: true,
    pin,
    biometric: biometric?.credentialId ? { credentialId: biometric.credentialId } : null,
    timeoutMin: normalizeTimeout(timeoutMin),
    updatedAt: Date.now(),
  }
  await securityPut(LOCK_KEY, cfg)
  return cfg
}

export async function updateLockConfig(patch) {
  const cur = await getLockConfig()
  if (!cur) throw new Error('lock_not_configured')
  return saveLockConfig({ ...cur, ...patch })
}

export async function disableLock() {
  await securityDelete(LOCK_KEY)
  await securityDelete(ATTEMPTS_KEY)
}

export async function getAttempts() {
  try {
    const a = await securityGet(ATTEMPTS_KEY)
    return { count: Number(a?.count) || 0, lockedUntil: Number(a?.lockedUntil) || 0 }
  } catch {
    return { count: 0, lockedUntil: 0 }
  }
}

export async function saveAttempts(a) {
  await securityPut(ATTEMPTS_KEY, { count: a.count, lockedUntil: a.lockedUntil })
}

export async function resetAttempts() {
  await securityDelete(ATTEMPTS_KEY)
}
