import { describe, it, expect, vi } from 'vitest'
import { isNewerDbError, forceAppUpdate } from './forceUpdate.js'

describe('base local más nueva que la app (ING-13)', () => {
  it('detecta VersionError directo o dentro de DbOpenError', () => {
    expect(isNewerDbError({ name: 'VersionError' })).toBe(true)
    expect(isNewerDbError({ name: 'DbOpenError', cause: { name: 'VersionError' } })).toBe(true)
    expect(isNewerDbError({ name: 'DbOpenError', cause: { name: 'QuotaExceededError' } })).toBe(false)
    expect(isNewerDbError(null)).toBe(false)
  })
  it('desregistra el SW, vacía cachés y recarga, sin tocar nada más', async () => {
    const unregister = vi.fn(async () => true)
    const del = vi.fn(async () => true)
    const reload = vi.fn()
    await forceAppUpdate({
      sw: { getRegistrations: async () => [{ unregister }, { unregister }] },
      cacheStorage: { keys: async () => ['a', 'b'], delete: del },
      reload,
    })
    expect(unregister).toHaveBeenCalledTimes(2)
    expect(del).toHaveBeenCalledWith('a')
    expect(del).toHaveBeenCalledWith('b')
    expect(reload).toHaveBeenCalledTimes(1)
  })
  it('recarga igual si no hay SW ni cachés', async () => {
    const reload = vi.fn()
    await forceAppUpdate({ sw: undefined, cacheStorage: undefined, reload })
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
