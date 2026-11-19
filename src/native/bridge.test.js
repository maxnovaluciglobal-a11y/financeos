import { describe, it, expect, vi } from 'vitest'
vi.mock('@capacitor/core', () => ({
  registerPlugin: () => new Proxy({}, { get: () => () => Promise.resolve() }),
  SystemBars: { setStyle: () => Promise.resolve() },
  SystemBarsStyle: { Dark: 'DARK', Light: 'LIGHT', Default: 'DEFAULT' },
}))
const { barStyleFor, luminance, rgbToHex } = await import('./bridge.js')

describe('barras del sistema según el fondo', () => {
  it('fondo morado o grafito → texto claro; blanco o lima → texto oscuro', () => {
    expect(barStyleFor('#3C2282')).toBe('DARK')
    expect(barStyleFor('#1C1D21')).toBe('DARK')
    expect(barStyleFor('#FFFFFF')).toBe('LIGHT')
    expect(barStyleFor('#F4F2FA')).toBe('LIGHT')
    expect(barStyleFor('nada')).toBe('DEFAULT')
    expect(luminance('#000000')).toBe(0)
  })
  it('lee colores computados y descarta los transparentes', () => {
    expect(rgbToHex('rgb(60, 34, 130)')).toBe('#3c2282')
    expect(rgbToHex('rgba(0, 0, 0, 0)')).toBeNull()
    expect(rgbToHex('rgba(255, 255, 255, 0.9)')).toBe('#ffffff')
    expect(rgbToHex('transparent')).toBeNull()
    expect(rgbToHex('linear-gradient(75deg, rgb(45, 29, 89), rgb(60, 0, 151))')).toBe('#2d1d59')
  })
})
