import { describe, it, expect } from 'vitest'
import { kpiFit } from './index.jsx'

describe('kpiFit (montos largos en una línea, según el ancho de la tarjeta)', () => {
  it('ignora valores no textuales', () => {
    expect(kpiFit(null)).toBeUndefined()
    expect(kpiFit(undefined)).toBeUndefined()
    expect(kpiFit({})).toBeUndefined()
  })
  it('pasa el largo al CSS para que la cifra se mida con el ancho real', () => {
    expect(kpiFit(3)).toEqual({ '--kpi-chars': 1 })
    expect(kpiFit('$1,950.65')).toEqual({ '--kpi-chars': 9 })
  })
  it('los montos largos además no se parten en dos líneas', () => {
    expect(kpiFit('Bs.250.000,00')).toEqual({ '--kpi-chars': 13, whiteSpace: 'nowrap' })
    expect(kpiFit('Bs.16.700.000,00')).toEqual({ '--kpi-chars': 16, whiteSpace: 'nowrap' })
    expect(kpiFit('Bs.167.000.000,00')).toEqual({ '--kpi-chars': 17, whiteSpace: 'nowrap' })
  })
  it('no fija un tamaño en px: el ancho lo resuelve el CSS (cqi)', () => {
    expect(kpiFit('Bs.167.000.000,00').fontSize).toBeUndefined()
  })
})
