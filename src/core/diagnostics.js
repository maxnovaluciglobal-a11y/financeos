// src/core/diagnostics.js — "Copiar registro de errores" de Ajustes (D-16 /
// ING-4). Arma un texto para pegar en un correo a soporte con el registro
// local de errores (utils/errorLog.js), sin montos (mismo saneado que el
// registro de "Enviar comentarios") y sin datos de la cuenta.
import { getClientErrorLog } from '../utils/errorLog.js'
import { technicalLog } from './feedback.js'

export function buildDiagnostics({ entries = getClientErrorLog(), version = '', lang = '', userAgent = '', now = new Date() } = {}) {
  const list = Array.isArray(entries) ? entries : []
  const head = [
    `MOY IQ ${version}`.trim(),
    `lang: ${lang || '-'}`,
    `ua: ${String(userAgent || '-').slice(0, 200)}`,
    `at: ${now.toISOString()}`,
    `errors: ${Math.min(list.length, 20)}`,
  ]
  const body = technicalLog(list)
  return body ? `${head.join('\n')}\n\n${body}` : head.join('\n')
}

export async function copyDiagnostics(text, clipboard = globalThis.navigator?.clipboard) {
  if (!clipboard?.writeText) return false
  try { await clipboard.writeText(text); return true } catch { return false }
}
