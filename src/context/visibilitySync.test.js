import { describe, it, expect } from 'vitest'
import { runOnVisible } from './visibilitySync.js'

describe('al volver a la app (V-ENG-FN1)', () => {
  it('el sync termina antes del mantenimiento de fijos', async () => {
    const log = []
    await runOnVisible({
      shouldSync: true,
      runSync: async () => { await Promise.resolve(); log.push('sync') },
      runMaintenance: async () => { log.push('maintenance') },
    })
    expect(log).toEqual(['sync', 'maintenance'])
  })
  it('sin sync (espera o apagado) corre solo el mantenimiento', async () => {
    const log = []
    await runOnVisible({ shouldSync: false, runSync: async () => log.push('sync'), runMaintenance: async () => log.push('maintenance') })
    expect(log).toEqual(['maintenance'])
  })
  it('si el sync falla, el mantenimiento corre igual', async () => {
    const log = []
    await runOnVisible({ shouldSync: true, runSync: async () => { throw new Error('x') }, runMaintenance: async () => log.push('maintenance') })
    expect(log).toEqual(['maintenance'])
  })
})
