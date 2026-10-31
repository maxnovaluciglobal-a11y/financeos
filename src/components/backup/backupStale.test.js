import { describe, it, expect } from 'vitest'
import { isBackupStale, BACKUP_STALE_DAYS } from './BackupStatus.jsx'

const NOW = new Date('2026-10-30T12:00:00Z').getTime()
const daysAgo = (n) => new Date(NOW - n * 86400000).toISOString()

describe('isBackupStale (ola A8)', () => {
  it('sin datos reales o en la demo, nunca', () => {
    expect(isBackupStale({ settings: {}, hasRealData: false, now: NOW })).toBe(false)
    expect(isBackupStale({ settings: { isDemo: true }, hasRealData: true, now: NOW })).toBe(false)
  })
  it('sin respaldo, sí', () => {
    expect(isBackupStale({ settings: {}, hasRealData: true, now: NOW })).toBe(true)
  })
  it('más de 14 días, sí; dentro del plazo, no', () => {
    expect(isBackupStale({ settings: { lastBackupAt: daysAgo(BACKUP_STALE_DAYS + 1) }, hasRealData: true, now: NOW })).toBe(true)
    expect(isBackupStale({ settings: { lastBackupAt: daysAgo(3) }, hasRealData: true, now: NOW })).toBe(false)
  })
})
