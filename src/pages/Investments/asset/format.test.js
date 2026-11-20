import { describe, it, expect } from 'vitest'
import { errorKey, fmtDay, fmtEps, fmtPx, fmtPxSigned, isCryptoTicker, localDay, pxDecimals } from './format.js'
import { MINUS } from '../../../utils/index.js'

describe('formato de la ficha', () => {
  it('precio en la moneda del activo: US$ o el código', () => {
    expect(fmtPx(200, 'USD')).toMatch(/^US\$/)
    expect(fmtPx(950, 'CLP')).toMatch(/^CLP /)
    expect(fmtPx(null)).toBe('—')
  })
  it('signo menos tipográfico y + explícito', () => {
    expect(fmtPx(-5, 'USD').startsWith(MINUS)).toBe(true)
    expect(fmtPxSigned(5, 'USD').startsWith('+')).toBe(true)
    expect(fmtPxSigned(-5, 'USD').startsWith(MINUS)).toBe(true)
  })
  it('precios bajo 1 con 4 decimales', () => {
    expect(pxDecimals(0.5, 'USD')).toBe(4)
  })
  it('UPA con US$ solo en dólares', () => {
    expect(fmtEps(1.5, 'USD')).toMatch(/^US\$/)
    expect(fmtEps(1.5, 'EUR')).not.toMatch(/\$/)
  })
  it('fechas, hoy local, errores y cripto', () => {
    expect(fmtDay('2026-10-30', 'es-CL')).toMatch(/30/)
    expect(fmtDay('x')).toBe('x')
    expect(localDay(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(errorKey('session_required')).toBe('asset.err.session')
    expect(errorKey('network')).toBe('asset.err.network')
    expect(errorKey('rls')).toBe('asset.err.save')
    expect(isCryptoTicker('btc-usd')).toBe(true)
    expect(isCryptoTicker('X', 'Crypto')).toBe(true)
    expect(isCryptoTicker('AAPL')).toBe(false)
  })
})
