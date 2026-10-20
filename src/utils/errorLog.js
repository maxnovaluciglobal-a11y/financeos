// src/utils/errorLog.js
// Registro local de errores JS no atrapados — sin telemetría externa (privacy-first).
// Guarda un ring buffer en localStorage para que soporte pueda pedirle al usuario
// que lo copie/pegue si reporta un problema, sin depender de un servicio externo.

const KEY = 'fnos_error_log'
const MAX_ENTRIES = 20

export function logClientError(entry) {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]')
    list.push({ ...entry, at: new Date().toISOString() })
    while (list.length > MAX_ENTRIES) list.shift()
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch { /* el propio registro de errores no puede fallar en voz alta */ }
}

export function getClientErrorLog() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function clearClientErrorLog() {
  try { localStorage.removeItem(KEY) } catch { /* almacenamiento o API del navegador no disponible: se sigue sin ello */ }
}

export function installGlobalErrorLog() {
  window.addEventListener('error', (event) => {
    logClientError({
      type: 'error',
      message: event.message,
      source: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
    })
  })
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    logClientError({
      type: 'unhandledrejection',
      message: reason instanceof Error ? reason.message : String(reason),
    })
  })
}
