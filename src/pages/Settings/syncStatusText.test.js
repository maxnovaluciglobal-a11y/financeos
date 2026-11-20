import { describe, it, expect } from 'vitest'
import { syncStatusKey, snapshotRecordCount, isSyncBlocked } from './syncStatusText.js'

describe('texto del estado del sync (G1-N3)', () => {
  it('ok o sin estado: nada que decir', () => {
    expect(syncStatusKey({ state: 'ok' })).toBeNull()
    expect(syncStatusKey({ state: 'idle' })).toBeNull()
    expect(syncStatusKey(null)).toBeNull()
  })
  it('pendiente y cada error con su texto', () => {
    expect(syncStatusKey({ state: 'pending' })).toBe('settings.syncStatus.pending')
    expect(syncStatusKey({ state: 'error', error: 'offline' })).toBe('settings.syncStatus.offline')
    expect(syncStatusKey({ state: 'error', error: 'snapshot_failed' })).toBe('settings.syncStatus.snapshot_failed')
    expect(syncStatusKey({ state: 'error', error: 'passphrase_required' })).toBe('settings.syncStatus.blocked')
    expect(syncStatusKey({ state: 'error', error: 'wrong_key' })).toBe('settings.syncStatus.blocked')
    expect(syncStatusKey({ state: 'error', error: 'raro' })).toBe('settings.syncStatus.failed')
  })
})

describe('bloqueos que reintentar no arregla', () => {
  it('frase de paso o clave: lleva a Ajustes', () => {
    for (const error of ['passphrase_required', 'wrong_key', 'corrupt', 'undecryptable', 'license_key_required']) {
      expect(isSyncBlocked({ state: 'error', error })).toBe(true)
    }
  })
  it('errores pasajeros se reintentan', () => {
    for (const error of ['offline', 'no_session', 'snapshot_failed', 'http_500', undefined]) {
      expect(isSyncBlocked({ state: 'error', error })).toBe(false)
    }
    expect(isSyncBlocked({ state: 'ok' })).toBe(false)
    expect(isSyncBlocked(null)).toBe(false)
  })
})

describe('registros de la copia previa al sync (G1-N4)', () => {
  it('suma los datos y no los lotes de importación ni campos que no son listas', () => {
    expect(snapshotRecordCount({ incomes: 2, expenses: 3, recurring: 1, importBatches: 4, incomplete: 1 })).toBe(6)
    expect(snapshotRecordCount(undefined)).toBe(0)
  })
})
