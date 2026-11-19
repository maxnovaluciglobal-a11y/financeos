import { describe, it, expect, vi, afterEach } from 'vitest'
import { hapticTap, hapticSelection } from './haptics.js'
import { setNativeHaptics } from '../native/nativeHaptics.js'

afterEach(() => setNativeHaptics(null))

describe('haptics', () => {
  it('en la app nativa usa el Taptic Engine y no navigator.vibrate', () => {
    const vib = vi.fn(() => true)
    vi.stubGlobal('navigator', { vibrate: vib })
    const n = { tap: vi.fn(), selection: vi.fn() }
    setNativeHaptics(n)
    hapticTap()
    expect(hapticSelection(10_000)).toBe(true)
    expect(n.tap).toHaveBeenCalledTimes(1)
    expect(n.selection).toHaveBeenCalledTimes(1)
    expect(vib).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
  it('un tick como máximo cada 35 ms', () => {
    const n = { tap: vi.fn(), selection: vi.fn() }
    setNativeHaptics(n)
    expect(hapticSelection(20_000)).toBe(true)
    expect(hapticSelection(20_010)).toBe(false)
    expect(hapticSelection(20_040)).toBe(true)
    expect(n.selection).toHaveBeenCalledTimes(2)
  })
  it('sin nativo cae a navigator.vibrate', () => {
    const vib = vi.fn(() => true)
    vi.stubGlobal('navigator', { vibrate: vib })
    expect(hapticSelection(30_000)).toBe(true)
    expect(vib).toHaveBeenCalledWith(6)
    vi.unstubAllGlobals()
  })
})
