// Textos del estado del sync (auditoría 360: G1-N3, G1-N4). Puro, para testear.

const ERROR_KEYS = new Set(['offline', 'no_session', 'invalid_license', 'snapshot_failed'])
// La copia de la nube no se puede abrir acá (frase de paso, clave…): Ajustes
// muestra qué hacer.
const BLOCKED = new Set(['passphrase_required', 'wrong_key', 'corrupt', 'undecryptable', 'license_key_required'])

// Clave i18n del estado visible del sync, o null si no hay nada que decir.
export function syncStatusKey(st) {
  const { state, error } = st || {}
  if (state === 'pending') return 'settings.syncStatus.pending'
  if (state !== 'error') return null
  if (ERROR_KEYS.has(error)) return `settings.syncStatus.${error}`
  return BLOCKED.has(error) ? 'settings.syncStatus.blocked' : 'settings.syncStatus.failed'
}

// Registros de una copia (counts de listSnapshots). importBatches son lotes de
// importación, no movimientos: no suman.
const COUNTED = ['incomes', 'expenses', 'budgets', 'debts', 'goals', 'subscriptions', 'recurring']
export function snapshotRecordCount(counts) {
  return COUNTED.reduce((n, k) => n + (Number.isFinite(counts?.[k]) ? counts[k] : 0), 0)
}
